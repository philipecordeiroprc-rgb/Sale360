import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';

export const integrationRoutes: FastifyPluginAsync = async (app) => {
  // List integrations for tenant
  app.get('/', async (request) => {
    const integrations = await prisma.integration.findMany({
      where: { tenantId: request.tenantId },
    });
    return integrations;
  });

  // Toggle integration
  app.patch('/:provider/toggle', async (request, reply) => {
    const { provider } = request.params as { provider: string };

    const integration = await prisma.integration.findFirst({
      where: { tenantId: request.tenantId, provider: provider as any },
    });

    if (!integration) {
      // Create it
      const created = await prisma.integration.create({
        data: {
          tenantId: request.tenantId,
          provider: provider as any,
          isActive: true,
        },
      });
      return created;
    }

    const updated = await prisma.integration.update({
      where: { id: integration.id },
      data: { isActive: !integration.isActive },
    });
    return updated;
  });

  // Update integration credentials
  app.put('/:provider', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const schema = z.object({
      accessToken: z.string().optional(),
      refreshToken: z.string().optional(),
      webhookUrl: z.string().optional(),
      config: z.any().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Dados inválidos' });

    const integration = await prisma.integration.upsert({
      where: { tenantId_provider: { tenantId: request.tenantId, provider: provider as any } },
      update: parsed.data,
      create: {
        tenantId: request.tenantId,
        provider: provider as any,
        ...parsed.data,
      },
    });

    return integration;
  });
};
