import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';

// This is the core sync endpoint for offline-first PDV
// Devices push their local changes and pull server changes

const syncPushSchema = z.object({
  deviceId: z.string(),
  lastSyncAt: z.string().optional(),
  changes: z.object({
    orders: z.array(z.object({
      localId: z.string(),
      data: z.any(),
      createdAtDevice: z.string(),
    })).optional(),
    customers: z.array(z.object({
      localId: z.string().optional(),
      operation: z.enum(['create', 'update']),
      data: z.any(),
    })).optional(),
  }),
});

export const syncRoutes: FastifyPluginAsync = async (app) => {
  // PULL: Get all changes since last sync
  app.get('/pull', async (request) => {
    const { deviceId, lastSyncAt } = request.query as Record<string, string>;

    const since = lastSyncAt ? new Date(lastSyncAt) : new Date(0);

    // Get products (always full sync for catalog consistency)
    const products = await prisma.product.findMany({
      where: { tenantId: request.tenantId, updatedAt: { gte: since } },
      include: { category: true, variations: true },
    });

    // Get customers updated since last sync
    const customers = await prisma.customer.findMany({
      where: { tenantId: request.tenantId, updatedAt: { gte: since } },
    });

    // Get orders that were synced from other devices
    const orders = await prisma.order.findMany({
      where: {
        tenantId: request.tenantId,
        createdAt: { gte: since },
        deviceId: { not: deviceId }, // don't send back own orders
        syncStatus: 'SYNCED',
      },
      include: { items: true },
    });

    // Get stock levels (all, always — critical for consistency)
    const stock = await prisma.product.findMany({
      where: { tenantId: request.tenantId },
      select: { id: true, stockQty: true, updatedAt: true },
    });

    // Update device last sync
    if (deviceId) {
      await prisma.device.upsert({
        where: { tenantId_name: { tenantId: request.tenantId, name: deviceId } },
        update: { lastSyncAt: new Date() },
        create: {
          tenantId: request.tenantId,
          name: deviceId,
          type: 'mobile',
        },
      });
    }

    return {
      serverTime: new Date().toISOString(),
      products,
      customers,
      orders,
      stock,
    };
  });

  // PUSH: Send local changes to server
  app.post('/push', async (request, reply) => {
    const parsed = syncPushSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados de sync inválidos', details: parsed.error.flatten() });
    }

    const { deviceId, changes } = parsed.data;
    const results: { orders: any[]; customers: any[]; conflicts: any[] } = {
      orders: [],
      customers: [],
      conflicts: [],
    };

    // Process orders from device
    if (changes.orders?.length) {
      for (const { localId, data, createdAtDevice } of changes.orders) {
        // Check for duplicate (same localId already synced)
        const existing = await prisma.order.findFirst({
          where: { localId, tenantId: request.tenantId },
        });

        if (existing) {
          results.conflicts.push({ localId, serverId: existing.id, reason: 'already_synced' });
          continue;
        }

        // Generate order number
        const lastOrder = await prisma.order.findFirst({
          where: { tenantId: request.tenantId },
          orderBy: { orderNumber: 'desc' },
          select: { orderNumber: true },
        });
        const orderNumber = (lastOrder?.orderNumber || 0) + 1;

        // Process each item with FIFO/PEPS (same logic as regular sale)
        const itemsData: any[] = [];
        for (const item of (data.items || [])) {
          let costPrice: number | undefined;
          let totalCost: number | undefined;

          if (item.productId) {
            // FIFO: consume from oldest batches
            let remaining = item.quantity;
            let totalCostAcc = 0;
            const batches = await prisma.inventoryBatch.findMany({
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
              await prisma.inventoryBatch.update({
                where: { id: batch.id },
                data: { remainingQty: { decrement: consume } },
              });

              // Create SALE_OUT movement
              await prisma.inventoryMovement.create({
                data: {
                  tenantId: request.tenantId,
                  productId: item.productId,
                  variationId: item.variationId || null,
                  type: 'SALE_OUT',
                  quantity: -consume,
                  unitCost: batchCost,
                  totalCost: -(consume * batchCost),
                  batchId: batch.id,
                  notes: `Venda offline #${orderNumber} - ${item.productName}`,
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
              await prisma.productVariation.update({
                where: { id: item.variationId },
                data: { stockQty: { decrement: item.quantity } },
              });
            }
            await prisma.product.update({
              where: { id: item.productId },
              data: {
                stockQty: { decrement: item.quantity },
                costPrice: Math.round(costPrice * 100) / 100,
              },
            });
          }

          itemsData.push({
            productId: item.productId || null,
            variationId: item.variationId || null,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            costPrice,
            totalCost,
          });
        }

        // Build OrderPayment records from sync data
        const syncPayments: Array<{ paymentMethod: string; amount: number }> = (data as any).payments?.length
          ? (data as any).payments.map((p: any) => ({
              paymentMethod: p.paymentMethod,
              amount: p.amount,
            }))
          : data.paymentMethod
            ? [{ paymentMethod: data.paymentMethod, amount: data.total }]
            : [];

        // Create order with items (including cost data)
        const order = await prisma.order.create({
          data: {
            tenantId: request.tenantId,
            deviceId,
            userId: data.userId,
            customerId: data.customerId,
            orderNumber,
            localId,
            subtotal: data.subtotal,
            discount: data.discount || 0,
            total: data.total,
            paidAmount: data.paidAmount || data.total,
            paymentMethod: syncPayments.length > 0 ? syncPayments[0].paymentMethod : data.paymentMethod,
            paymentStatus: data.paymentStatus || 'PAID',
            source: data.source || 'PDV',
            syncStatus: 'SYNCED',
            createdAtDevice: new Date(createdAtDevice),
            items: {
              create: itemsData,
            },
          },
          include: { items: true },
        });

        // Create OrderPayment records for sync
        for (const payment of syncPayments) {
          await prisma.orderPayment.create({
            data: {
              orderId: order.id,
              paymentMethod: payment.paymentMethod,
              amount: payment.amount,
            },
          });
        }

        // Cash flow
        await prisma.cashFlow.create({
          data: {
            tenantId: request.tenantId,
            type: 'IN',
            category: 'venda',
            description: `Venda #${orderNumber}`,
            amount: data.total,
            dueDate: new Date(),
            paidAt: data.paymentStatus === 'PAID' ? new Date() : null,
            orderId: order.id,
          },
        });

        results.orders.push({ localId, serverId: order.id, orderNumber });
      }
    }

    // Process customers
    if (changes.customers?.length) {
      for (const { operation, data } of changes.customers) {
        if (operation === 'create') {
          const customer = await prisma.customer.create({
            data: { ...data, tenantId: request.tenantId },
          });
          results.customers.push({ operation: 'create', id: customer.id });
        } else if (operation === 'update') {
          const customer = await prisma.customer.update({
            where: { id: data.id },
            data,
          });
          results.customers.push({ operation: 'update', id: customer.id });
        }
      }
    }

    // Update device sync timestamp
    if (deviceId) {
      await prisma.device.upsert({
        where: { tenantId_name: { tenantId: request.tenantId, name: deviceId } },
        update: { lastSyncAt: new Date() },
        create: {
          tenantId: request.tenantId,
          name: deviceId,
          type: 'mobile',
        },
      });
    }

    return { success: true, results, serverTime: new Date().toISOString() };
  });

  // Resolve conflict
  app.post('/resolve-conflict', async (request, reply) => {
    const schema = z.object({
      localId: z.string(),
      resolution: z.enum(['use_server', 'use_local']),
      localData: z.any().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Dados inválidos' });

    if (parsed.data.resolution === 'use_local') {
      // Delete server version, re-create with local data
      await prisma.order.deleteMany({
        where: { localId: parsed.data.localId, tenantId: request.tenantId },
      });
      return { action: 'recreate', localId: parsed.data.localId };
    }

    // use_server: already exists, just update local
    const order = await prisma.order.findFirst({
      where: { localId: parsed.data.localId, tenantId: request.tenantId },
    });
    return { action: 'keep_server', serverId: order?.id };
  });
};
