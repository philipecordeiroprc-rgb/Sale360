import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';

const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  price: z.number().positive(),
  costPrice: z.number().optional(),
  unit: z.enum(['UN', 'KG', 'G', 'L', 'M']).default('UN'),
  stockQty: z.number().default(0),
  lowStockAt: z.number().optional(),
  categoryId: z.string().optional(),
  isFractional: z.boolean().default(false),
  hasVariations: z.boolean().default(false),
  imageUrl: z.string().optional(),
});

const updateProductSchema = createProductSchema.partial();

export const productRoutes: FastifyPluginAsync = async (app) => {
  // List all products (with search & category filter)
  app.get('/', async (request) => {
    const { search, categoryId, active, page = '1', limit = '50' } = request.query as Record<string, string>;

    const where: any = { tenantId: request.tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search } },
        { sku: { contains: search } },
      ];
    }

    if (categoryId) where.categoryId = categoryId;
    if (active !== undefined) where.active = active === 'true';

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, color: true } },
          variations: true,
        },
        orderBy: { name: 'asc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.product.count({ where }),
    ]);

    return { products, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
  });

  // Get single product
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await prisma.product.findFirst({
      where: { id, tenantId: request.tenantId },
      include: { category: true, variations: true },
    });
    if (!product) return reply.status(404).send({ error: 'Produto não encontrado' });
    return product;
  });

  // Create product
  app.post('/', async (request, reply) => {
    const parsed = createProductSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const product = await prisma.product.create({
      data: { ...parsed.data, tenantId: request.tenantId },
      include: { category: true },
    });

    return reply.status(201).send(product);
  });

  // Update product
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateProductSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos' });
    }

    const exists = await prisma.product.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!exists) return reply.status(404).send({ error: 'Produto não encontrado' });

    const product = await prisma.product.update({
      where: { id },
      data: parsed.data,
      include: { category: true, variations: true },
    });

    return product;
  });

  // Quick toggle active/inactive
  app.patch('/:id/toggle', async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await prisma.product.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!product) return reply.status(404).send({ error: 'Produto não encontrado' });

    const updated = await prisma.product.update({
      where: { id },
      data: { active: !product.active },
    });

    return updated;
  });

  // Search by barcode (for quick scan at PDV)
  app.get('/barcode/:code', async (request, reply) => {
    const { code } = request.params as { code: string };
    const product = await prisma.product.findFirst({
      where: { barcode: code, tenantId: request.tenantId, active: true },
      include: { category: true, variations: true },
    });
    if (!product) return reply.status(404).send({ error: 'Produto não encontrado para este código de barras' });
    return product;
  });

  // Delete product
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const product = await prisma.product.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!product) return reply.status(404).send({ error: 'Produto não encontrado' });

    await prisma.product.delete({ where: { id } });

    return { success: true };
  });

  // Bulk import (for migration / import from other systems)
  app.post('/bulk', async (request, reply) => {
    const schema = z.object({ products: z.array(createProductSchema) });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos' });
    }

    const products = await prisma.$transaction(
      parsed.data.products.map((p) =>
        prisma.product.create({
          data: { ...p, tenantId: request.tenantId },
        }),
      ),
    );

    return reply.status(201).send({ count: products.length });
  });
};
