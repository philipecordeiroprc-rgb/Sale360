import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';
import { startOfDay, endOfDay, monthRange, todayBRT } from '../../lib/date-utils.js';

const createCashFlowSchema = z.object({
  type: z.enum(['IN', 'OUT']),
  category: z.string(),
  description: z.string(),
  amount: z.number().positive(),
  isRecurrent: z.boolean().default(false),
  recurrenceDay: z.number().min(1).max(31).optional(),
  dueDate: z.string(),
  paidAt: z.string().optional(),
});

export const financeRoutes: FastifyPluginAsync = async (app) => {
  // Get cash flow
  app.get('/cash-flow', async (request) => {
    const { month, year, category } = request.query as Record<string, string>;

    const now = todayBRT();
    const targetYear = parseInt(year || String(now.year));
    const targetMonth = parseInt(month || String(now.month));

    const { start: startDate, end: endDate } = monthRange(targetYear, targetMonth);

    const where: any = {
      tenantId: request.tenantId,
      dueDate: { gte: startDate, lte: endDate },
    };
    if (category) where.category = category;

    const [entries, summary] = await Promise.all([
      prisma.cashFlow.findMany({
        where,
        orderBy: { dueDate: 'desc' },
      }),
      prisma.cashFlow.groupBy({
        by: ['type'],
        where,
        _sum: { amount: true },
      }),
    ]);

    const totalIn = Number(summary.find((s) => s.type === 'IN')?._sum?.amount || 0);
    const totalOut = Number(summary.find((s) => s.type === 'OUT')?._sum?.amount || 0);

    return {
      entries,
      summary: {
        totalIn,
        totalOut,
        balance: totalIn - totalOut,
      },
      period: { year: targetYear, month: targetMonth },
    };
  });

  // Create cash flow entry
  app.post('/cash-flow', async (request, reply) => {
    const parsed = createCashFlowSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos' });
    }

    const entry = await prisma.cashFlow.create({
      data: {
        ...parsed.data,
        tenantId: request.tenantId,
        dueDate: new Date(parsed.data.dueDate),
        paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : null,
      },
    });

    return reply.status(201).send(entry);
  });

  // Mark as paid
  app.patch('/cash-flow/:id/pay', async (request, reply) => {
    const { id } = request.params as { id: string };
    const entry = await prisma.cashFlow.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!entry) return reply.status(404).send({ error: 'Registro não encontrado' });

    const updated = await prisma.cashFlow.update({
      where: { id },
      data: { paidAt: new Date() },
    });
    return updated;
  });

  // Sales report
  app.get('/reports/sales', async (request) => {
    const { startDate, endDate } = request.query as Record<string, string>;

    const where: any = {
      tenantId: request.tenantId,
      status: 'COMPLETED',
    };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const [y, m, d] = startDate.split('-').map(Number);
        where.createdAt.gte = new Date(y, m - 1, d);
      }
      if (endDate) {
        const [y, m, d] = endDate.split('-').map(Number);
        where.createdAt.lte = new Date(y, m - 1, d, 23, 59, 59, 999);
      }
    }

    const orders = await prisma.order.findMany({
      where,
      select: { total: true, paymentMethod: true, createdAt: true, payments: { select: { paymentMethod: true, amount: true } } },
    });

    const totalSales = orders.reduce((s, o) => s + Number(o.total), 0);
    const ticketMedio = orders.length > 0 ? totalSales / orders.length : 0;

    // Top products
    const topProducts = await prisma.orderItem.groupBy({
      by: ['productName'],
      where: {
        order: { tenantId: request.tenantId, status: 'COMPLETED' },
      },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    });

    return {
      totalSales,
      totalOrders: orders.length,
      averageTicket: Math.round(ticketMedio * 100) / 100,
      topProducts,
    };
  });
};
