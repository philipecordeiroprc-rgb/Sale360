import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';

const orderItemSchema = z.object({
  productId: z.string().optional(),
  variationId: z.string().optional(),
  productName: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number(),
  total: z.number(),
});

const createOrderSchema = z.object({
  deviceId: z.string().optional(),
  customerId: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
  subtotal: z.number(),
  discount: z.number().default(0),
  total: z.number(),
  paymentMethod: z.string(),
  paymentStatus: z.enum(['PAID', 'PENDING', 'PARTIAL', 'CREDIT_STORE']).default('PAID'),
  source: z.enum(['PDV', 'ONLINE', 'WHATSAPP', 'DELIVERY', 'COMAND']).default('PDV'),
  notes: z.string().optional(),
  localId: z.string().optional(),
  createdAtDevice: z.string().optional(),
});

export const orderRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const {
      page = '1',
      limit = '20',
      status,
      source,
      startDate,
      endDate,
      customerId,
    } = request.query as Record<string, string>;

    const where: any = { tenantId: request.tenantId };
    if (status) where.status = status;
    if (source) where.source = source;
    if (customerId) where.customerId = customerId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          customer: { select: { id: true, name: true, phone: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.order.count({ where }),
    ]);

    return { orders, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await prisma.order.findFirst({
      where: { OR: [{ id }, { localId: id }], tenantId: request.tenantId },
      include: {
        items: true,
        customer: true,
        user: { select: { id: true, name: true } },
        delivery: true,
      },
    });
    if (!order) return reply.status(404).send({ error: 'Venda não encontrada' });
    return order;
  });

  // Create order with FIFO/PEPS consumption
  app.post('/', async (request, reply) => {
    const parsed = createOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const { items, localId, createdAtDevice, ...orderData } = parsed.data;

    // Generate order number
    const lastOrder = await prisma.order.findFirst({
      where: { tenantId: request.tenantId },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const orderNumber = (lastOrder?.orderNumber || 0) + 1;

    // Pre-validate stock for all items (fail fast before transaction)
    for (const item of items) {
      if (item.productId) {
        // Check stock for this product+variant from inventory batches
        const batches = await prisma.inventoryBatch.findMany({
          where: {
            tenantId: request.tenantId,
            productId: item.productId,
            variationId: item.variationId || null,
            remainingQty: { gt: 0 },
          },
        });
        const totalAvailable = batches.reduce((sum, b) => sum + Number(b.remainingQty), 0);
        if (totalAvailable < item.quantity) {
          return reply.status(400).send({
            error: `Estoque insuficiente para "${item.productName}". Disponível: ${totalAvailable}, Necessário: ${item.quantity}`,
          });
        }
      }
    }

    const order = await prisma.$transaction(async (tx) => {
      // Create order with items (costPrice/totalCost filled after FIFO calc)
      const itemsData = await Promise.all(items.map(async (item) => {
        let costPrice: number | undefined;
        let totalCost: number | undefined;

        if (item.productId) {
          // Fetch product tax rate for historical record
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { taxRate: true },
          });
          const taxRate = product?.taxRate ? Number(product.taxRate) : undefined;

          // FIFO: consume from oldest batches
          let remaining = item.quantity;
          let totalCostAcc = 0;
          const batches = await tx.inventoryBatch.findMany({
            where: {
              tenantId: request.tenantId,
              productId: item.productId,
              variationId: item.variationId || null,
              remainingQty: { gt: 0 },
            },
            orderBy: { receivedAt: 'asc' },
          });

          for (const batch of batches) {
            if (remaining <= 0) break;
            const consume = Math.min(Number(batch.remainingQty), remaining);
            const batchCost = Number(batch.unitCost);

            // Decrement batch remaining quantity
            await tx.inventoryBatch.update({
              where: { id: batch.id },
              data: { remainingQty: { decrement: consume } },
            });

            // Create SALE_OUT movement
            await tx.inventoryMovement.create({
              data: {
                tenantId: request.tenantId,
                productId: item.productId,
                variationId: item.variationId || null,
                type: 'SALE_OUT',
                quantity: -consume,
                unitCost: batchCost,
                totalCost: -(consume * batchCost),
                batchId: batch.id,
                notes: `Venda #${orderNumber} - ${item.productName}`,
              },
            });

            totalCostAcc += consume * batchCost;
            remaining -= consume;
          }

          // Weighted average cost for this item
          costPrice = totalCostAcc / item.quantity;
          totalCost = totalCostAcc;

          // Update product/variation stock
          if (item.variationId) {
            await tx.productVariation.update({
              where: { id: item.variationId },
              data: { stockQty: { decrement: item.quantity } },
            });
          }
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQty: { decrement: item.quantity },
              costPrice: Math.round(costPrice * 100) / 100,
            },
          });

          return {
            productId: item.productId,
            variationId: item.variationId || null,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            costPrice: costPrice ? Math.round(costPrice * 100) / 100 : undefined,
            totalCost: totalCost ? Math.round(totalCost * 100) / 100 : undefined,
            taxRate,
          };
        }

        return {
          productId: item.productId,
          variationId: item.variationId || null,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        };
      }));

      const o = await tx.order.create({
        data: {
          ...orderData,
          tenantId: request.tenantId,
          userId: request.userId,
          orderNumber,
          localId,
          createdAtDevice: createdAtDevice ? new Date(createdAtDevice) : null,
          syncStatus: 'SYNCED',
          items: { create: itemsData },
        },
        include: { items: true, customer: true },
      });

      // Update inventory movements with orderId
      await tx.inventoryMovement.updateMany({
        where: {
          tenantId: request.tenantId,
          notes: { startsWith: `Venda #${orderNumber}` },
          orderId: undefined,
        },
        data: { orderId: o.id },
      });

      // Update customer stats
      if (orderData.customerId) {
        await tx.customer.update({
          where: { id: orderData.customerId },
          data: {
            totalPurchases: { increment: 1 },
            totalSpent: { increment: orderData.total },
            lastPurchaseAt: new Date(),
          },
        });
      }

      // Register in cash flow
      await tx.cashFlow.create({
        data: {
          tenantId: request.tenantId,
          type: 'IN',
          category: 'venda',
          description: `Venda #${orderNumber}`,
          amount: orderData.total,
          dueDate: new Date(),
          paidAt: orderData.paymentStatus === 'PAID' ? new Date() : null,
          orderId: o.id,
        },
      });

      return o;
    });

    return reply.status(201).send(order);
  });

  // Cancel order with FIFO/PEPS reversal
  app.post('/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await prisma.order.findFirst({
      where: { OR: [{ id }, { localId: id }], tenantId: request.tenantId },
      include: { items: true },
    });
    if (!order) return reply.status(404).send({ error: 'Venda não encontrada' });

    if (order.status === 'CANCELLED') {
      return reply.status(400).send({ error: 'Venda já cancelada' });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (item.productId) {
          // Create SALE_CANCEL movement
          await tx.inventoryMovement.create({
            data: {
              tenantId: request.tenantId,
              productId: item.productId,
              variationId: (item as any).variationId || null,
              type: 'SALE_CANCEL',
              quantity: item.quantity,
              unitCost: item.costPrice ? Number(item.costPrice) : 0,
              totalCost: item.totalCost ? Number(item.totalCost) : 0,
              orderId: order.id,
              notes: `Cancelamento venda #${order.orderNumber} - ${item.productName}`,
            },
          });

          // Return stock as a new batch (preserves cost history)
          if (item.costPrice) {
            await tx.inventoryBatch.create({
              data: {
                tenantId: request.tenantId,
                productId: item.productId,
                variationId: (item as any).variationId || null,
                quantity: item.quantity,
                remainingQty: item.quantity,
                unitCost: Number(item.costPrice),
                receivedAt: new Date(),
              },
            });
          }

          // Update product/variation stock
          if ((item as any).variationId) {
            await tx.productVariation.update({
              where: { id: (item as any).variationId },
              data: { stockQty: { increment: item.quantity } },
            });
          }
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: { increment: item.quantity } },
          });
        }
      }

      // Cancel order
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' },
      });

      // Reverse cash flow
      await tx.cashFlow.create({
        data: {
          tenantId: request.tenantId,
          type: 'OUT',
          category: 'estorno',
          description: `Cancelamento venda #${order.orderNumber}`,
          amount: order.total,
          dueDate: new Date(),
          paidAt: new Date(),
          orderId: order.id,
        },
      });
    });

    return { success: true };
  });

  // Today's summary
  app.get('/today-summary', async (request) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: {
        tenantId: request.tenantId,
        createdAt: { gte: today },
        status: 'COMPLETED',
      },
      select: { total: true, paymentMethod: true },
    });

    const totalSales = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const count = orders.length;
    const byMethod = orders.reduce((acc: Record<string, { count: number; total: number }>, o) => {
      const method = o.paymentMethod || 'outro';
      if (!acc[method]) acc[method] = { count: 0, total: 0 };
      acc[method].count++;
      acc[method].total += Number(o.total);
      return acc;
    }, {});

    return { date: today.toISOString().slice(0, 10), totalSales, count, byMethod };
  });
};
