import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';

const batchUpdateSchema = z.object({
  configs: z.array(z.object({
    paymentMethod: z.enum(['cash', 'pix', 'debit', 'credit', 'credit_store', 'meal_voucher', 'food_voucher']),
    taxRate: z.number().min(0).max(100),
  })),
});

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  pix: 'Pix',
  debit: 'Débito',
  credit: 'Crédito',
  credit_store: 'Fiado',
  meal_voucher: 'Voucher Refeição',
  food_voucher: 'Voucher Alimentação',
};

export const paymentConfigRoutes: FastifyPluginAsync = async (app) => {
  // List all configs for the tenant
  app.get('/', async (request) => {
    const configs = await prisma.paymentMethodConfig.findMany({
      where: { tenantId: request.tenantId },
    });

    // Return with labels, fill missing defaults
    return Object.entries(PAYMENT_METHOD_LABELS).map(([method, label]) => {
      const existing = configs.find((c) => c.paymentMethod === method);
      return {
        paymentMethod: method,
        label,
        taxRate: existing ? Number(existing.taxRate) : 0,
      };
    });
  });

  // Batch upsert configs
  app.put('/', async (request, reply) => {
    const parsed = batchUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const { configs } = parsed.data;

    await prisma.$transaction(
      configs.map((c) =>
        prisma.paymentMethodConfig.upsert({
          where: {
            tenantId_paymentMethod: {
              tenantId: request.tenantId,
              paymentMethod: c.paymentMethod,
            },
          },
          create: {
            tenantId: request.tenantId,
            paymentMethod: c.paymentMethod,
            taxRate: c.taxRate,
          },
          update: { taxRate: c.taxRate },
        })
      )
    );

    // Return updated list
    const all = await prisma.paymentMethodConfig.findMany({
      where: { tenantId: request.tenantId },
    });

    return Object.entries(PAYMENT_METHOD_LABELS).map(([method, label]) => {
      const existing = all.find((c) => c.paymentMethod === method);
      return {
        paymentMethod: method,
        label,
        taxRate: existing ? Number(existing.taxRate) : 0,
      };
    });
  });
};
