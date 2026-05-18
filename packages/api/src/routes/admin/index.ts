import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import { prisma } from '@sale360/db';
import { z } from 'zod';

export const adminRoutes: FastifyPluginAsync = async (app) => {
  // ============================================================
  // Tenants
  // ============================================================

  // List all tenants
  app.get('/tenants', async (request) => {
    const { search, status, plan, page = '1', limit = '20' } = request.query as Record<string, string>;

    const where: any = {};
    if (search) where.companyName = { contains: search, mode: 'insensitive' };
    if (status) where.status = status;
    if (plan) where.plan = plan;

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: {
          _count: { select: { users: true, products: true, orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.tenant.count({ where }),
    ]);

    return { tenants, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
  });

  // Get tenant detail
  app.get('/tenants/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, devices: true, products: true, orders: true } },
        users: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
        },
      },
    });
    if (!tenant) return reply.status(404).send({ error: 'Empresa não encontrada.' });
    return tenant;
  });

  // Create tenant
  app.post('/tenants', async (request, reply) => {
    const schema = z.object({
      slug: z.string().min(3, 'Slug deve ter no mínimo 3 caracteres'),
      companyName: z.string().min(1, 'Nome da empresa é obrigatório'),
      plan: z.enum(['PRO', 'GROW', 'PRIME']).default('PRO'),
      status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']).default('TRIAL'),
      trialEndsAt: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    // Check slug uniqueness
    const existing = await prisma.tenant.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) {
      return reply.status(400).send({ error: 'Já existe uma empresa com este slug.' });
    }

    const tenant = await prisma.tenant.create({
      data: {
        slug: parsed.data.slug,
        companyName: parsed.data.companyName,
        plan: parsed.data.plan,
        status: parsed.data.status,
        trialEndsAt: parsed.data.trialEndsAt ? new Date(parsed.data.trialEndsAt) : undefined,
      },
    });

    return reply.status(201).send(tenant);
  });

  // Update tenant
  app.patch('/tenants/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      companyName: z.string().optional(),
      plan: z.enum(['PRO', 'GROW', 'PRIME']).optional(),
      status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']).optional(),
      trialEndsAt: z.string().nullable().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos' });
    }

    const data: any = { ...parsed.data };
    if (data.trialEndsAt !== undefined) {
      data.trialEndsAt = data.trialEndsAt ? new Date(data.trialEndsAt) : null;
    }

    try {
      const tenant = await prisma.tenant.update({ where: { id }, data });
      return tenant;
    } catch {
      return reply.status(404).send({ error: 'Empresa não encontrada.' });
    }
  });

  // ============================================================
  // Users (platform level)
  // ============================================================

  // Reset any user's password
  app.post('/users/:userId/reset-password', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const schema = z.object({ password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres') });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado.' });

    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });

    return { message: 'Senha redefinida com sucesso.' };
  });

  // List all users (across all tenants)
  app.get('/users', async (request) => {
    const { search, page = '1', limit = '50' } = request.query as Record<string, string>;
    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
  });
};
