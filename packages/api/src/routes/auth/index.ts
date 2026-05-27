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
  deviceId: z.string().optional(),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Login with email + password
  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const { email, password, deviceId } = parsed.data;

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

    // Check if user must change password
    const mustChangePassword = user.forcePasswordChange === true;

    // SUPER_ADMIN login — also load linked stores for hybrid access
    if (user.role === 'SUPER_ADMIN') {
      const token = generateToken({
        userId: user.id,
        role: 'SUPER_ADMIN',
      });
      const refreshToken = generateRefreshToken(user.id);

      // Load linked stores (if any) so SUPER_ADMIN can switch between stores and admin
      const tenantUsers = await prisma.tenantUser.findMany({
        where: { userId: user.id },
        include: { tenant: true },
        orderBy: { tenant: { companyName: 'asc' } },
      });

      const tenants = tenantUsers.map((tu) => ({
        id: tu.tenant.id,
        slug: tu.tenant.slug,
        companyName: tu.tenant.companyName,
        plan: tu.tenant.plan,
        status: tu.tenant.status,
        role: tu.role,
      }));

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
        tenants: tenants.length > 0 ? tenants : undefined,
        mustChangePassword,
      };
    }

    // Find all tenants for this user
    const tenantUsers = await prisma.tenantUser.findMany({
      where: { userId: user.id },
      include: { tenant: true },
      orderBy: { tenant: { companyName: 'asc' } },
    });

    if (tenantUsers.length === 0) {
      return reply.status(401).send({ error: 'Nenhuma empresa vinculada ao usuário' });
    }

    // Build tenants list
    const tenants = tenantUsers.map((tu) => ({
      id: tu.tenant.id,
      slug: tu.tenant.slug,
      companyName: tu.tenant.companyName,
      plan: tu.tenant.plan,
      status: tu.tenant.status,
      role: tu.role,
    }));

    // Pick first tenant as default
    const selectedTu = tenantUsers[0];

    // If deviceId, register device
    if (deviceId) {
      await prisma.device.upsert({
        where: { tenantId_name: { tenantId: selectedTu.tenantId, name: deviceId } },
        update: { lastSyncAt: new Date() },
        create: {
          tenantId: selectedTu.tenantId,
          name: deviceId,
          type: 'mobile',
        },
      });
    }

    // Generate tokens with selected tenant
    const token = generateToken({
      userId: user.id,
      tenantId: selectedTu.tenantId,
      deviceId,
      role: selectedTu.role,
    });
    const refreshToken = generateRefreshToken(user.id);

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: selectedTu.role,
      },
      tenant: {
        id: selectedTu.tenant.id,
        slug: selectedTu.tenant.slug,
        companyName: selectedTu.tenant.companyName,
        plan: selectedTu.tenant.plan,
        status: selectedTu.tenant.status,
      },
      tenants,
      mustChangePassword,
    };
  });

  // Forgot password
  app.post('/forgot-password', async (request, reply) => {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Email inválido' });
    }

    const { email } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to avoid email enumeration
    if (!user) {
      return { message: 'Se o email estiver cadastrado, você receberá um link de recuperação.' };
    }

    // Generate token (1 hour expiry)
    const token = randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const result = await sendResetEmail(email, token, user.name);

    if (!result.success) {
      console.log('[AUTH] Email not sent, reset link:', result.link);
    }

    return {
      message: 'Se o email estiver cadastrado, você receberá um link de recuperação.',
      emailSent: result.success,
      resetLink: result.success ? undefined : result.link,
    };
  });

  // Reset password
  app.post('/reset-password', async (request, reply) => {
    const schema = z.object({
      token: z.string().min(1),
      password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos. A senha deve ter no mínimo 6 caracteres.' });
    }

    const { token, password } = parsed.data;

    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return reply.status(400).send({ error: 'Token inválido ou expirado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'Senha redefinida com sucesso.' };
  });

  // Switch tenant (for users with multiple stores, or SUPER_ADMIN switching store/admin mode)
  app.post('/switch-tenant', async (request, reply) => {
    const schema = z.object({
      tenantId: z.string().min(1),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'tenantId é obrigatório' });
    }

    // Extract userId from JWT
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Token não encontrado' });
    }

    try {
      const jwt = await import('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'sale360-dev-secret-change-in-production';
      const payload = jwt.default.verify(authHeader.slice(7), secret) as { userId: string; role?: string };

      // SUPER_ADMIN switching to admin mode
      if (payload.role === 'SUPER_ADMIN' && parsed.data.tenantId === '__admin__') {
        const token = generateToken({
          userId: payload.userId,
          role: 'SUPER_ADMIN',
        });
        const refreshToken = generateRefreshToken(payload.userId);

        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { id: true, name: true, email: true, role: true },
        });

        return {
          token,
          refreshToken,
          user: user ? { id: user.id, role: 'SUPER_ADMIN' as const } : { id: payload.userId, role: 'SUPER_ADMIN' as const },
          tenant: null,
        };
      }

      // SUPER_ADMIN switching to a store — use TenantUser role if linked, else OWNER
      if (payload.role === 'SUPER_ADMIN') {
        const tenant = await prisma.tenant.findUnique({ where: { id: parsed.data.tenantId } });
        if (!tenant) return reply.status(404).send({ error: 'Empresa não encontrada.' });
        if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') {
          return reply.status(403).send({ error: 'Empresa indisponível' });
        }

        // If SUPER_ADMIN has a specific TenantUser record, use that role (e.g. CASHIER)
        const tenantUser = await prisma.tenantUser.findUnique({
          where: { tenantId_userId: { tenantId: tenant.id, userId: payload.userId } },
        });
        const storeRole = tenantUser?.role || 'OWNER';

        const token = generateToken({
          userId: payload.userId,
          tenantId: tenant.id,
          role: 'SUPER_ADMIN',
        });
        const refreshToken = generateRefreshToken(payload.userId);

        return {
          token,
          refreshToken,
          user: { id: payload.userId, role: 'SUPER_ADMIN' as const },
          tenant: {
            id: tenant.id,
            slug: tenant.slug,
            companyName: tenant.companyName,
            plan: tenant.plan,
            status: tenant.status,
            role: storeRole,
          },
        };
      }

      // Regular user: verify user belongs to this tenant
      const tenantUser = await prisma.tenantUser.findFirst({
        where: { userId: payload.userId, tenantId: parsed.data.tenantId },
        include: { tenant: true },
      });

      if (!tenantUser) {
        return reply.status(403).send({ error: 'Acesso negado para esta empresa' });
      }

      // Verify tenant status
      if (tenantUser.tenant.status === 'SUSPENDED' || tenantUser.tenant.status === 'CANCELLED') {
        return reply.status(403).send({ error: 'Empresa indisponível' });
      }

      // Generate new token with selected tenant
      const token = generateToken({
        userId: payload.userId,
        tenantId: tenantUser.tenantId,
        role: tenantUser.role,
      });
      const refreshToken = generateRefreshToken(payload.userId);

      return {
        token,
        refreshToken,
        user: {
          id: payload.userId,
          role: tenantUser.role,
        },
        tenant: {
          id: tenantUser.tenant.id,
          slug: tenantUser.tenant.slug,
          companyName: tenantUser.tenant.companyName,
          plan: tenantUser.tenant.plan,
          status: tenantUser.tenant.status,
        },
      };
    } catch {
      return reply.status(401).send({ error: 'Token inválido ou expirado' });
    }
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
