import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { prisma } from '@sale360/db';
import { generateToken, generateRefreshToken } from '../../middleware/auth.js';
import { sendResetEmail } from '../../services/email.js';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  pin: z.string().length(4).optional(),
  deviceId: z.string().optional(),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Login with email + password
  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const { email, password, pin, deviceId } = parsed.data;

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({ error: 'Email ou senha incorretos' });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return reply.status(401).send({ error: 'Email ou senha incorretos' });
    }

    // SUPER_ADMIN login — no tenant context needed
    if (user.role === 'SUPER_ADMIN') {
      const token = generateToken({
        userId: user.id,
        role: 'SUPER_ADMIN',
      });
      const refreshToken = generateRefreshToken(user.id);

      return {
        token,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: 'SUPER_ADMIN',
        },
        tenant: null,
      };
    }

    // Find tenant (first one for simplicity; in production support multiple)
    const tenantUser = await prisma.tenantUser.findFirst({
      where: { userId: user.id },
      include: { tenant: true },
    });

    if (!tenantUser) {
      return reply.status(401).send({ error: 'Nenhuma empresa vinculada ao usuário' });
    }

    // If PIN provided, validate
    if (pin && tenantUser.pin !== pin) {
      return reply.status(401).send({ error: 'PIN incorreto' });
    }

    // If deviceId, register device
    if (deviceId) {
      await prisma.device.upsert({
        where: { tenantId_name: { tenantId: tenantUser.tenantId, name: deviceId } },
        update: { lastSyncAt: new Date() },
        create: {
          tenantId: tenantUser.tenantId,
          name: deviceId,
          type: 'mobile',
        },
      });
    }

    // Generate tokens
    const token = generateToken({
      userId: user.id,
      tenantId: tenantUser.tenantId,
      deviceId,
      role: tenantUser.role,
    });
    const refreshToken = generateRefreshToken(user.id);

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: tenantUser.role,
        pin: tenantUser.pin,
      },
      tenant: {
        id: tenantUser.tenant.id,
        slug: tenantUser.tenant.slug,
        companyName: tenantUser.tenant.companyName,
        plan: tenantUser.tenant.plan,
        status: tenantUser.tenant.status,
      },
    };
  });

  // Quick login with PIN (for PDV — less clicks)
  app.post('/login-pin', async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
      pin: z.string().length(4),
      deviceId: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos' });
    }

    const { email, pin, deviceId } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({ error: 'Credenciais inválidas' });
    }

    const tenantUser = await prisma.tenantUser.findFirst({
      where: { userId: user.id, pin },
      include: { tenant: true },
    });

    if (!tenantUser) {
      return reply.status(401).send({ error: 'PIN incorreto' });
    }

    if (deviceId) {
      await prisma.device.upsert({
        where: { tenantId_name: { tenantId: tenantUser.tenantId, name: deviceId } },
        update: { lastSyncAt: new Date() },
        create: {
          tenantId: tenantUser.tenantId,
          name: deviceId,
          type: 'mobile',
        },
      });
    }

    const token = generateToken({
      userId: user.id,
      tenantId: tenantUser.tenantId,
      deviceId,
      role: tenantUser.role,
    });

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: tenantUser.role },
      tenant: {
        id: tenantUser.tenant.id,
        companyName: tenantUser.tenant.companyName,
        plan: tenantUser.tenant.plan,
      },
    };
  });

  // Refresh token
  app.post('/refresh', async (request, reply) => {
    const schema = z.object({ refreshToken: z.string() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Refresh token inválido' });
    }

    try {
      const jwt = await import('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'sale360-dev-secret-change-in-production';
      const decoded = jwt.default.verify(parsed.data.refreshToken, secret) as { userId: string };

      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) {
        return reply.status(401).send({ error: 'Usuário não encontrado' });
      }

      const tenantUser = await prisma.tenantUser.findFirst({
        where: { userId: user.id },
        include: { tenant: true },
      });

      if (!tenantUser) {
        return reply.status(401).send({ error: 'Empresa não encontrada' });
      }

      const token = generateToken({
        userId: user.id,
        tenantId: tenantUser.tenantId,
        role: tenantUser.role,
      });

      return { token };
    } catch {
      return reply.status(401).send({ error: 'Refresh token inválido ou expirado' });
    }
  });
};
