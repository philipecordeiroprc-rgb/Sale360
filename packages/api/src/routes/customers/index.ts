import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';

const createCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  document: z.string().optional(),
  notes: z.string().optional(),
});

export const customerRoutes: FastifyPluginAsync = async (app) => {
  // List customers
  app.get('/', async (request) => {
    const { search, page = '1', limit = '50' } = request.query as Record<string, string>;

    const where: any = { tenantId: request.tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { document: { contains: search } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { totalSpent: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.customer.count({ where }),
    ]);

    return { customers, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
  });

  // Recent buyers (for "Novos Compradores" feature - Kyte-inspired)
  app.get('/recent-buyers', async (request) => {
    const customers = await prisma.customer.findMany({
      where: {
        tenantId: request.tenantId,
        lastPurchaseAt: { not: null },
      },
      orderBy: { lastPurchaseAt: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        phone: true,
        totalPurchases: true,
        totalSpent: true,
        lastPurchaseAt: true,
        creditBalance: true,
      },
    });
    return customers;
  });

  // Get single customer with history
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const customer = await prisma.customer.findFirst({
      where: { id, tenantId: request.tenantId },
      include: {
        orders: { orderBy: { createdAt: 'desc' }, take: 20 },
        creditTransactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!customer) return reply.status(404).send({ error: 'Cliente não encontrado' });
    return customer;
  });

  // Create
  app.post('/', async (request, reply) => {
    const parsed = createCustomerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }
    const customer = await prisma.customer.create({
      data: { ...parsed.data, tenantId: request.tenantId, email: parsed.data.email || null },
    });
    return reply.status(201).send(customer);
  });

  // Update
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = createCustomerSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Dados inválidos' });

    const exists = await prisma.customer.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!exists) return reply.status(404).send({ error: 'Cliente não encontrado' });

    const customer = await prisma.customer.update({ where: { id }, data: parsed.data });
    return customer;
  });

  // Credit operations (fiado)
  app.post('/:id/credit', async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      type: z.enum(['LOAN', 'PAYMENT', 'TOPUP', 'ADJUSTMENT']),
      amount: z.number().positive(),
      notes: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Dados inválidos' });

    const customer = await prisma.customer.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!customer) return reply.status(404).send({ error: 'Cliente não encontrado' });

    let newBalance = Number(customer.creditBalance);
    if (parsed.data.type === 'LOAN') {
      newBalance += parsed.data.amount;
    } else if (parsed.data.type === 'PAYMENT') {
      newBalance -= parsed.data.amount;
      if (newBalance < 0) newBalance = 0;
    } else if (parsed.data.type === 'TOPUP') {
      newBalance += parsed.data.amount;
    }

    const [transaction] = await prisma.$transaction([
      prisma.creditTransaction.create({
        data: {
          customerId: id,
          type: parsed.data.type,
          amount: parsed.data.amount,
          balanceAfter: newBalance,
          notes: parsed.data.notes,
        },
      }),
      prisma.customer.update({
        where: { id },
        data: { creditBalance: newBalance },
      }),
    ]);

    return reply.status(201).send({ transaction, currentBalance: newBalance });
  });
};
