import type { FastifyPluginAsync } from 'fastify';
import { prisma, MovementType } from '@sale360/db';
import { z } from 'zod';

const adjustSchema = z.object({
  productId: z.string().optional(),
  variationId: z.string().optional(),
  quantity: z.number().refine((v) => v !== 0, 'Quantidade não pode ser zero'),
  type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT']).optional(),
  unitCost: z.number().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export const inventoryRoutes: FastifyPluginAsync = async (app) => {
  // List batches (all products with remaining stock, or filter by product)
  app.get('/batches', async (request) => {
    const { productId, variationId, page = '1', limit = '50' } = request.query as Record<string, string>;

    const where: any = {
      tenantId: request.tenantId,
      remainingQty: { gt: 0 },
    };

    if (productId) where.productId = productId;
    if (variationId) where.variationId = variationId;

    const [batches, total] = await Promise.all([
      prisma.inventoryBatch.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, unit: true, sku: true, stockQty: true, lowStockAt: true } },
          variation: { select: { id: true, name: true, stockQty: true, lowStockAt: true } },
        },
        orderBy: { receivedAt: 'asc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.inventoryBatch.count({ where }),
    ]);

    return { batches, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
  });

  // Get batches for a specific product
  app.get('/batches/:productId', async (request, reply) => {
    const { productId } = request.params as { productId: string };

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: request.tenantId },
      select: { id: true, name: true, unit: true, stockQty: true, costPrice: true },
    });
    if (!product) return reply.status(404).send({ error: 'Produto não encontrado' });

    const batches = await prisma.inventoryBatch.findMany({
      where: {
        productId,
        tenantId: request.tenantId,
        remainingQty: { gt: 0 },
      },
      include: {
        variation: { select: { id: true, name: true } },
      },
      orderBy: { receivedAt: 'asc' },
    });

    const totalRemaining = batches.reduce((sum, b) => sum + Number(b.remainingQty), 0);
    const averageCost = batches.length > 0
      ? batches.reduce((sum, b) => sum + Number(b.unitCost) * Number(b.remainingQty), 0) / totalRemaining
      : 0;

    return {
      product,
      batches,
      summary: {
        totalBatches: batches.length,
        totalRemaining,
        averageCost: Math.round(averageCost * 100) / 100,
      },
    };
  });

  // Get movements history
  app.get('/movements', async (request) => {
    const {
      productId,
      variationId,
      type,
      startDate,
      endDate,
      page = '1',
      limit = '50',
    } = request.query as Record<string, string>;

    const where: any = { tenantId: request.tenantId };

    if (productId) where.productId = productId;
    if (variationId) where.variationId = variationId;
    if (type) where.type = type;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, unit: true } },
          variation: { select: { id: true, name: true } },
          batch: { select: { id: true, remainingQty: true, unitCost: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.inventoryMovement.count({ where }),
    ]);

    return { movements, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
  });

  // Manual stock adjustment
  app.post('/adjust', async (request, reply) => {
    const parsed = adjustSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const { productId, variationId, quantity, type, unitCost, reason, notes } = parsed.data;

    // Validate product exists and belongs to tenant
    if (productId) {
      const product = await prisma.product.findFirst({
        where: { id: productId, tenantId: request.tenantId },
      });
      if (!product) return reply.status(404).send({ error: 'Produto não encontrado' });
    }

    if (variationId) {
      const variation = await prisma.productVariation.findFirst({
        where: { id: variationId },
        include: { product: true },
      });
      if (!variation) return reply.status(404).send({ error: 'Variação não encontrada' });
    }

    // Determine direction: explicit "type" takes precedence, otherwise derive from quantity sign
    let movementType: MovementType;
    let effectiveQty: number;
    if (type === 'ADJUSTMENT_OUT') {
      movementType = 'ADJUSTMENT_OUT';
      effectiveQty = -Math.abs(quantity); // always negative for OUT
    } else if (type === 'ADJUSTMENT_IN') {
      movementType = 'ADJUSTMENT_IN';
      effectiveQty = Math.abs(quantity); // always positive for IN
    } else {
      const isIn = quantity > 0;
      movementType = isIn ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
      effectiveQty = quantity;
    }
    const absQty = Math.abs(effectiveQty);
    const cost = unitCost || 0;

    await prisma.$transaction(async (tx) => {
      // Create adjustment movement
      await tx.inventoryMovement.create({
        data: {
          tenantId: request.tenantId,
          productId,
          variationId: variationId || undefined,
          type: movementType,
          quantity: effectiveQty,
          unitCost: cost,
          totalCost: effectiveQty * cost,
          reason: reason || undefined,
          notes: notes || 'Ajuste manual de estoque',
        },
      });

      // Create or update batch
      if (movementType === 'ADJUSTMENT_IN') {
        await tx.inventoryBatch.create({
          data: {
            tenantId: request.tenantId,
            productId,
            variationId: variationId || undefined,
            quantity: absQty,
            remainingQty: absQty,
            unitCost: cost,
            receivedAt: new Date(),
          },
        });

        // Update product stock
        if (productId) {
          await tx.product.update({
            where: { id: productId },
            data: { stockQty: { increment: absQty } },
          });
        }
        if (variationId) {
          await tx.productVariation.update({
            where: { id: variationId },
            data: { stockQty: { increment: absQty } },
          });
        }
      } else {
        // Consume from oldest batches
        let remaining = absQty;
        const batches = await tx.inventoryBatch.findMany({
          where: {
            tenantId: request.tenantId,
            productId: productId || undefined,
            variationId: variationId || undefined,
            remainingQty: { gt: 0 },
          },
          orderBy: { receivedAt: 'asc' },
        });

        const totalAvailable = batches.reduce((sum, b) => sum + Number(b.remainingQty), 0);
        if (totalAvailable < remaining) {
          throw new Error('Estoque insuficiente para o ajuste');
        }

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
        if (productId) {
          await tx.product.update({
            where: { id: productId },
            data: { stockQty: { decrement: absQty } },
          });
        }
        if (variationId) {
          await tx.productVariation.update({
            where: { id: variationId },
            data: { stockQty: { decrement: absQty } },
          });
        }
      }
    });

    return reply.status(201).send({ success: true, type: movementType, quantity: effectiveQty });
  });

  // TEMPORARY: merge duplicate variations (run once then remove)
  app.post('/merge-duplicate-variations', async (request, reply) => {
    const allVariations = await prisma.productVariation.findMany({
      orderBy: { id: 'asc' },
    });

    // Fetch product names separately
    const productIds = [...new Set(allVariations.map(v => v.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const productNames = new Map(products.map(p => [p.id, p.name]));

    const groups = new Map<string, any[]>();
    for (const v of allVariations) {
      const key = `${v.productId}__${v.name.trim().toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(v);
    }

    const duplicates = Array.from(groups.values()).filter(g => g.length > 1);
    const report: string[] = [];

    if (duplicates.length === 0) {
      return { merged: 0, message: 'No duplicate variations found.' };
    }

    let totalMerged = 0;
    for (const group of duplicates) {
      const canonical = group[0];
      const toMerge = group.slice(1);
      const prodName = productNames.get(canonical.productId) || '?';

      for (const dup of toMerge) {
        await prisma.$transaction(async (tx) => {
          await tx.inventoryBatch.updateMany({
            where: { variationId: dup.id },
            data: { variationId: canonical.id },
          });
          await tx.inventoryMovement.updateMany({
            where: { variationId: dup.id },
            data: { variationId: canonical.id },
          });
          await tx.purchaseItem.updateMany({
            where: { variationId: dup.id },
            data: { variationId: canonical.id },
          });
          await tx.orderItem.updateMany({
            where: { variationId: dup.id },
            data: { variationId: canonical.id },
          });
          if (Number(dup.stockQty) > 0) {
            await tx.productVariation.update({
              where: { id: canonical.id },
              data: { stockQty: { increment: Number(dup.stockQty) } },
            });
          }
          await tx.productVariation.delete({ where: { id: dup.id } });
        });

        report.push(
          `${prodName} | "${canonical.name}" | ${dup.id} → ${canonical.id}`
        );
        totalMerged++;
      }
    }

    return reply.status(201).send({ merged: totalMerged, report });
  });
};
