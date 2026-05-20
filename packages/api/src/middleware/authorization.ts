import type { FastifyRequest, FastifyReply } from 'fastify';
import { hasPermission } from '@sale360/core';

export function requirePermission(...permissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const role = request.userRole;
    const allowed = permissions.some(p => hasPermission(role, p));
    if (!allowed) {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }
  };
}
