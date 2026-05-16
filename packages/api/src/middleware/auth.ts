import jwt from 'jsonwebtoken';
import { prisma } from '@sale360/db';
import type { FastifyRequest, FastifyReply } from 'fastify';

const JWT_SECRET = process.env.JWT_SECRET || 'sale360-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // 7 days for offline support

export interface JwtPayload {
  userId: string;
  tenantId: string;
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
    request.tenantId = payload.tenantId;
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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
}
