import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';

const purchaseItemSchema = z.object({
  productId: z.string().optional(),
  variationId: z.string().optional(),
  productName: z.string().min(1, 'Nome do produto é obrigatório'),
  quantity: z.number().positive('Quantidade deve ser positiva'),
  unitCost: z.number().min(0, 'Custo unitário não pode ser negativo'),
  total: z.number(),
});

const createPurchaseSchema = z.object({
  supplierId: z.string().min(1, 'Fornecedor é obrigatório'),
  customerId: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1, 'Pelo menos 1 item é obrigatório'),
  discount: z.number().default(0),
  notes: z.string().optional(),
});

export const purchaseRoutes: FastifyPluginAsync = async (app) => {
  // List purchases
  app.get('/', async (request) => {
    const {
      status,
      supplierId,
      startDate,
      endDate,
      page = '1',
      limit = '20',
    } = request.query as Record<string, string>;

    const where: any = { tenantId: request.tenantId };
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          items: true,
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.purchase.count({ where }),
    ]);

    return { purchases, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
  });

  // Get single purchase
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const purchase = await prisma.purchase.findFirst({
      where: { id, tenantId: request.tenantId },
      include: {
        supplier: true,
        items: {
          include: {
            product: { select: { id: true, name: true, unit: true, stockQty: true } },
            variation: { select: { id: true, name: true, stockQty: true } },
          },
        },
      },
    });
    if (!purchase) return reply.status(404).send({ error: 'Compra não encontrada' });
    return purchase;
  });

  // Create purchase (DRAFT)
  app.post('/', async (request, reply) => {
    const parsed = createPurchaseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const { items, supplierId, discount, notes } = parsed.data;

    // Validate supplier belongs to tenant
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId: request.tenantId },
    });
    if (!supplier) return reply.status(404).send({ error: 'Fornecedor não encontrado' });

    // Calculate totals
    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const total = subtotal - discount;

    // Generate order number
    const lastPurchase = await prisma.purchase.findFirst({
      where: { tenantId: request.tenantId },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const orderNumber = (lastPurchase?.orderNumber || 0) + 1;

    const purchase = await prisma.purchase.create({
      data: {
        tenantId: request.tenantId,
        supplierId,
        orderNumber,
        status: 'DRAFT',
        subtotal,
        discount,
        total,
        notes,
        items: {
          create: items.map((item) => ({
            productId: item.productId || undefined,
            variationId: item.variationId || undefined,
            productName: item.productName,
            quantity: item.quantity,
            unitCost: item.unitCost,
            total: item.total,
          })),
        },
      },
      include: { items: true, supplier: { select: { id: true, name: true } } },
    });

    return reply.status(201).send(purchase);
  });

  // Update purchase (only DRAFT)
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const purchase = await prisma.purchase.findFirst({
      where: { id, tenantId: request.tenantId },
      include: { items: true },
    });
    if (!purchase) return reply.status(404).send({ error: 'Compra não encontrada' });
    if (purchase.status !== 'DRAFT') {
      return reply.status(400).send({ error: 'Apenas compras em rascunho podem ser editadas' });
    }

    const parsed = createPurchaseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const { items, supplierId, discount, notes } = parsed.data;
    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const total = subtotal - discount;

    // Replace items: delete old, create new
    await prisma.$transaction(async (tx) => {
      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

      await tx.purchase.update({
        where: { id },
        data: {
          supplierId,
          subtotal,
          discount,
          total,
          notes,
          items: {
            create: items.map((item) => ({
              productId: item.productId || undefined,
              variationId: item.variationId || undefined,
              productName: item.productName,
              quantity: item.quantity,
              unitCost: item.unitCost,
              total: item.total,
            })),
          },
        },
      });
    });

    const updated = await prisma.purchase.findFirst({
      where: { id },
      include: { items: true, supplier: { select: { id: true, name: true } } },
    });

    return updated;
  });

  // Receive purchase — PEPS core: creates InventoryBatches + Movements
  app.post('/:id/receive', async (request, reply) => {
    const { id } = request.params as { id: string };

    const purchase = await prisma.purchase.findFirst({
      where: { id, tenantId: request.tenantId },
      include: { items: true },
    });
    if (!purchase) return reply.status(404).send({ error: 'Compra não encontrada' });
    if (purchase.status === 'RECEIVED') {
      return reply.status(400).send({ error: 'Compra já foi recebida' });
    }
    if (purchase.status === 'CANCELLED') {
      return reply.status(400).send({ error: 'Compra cancelada não pode ser recebida' });
    }

    const receivedAt = new Date();

    await prisma.$transaction(async (tx) => {
      // Update purchase status
      await tx.purchase.update({
        where: { id },
        data: { status: 'RECEIVED', receivedAt },
      });

      // For each item, create inventory batch and movement
      for (const item of purchase.items) {
        // Create batch
        await tx.inventoryBatch.create({
          data: {
            tenantId: request.tenantId,
            productId: item.productId || undefined,
            variationId: item.variationId || undefined,
            purchaseItemId: item.id,
            quantity: item.quantity,
            remainingQty: item.quantity,
            unitCost: item.unitCost,
            receivedAt,
          },
        });

        // Create movement
        await tx.inventoryMovement.create({
          data: {
            tenantId: request.tenantId,
            productId: item.productId || undefined,
            variationId: item.variationId || undefined,
            type: 'PURCHASE_IN',
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.total,
            purchaseId: id,
            notes: `Compra #${purchase.orderNumber} - ${item.productName}`,
          },
        });

        // Update product stock and cost price
        if (item.productId) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product) {
            const currentStock = Number(product.stockQty);
            const currentCost = Number(product.costPrice || 0);
            const newStock = currentStock + Number(item.quantity);
            const weightedCost = currentStock > 0
              ? (currentStock * currentCost + Number(item.quantity) * Number(item.unitCost)) / newStock
              : Number(item.unitCost);

            await tx.product.update({
              where: { id: item.productId },
              data: {
                stockQty: { increment: item.quantity },
                costPrice: Math.round(weightedCost * 100) / 100,
              },
            });
          }
        }

        // Update variation stock
        if (item.variationId) {
          await tx.productVariation.update({
            where: { id: item.variationId },
            data: { stockQty: { increment: item.quantity } },
          });
        }
      }
    });

    // Return updated purchase
    const updated = await prisma.purchase.findFirst({
      where: { id },
      include: { items: true, supplier: true },
    });

    return reply.status(200).send(updated);
  });

  // Cancel purchase
  app.post('/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };

    const purchase = await prisma.purchase.findFirst({
      where: { id, tenantId: request.tenantId },
      include: { items: true },
    });
    if (!purchase) return reply.status(404).send({ error: 'Compra não encontrada' });
    if (purchase.status === 'CANCELLED') {
      return reply.status(400).send({ error: 'Compra já está cancelada' });
    }

    await prisma.$transaction(async (tx) => {
      // If was received, reverse inventory
      if (purchase.status === 'RECEIVED') {
        for (const item of purchase.items) {
          // Create reversal movement
          await tx.inventoryMovement.create({
            data: {
              tenantId: request.tenantId,
              productId: item.productId || undefined,
              variationId: item.variationId || undefined,
              type: 'PURCHASE_CANCEL',
              quantity: -item.quantity,
              unitCost: item.unitCost,
              totalCost: -item.total,
              purchaseId: id,
              notes: `Cancelamento compra #${purchase.orderNumber} - ${item.productName}`,
            },
          });

          // Consume from batches (FIFO reverse: remove from newest batches first)
          let remaining = Number(item.quantity);
          const batches = await tx.inventoryBatch.findMany({
            where: {
              tenantId: request.tenantId,
              productId: item.productId || undefined,
              variationId: item.variationId || undefined,
              remainingQty: { gt: 0 },
            },
            orderBy: { receivedAt: 'desc' }, // newest first for reversal
          });

          for (const batch of batches) {
            if (remaining <= 0) break;
            const consume = Math.min(Number(batch.remainingQty), remaining);
            await tx.inventoryBatch.update({
              where: { id: batch.id },
              data: { remainingQty: { decrement: consume } },
            });
            remaining -= consume;
          }

          // Update product stock
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQty: { decrement: item.quantity } },
            });
          }
          if (item.variationId) {
            await tx.productVariation.update({
              where: { id: item.variationId },
              data: { stockQty: { decrement: item.quantity } },
            });
          }
        }
      }

      // Mark as cancelled
      await tx.purchase.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
    });

    return { success: true };
  });

  // Delete purchase (only DRAFT)
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const purchase = await prisma.purchase.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!purchase) return reply.status(404).send({ error: 'Compra não encontrada' });
    if (purchase.status !== 'DRAFT') {
      return reply.status(400).send({ error: 'Apenas compras em rascunho podem ser excluídas' });
    }

    await prisma.purchaseItem.deleteMany({ where: { purchaseId: id } });
    await prisma.purchase.delete({ where: { id } });

    return { success: true };
  });
};
