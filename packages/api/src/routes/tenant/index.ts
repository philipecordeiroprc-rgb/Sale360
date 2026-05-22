import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { prisma } from '@sale360/db';
import { sendResetEmail } from '../../services/email.js';
import { z } from 'zod';

export const tenantRoutes: FastifyPluginAsync = async (app) => {
  // Get current tenant info
  app.get('/me', async (request) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: request.tenantId },
      include: {
        users: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        _count: {
          select: {
            products: true,
            orders: true,
            customers: true,
          },
        },
      },
    });

    return tenant;
  });

  // Plan features (what current tenant has access to)
  app.get('/features', async (request) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: request.tenantId },
      select: { plan: true, status: true, featureOverrides: true },
    });

    if (!tenant) return { error: 'Not found' };

    const baseFeatures: Record<string, Record<string, any>> = {
      PRO: {
        maxUsers: 1,
        maxDevices: 1,
        webVersion: false,
        aiDescriptions: false,
        aiAssistant: false,
        magicRegister: false,
        variations: false,
        bulkImport: false,
        suppliers: false,
        recurrentExpenses: false,
        unlimitedUsers: false,
        prioritySupport: false,
        saturday: false,
        videoCall: false,
        whatsappSupport: false,
      },
      GROW: {
        maxUsers: 10,
        maxDevices: 5,
        webVersion: true,
        aiDescriptions: true,
        aiAssistant: false,
        magicRegister: false,
        variations: true,
        bulkImport: true,
        suppliers: true,
        recurrentExpenses: true,
        unlimitedUsers: false,
        prioritySupport: false,
        saturday: false,
        videoCall: false,
        whatsappSupport: false,
      },
      PRIME: {
        maxUsers: Infinity,
        maxDevices: Infinity,
        webVersion: true,
        aiDescriptions: true,
        aiAssistant: true,
        magicRegister: true,
        variations: true,
        bulkImport: true,
        suppliers: true,
        recurrentExpenses: true,
        unlimitedUsers: true,
        prioritySupport: true,
        saturday: true,
        videoCall: true,
        whatsappSupport: true,
      },
    };

    const base = baseFeatures[tenant.plan] as Record<string, any>;
    const overrides = (tenant.featureOverrides as Record<string, boolean> | null) || {};

    // Merge overrides into base features
    const features: Record<string, any> = {};
    for (const [key, value] of Object.entries(base)) {
      if (key === 'maxUsers' || key === 'maxDevices') {
        features[key] = value; // numeric fields — not overridable
      } else {
        features[key] = key in overrides ? overrides[key] : value;
      }
    }

    return {
      plan: tenant.plan,
      status: tenant.status,
      features,
    };
  });

  // ============================================================
  // Users management
  // ============================================================

  // List users in tenant
  app.get('/users', async (request) => {
    const users = await prisma.tenantUser.findMany({
      where: { tenantId: request.tenantId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return users;
  });

  // Add user to tenant
  app.post('/users', async (request, reply) => {
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

    // Check plan user limit
    const tenant = await prisma.tenant.findUnique({
      where: { id: request.tenantId },
      select: { plan: true },
    });

    const userCount = await prisma.tenantUser.count({ where: { tenantId: request.tenantId } });

    const limits: Record<string, number> = { PRO: 1, GROW: 10, PRIME: Infinity };
    if (userCount >= (limits[tenant!.plan] || 1)) {
      return reply.status(400).send({
        error: `Limite de usuários atingido para o plano ${tenant!.plan}. Faça upgrade para adicionar mais usuários.`,
      });
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

    if (user) {
      // Check if already in this tenant
      const alreadyLinked = await prisma.tenantUser.findUnique({
        where: { tenantId_userId: { tenantId: request.tenantId, userId: user.id } },
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
        tenantId: request.tenantId,
        userId: user.id,
        role: parsed.data.role as any,
        pin: parsed.data.pin || '',
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return reply.status(201).send(tenantUser);
  });

  // Update user role/pin in tenant
  app.put('/users/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const schema = z.object({
      role: z.enum(['OWNER', 'CASHIER']).optional(),
      pin: z.string().length(4).optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos' });
    }

    const tenantUser = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: request.tenantId, userId } },
    });
    if (!tenantUser) return reply.status(404).send({ error: 'Usuário não encontrado nesta loja.' });

    const updated = await prisma.tenantUser.update({
      where: { id: tenantUser.id },
      data: parsed.data,
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return updated;
  });

  // Remove user from tenant
  app.delete('/users/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const tenantUser = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: request.tenantId, userId } },
    });
    if (!tenantUser) return reply.status(404).send({ error: 'Usuário não encontrado nesta loja.' });

    await prisma.tenantUser.delete({ where: { id: tenantUser.id } });
    return { success: true };
  });

  // Reset user password (ADMIN only)
  app.post('/users/:userId/reset-password', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const schema = z.object({ password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres') });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos' });
    }

    // Verify user belongs to this tenant
    const tenantUser = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: request.tenantId, userId } },
    });
    if (!tenantUser) return reply.status(404).send({ error: 'Usuário não encontrado nesta loja.' });

    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });

    return { message: 'Senha redefinida com sucesso.' };
  });

  // Send reset link to user (admin triggers email)
  app.post('/users/:userId/send-reset-link', async (request, reply) => {
    const { userId } = request.params as { userId: string };

    // Verify user belongs to this tenant
    const tenantUser = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: request.tenantId, userId } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!tenantUser) return reply.status(404).send({ error: 'Usuário não encontrado nesta loja.' });

    // Generate token (1 hour expiry)
    const token = randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        userId: tenantUser.user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const result = await sendResetEmail(tenantUser.user.email, token, tenantUser.user.name);

    return {
      message: result.success
        ? 'Email enviado com sucesso.'
        : 'Token gerado, mas o envio de email falhou.',
      resetLink: result.link,
      emailSent: result.success,
    };
  });

  // ============================================================
  // Current user profile
  // ============================================================

  // Get current user profile
  app.get('/me/profile', async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true },
    });

    const tenantUser = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId: request.tenantId, userId: request.userId } },
      select: { role: true, pin: true },
    });

    return { ...user, storeRole: tenantUser?.role, pin: tenantUser?.pin };
  });

  // Change own password
  app.post('/me/change-password', async (request, reply) => {
    const schema = z.object({
      currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
      newPassword: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const user = await prisma.user.findUnique({ where: { id: request.userId } });
    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado.' });

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.password);
    if (!valid) {
      return reply.status(400).send({ error: 'Senha atual incorreta.' });
    }

    const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });

    return { message: 'Senha alterada com sucesso.' };
  });

  // Devices list
  app.get('/devices', async (request) => {
    const devices = await prisma.device.findMany({
      where: { tenantId: request.tenantId },
      orderBy: { lastSyncAt: 'desc' },
    });
    return devices;
  });
};
