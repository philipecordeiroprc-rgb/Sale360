import jwt from 'jsonwebtoken';
import { prisma } from '@sale360/db';
import type { FastifyRequest, FastifyReply } from 'fastify';

export function getJwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET é obrigatório em produção. Defina a variável de ambiente JWT_SECRET.');
  }
  return 'sale360-dev-secret-change-in-production';
}
const JWT_SECRET = getJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // 7 days for offline support

export interface JwtPayload {
  userId: string;
  tenantId?: string;
  deviceId?: string;
  role: string;
}

// Augment Fastify request with tenant/user
declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
    userId: string;
    deviceId?: string;
    userRole: string;
  }
}

function extractToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = extractToken(request);

  if (!token) {
    reply.status(401).send({ error: 'Token não encontrado' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // SUPER_ADMIN — admin mode (no tenant) or store mode (has tenantId)
    if (payload.role === 'SUPER_ADMIN') {
      if (payload.tenantId) {
        // Store mode: verify tenant and act as store user
        const tenant = await prisma.tenant.findUnique({
          where: { id: payload.tenantId },
          select: { id: true, status: true },
        });
        if (!tenant) {
          reply.status(401).send({ error: 'Empresa não encontrada' });
          return;
        }
        if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') {
          reply.status(403).send({ error: 'Empresa indisponível' });
          return;
        }
        request.tenantId = payload.tenantId;
      } else {
        // Admin mode: no tenant context
        request.tenantId = '';
      }
      request.userId = payload.userId;
      request.deviceId = payload.deviceId;
      request.userRole = payload.role;
      return;
    }

    // Verify tenant exists and is active
    const tenant = await prisma.tenant.findUnique({
      where: { id: payload.tenantId },
      select: { id: true, status: true },
    });

    if (!tenant) {
      reply.status(401).send({ error: 'Empresa não encontrada' });
      return;
    }

    if (tenant.status === 'SUSPENDED') {
      reply.status(403).send({ error: 'Conta suspensa. Entre em contato com o suporte.' });
      return;
    }

    if (tenant.status === 'CANCELLED') {
      reply.status(403).send({ error: 'Conta cancelada' });
      return;
    }

    // Inject tenant info into request
    request.tenantId = payload.tenantId!;
    request.userId = payload.userId;
    request.deviceId = payload.deviceId;
    request.userRole = payload.role;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      reply.status(401).send({ error: 'Sessão expirada. Faça login novamente.' });
    } else {
      reply.status(401).send({ error: 'Token inválido' });
    }
  }
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as any);
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' } as any);
}

// Short-lived token for 2FA step (5 min expiry)
export function generateTwoFactorToken(payload: { userId: string; email: string }): string {
  return jwt.sign({ ...payload, type: '2fa' }, JWT_SECRET, { expiresIn: '5m' } as any);
}

export function verifyTwoFactorToken(token: string): { userId: string; email: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== '2fa') return null;
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}
