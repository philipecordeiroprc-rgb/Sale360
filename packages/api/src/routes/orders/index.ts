import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';

const orderItemSchema = z.object({
  productId: z.string().optional(),
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
  source: z.enum(['PDV', 'ONLINE', 'WHATSAAPP', 'DELIVERY', 'COMANDA']).default('PDV'),
  notes: z.string().optional(),
  // Offline support
  localId: z.string().optional(),
  createdAtDevice: z.string().optional(), // ISO date from device
});

export const orderRoutes: FastifyPluginAsync = async (app) => {
  // List orders (paginated)
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

  // Get single order
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

  // Create order (supports offline sync)
  app.post('/', async (request, reply) => {
    const parsed = createOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const { items, localId, createdAtDevice, ...orderData } = parsed.data;

    // Generate order number (sequential per tenant)
    const lastOrder = await prisma.order.findFirst({
      where: { tenantId: request.tenantId },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const orderNumber = (lastOrder?.orderNumber || 0) + 1;

    // Create order with items in transaction
    const order = await prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          ...orderData,
          tenantId: request.tenantId,
          userId: request.userId,
          orderNumber,
          localId,
          createdAtDevice: createdAtDevice ? new Date(createdAtDevice) : null,
          syncStatus: 'SYNCED',
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            })),
          },
        },
        include: { items: true, customer: true },
      });

      // Update stock
      for (const item of items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: { decrement: item.quantity } },
          });
        }
      }

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

  // Cancel order
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
      // Return stock
      for (const item of order.items) {
        if (item.productId) {
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

  // Today's summary (dashboard card)
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
    // Group by payment method
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
