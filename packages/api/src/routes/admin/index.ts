import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { prisma } from '@sale360/db';
import { sendResetEmail } from '../../services/email.js';
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
      slug: z.string().min(3, 'Slug deve ter no mínimo 3 caracteres').regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens').transform((s) => s.toLowerCase()),
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
      slug: z.string().min(3, 'Slug deve ter no mínimo 3 caracteres').regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens').transform((s) => s.toLowerCase()).optional(),
      plan: z.enum(['PRO', 'GROW', 'PRIME']).optional(),
      status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']).optional(),
      trialEndsAt: z.string().nullable().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    // Check slug uniqueness if changing
    if (parsed.data.slug) {
      const existing = await prisma.tenant.findUnique({ where: { slug: parsed.data.slug } });
      if (existing && existing.id !== id) {
        return reply.status(400).send({ error: 'Já existe uma empresa com este slug.' });
      }
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
  // Tenant Users (SUPER_ADMIN managing users per store)
  // ============================================================

  // List users of a tenant
  app.get('/tenants/:id/users', async (request, reply) => {
    const { id } = request.params as { id: string };

    const users = await prisma.tenantUser.findMany({
      where: { tenantId: id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return users;
  });

  // Add user to tenant
  app.post('/tenants/:id/users', async (request, reply) => {
    const { id: tenantId } = request.params as { id: string };

    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(1, 'Nome é obrigatório'),
      password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
      role: z.enum(['OWNER', 'CASHIER']).default('CASHIER'),
      pin: z.string().length(4).optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

    if (user) {
      const alreadyLinked = await prisma.tenantUser.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
      });
      if (alreadyLinked) {
        return reply.status(400).send({ error: 'Usuário já está vinculado a esta loja.' });
      }
    } else {
      const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
      user = await prisma.user.create({
        data: {
          email: parsed.data.email,
          name: parsed.data.name,
          password: hashedPassword,
        },
      });
    }

    const tenantUser = await prisma.tenantUser.create({
      data: {
        tenantId,
        userId: user.id,
        role: parsed.data.role as any,
        pin: parsed.data.pin || '',
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return reply.status(201).send(tenantUser);
  });

  // Update user role/pin in tenant
  app.put('/tenants/:id/users/:userId', async (request, reply) => {
    const { id: tenantId, userId } = request.params as { id: string; userId: string };

    const schema = z.object({
      role: z.enum(['OWNER', 'CASHIER']).optional(),
      pin: z.string().length(4).optional(),
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const tenantUser = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    if (!tenantUser) return reply.status(404).send({ error: 'Usuário não encontrado nesta loja.' });

    // Update TenantUser role/pin
    const updated = await prisma.tenantUser.update({
      where: { id: tenantUser.id },
      data: {
        ...(parsed.data.role !== undefined ? { role: parsed.data.role as any } : {}),
        ...(parsed.data.pin !== undefined ? { pin: parsed.data.pin } : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    // Update user-level fields (name, email) if provided
    if (parsed.data.name || parsed.data.email) {
      const userUpdate: any = {};
      if (parsed.data.name) userUpdate.name = parsed.data.name;
      if (parsed.data.email) userUpdate.email = parsed.data.email;
      await prisma.user.update({ where: { id: userId }, data: userUpdate });
    }

    return updated;
  });

  // Remove user from tenant
  app.delete('/tenants/:id/users/:userId', async (request, reply) => {
    const { id: tenantId, userId } = request.params as { id: string; userId: string };

    const tenantUser = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    if (!tenantUser) return reply.status(404).send({ error: 'Usuário não encontrado nesta loja.' });

    await prisma.tenantUser.delete({ where: { id: tenantUser.id } });
    return { success: true };
  });

  // Reset user password from admin
  app.post('/tenants/:id/users/:userId/reset-password', async (request, reply) => {
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

  // Send reset link to user (SUPER_ADMIN triggers email)
  app.post('/tenants/:id/users/:userId/send-reset-link', async (request, reply) => {
    const { userId } = request.params as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado.' });

    // Generate token (1 hour expiry)
    const token = randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const result = await sendResetEmail(user.email, token, user.name);

    return {
      message: result.success
        ? 'Email enviado com sucesso.'
        : 'Token gerado, mas o envio de email falhou.',
      resetLink: result.link,
      emailSent: result.success,
    };
  });

  // ============================================================
  // Feature Overrides (per-tenant module toggling)
  // ============================================================

  // Get effective features for a tenant
  app.get('/tenants/:id/features', async (request, reply) => {
    const { id } = request.params as { id: string };

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { plan: true, status: true, featureOverrides: true },
    });

    if (!tenant) return reply.status(404).send({ error: 'Empresa não encontrada.' });

    // Base plan features
    const baseFeatures: Record<string, boolean> = {
      webVersion: tenant.plan === 'GROW' || tenant.plan === 'PRIME',
      aiDescriptions: tenant.plan === 'GROW' || tenant.plan === 'PRIME',
      aiAssistant: tenant.plan === 'PRIME',
      magicRegister: tenant.plan === 'PRIME',
      variations: tenant.plan === 'GROW' || tenant.plan === 'PRIME',
      bulkImport: tenant.plan === 'GROW' || tenant.plan === 'PRIME',
      suppliers: tenant.plan === 'GROW' || tenant.plan === 'PRIME',
      recurrentExpenses: tenant.plan === 'GROW' || tenant.plan === 'PRIME',
      unlimitedUsers: tenant.plan === 'PRIME',
      prioritySupport: tenant.plan === 'PRIME',
      saturday: tenant.plan === 'PRIME',
      videoCall: tenant.plan === 'PRIME',
      whatsappSupport: tenant.plan === 'PRIME',
    };

    // Merge with overrides (if any)
    const overrides = (tenant.featureOverrides as Record<string, boolean> | null) || {};
    const features: Record<string, boolean> = {};
    for (const key of Object.keys(baseFeatures)) {
      features[key] = key in overrides ? overrides[key] : baseFeatures[key];
    }

    return {
      plan: tenant.plan,
      status: tenant.status,
      features,
      overrides,
    };
  });

  // Update feature overrides for a tenant
  app.put('/tenants/:id/features', async (request, reply) => {
    const { id } = request.params as { id: string };

    const schema = z.object({
      overrides: z.record(z.boolean()),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    try {
      const tenant = await prisma.tenant.update({
        where: { id },
        data: { featureOverrides: parsed.data.overrides },
        select: { plan: true, status: true, featureOverrides: true },
      });

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

  // Update user platform role (promote/demote SUPER_ADMIN)
  app.put('/users/:userId/role', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const schema = z.object({
      role: z.enum(['USER', 'SUPER_ADMIN']),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado.' });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: parsed.data.role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    return updated;
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
