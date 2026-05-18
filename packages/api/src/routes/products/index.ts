import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';

const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  price: z.number().default(0),
  categoryId: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
});

const updateProductSchema = createProductSchema.partial();

export const productRoutes: FastifyPluginAsync = async (app) => {
  // List all products (with search & category filter)
  app.get('/', async (request) => {
    const { search, categoryId, active, variationName, page = '1', limit = '50' } = request.query as Record<string, string>;

    const where: any = { tenantId: request.tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search } },
        { sku: { contains: search } },
        // Also search in variation names
        { variations: { some: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    if (categoryId) where.categoryId = categoryId;
    if (active !== undefined) where.active = active === 'true';

    // Filter by specific variation name (e.g., "Preto", "2", "GG")
    if (variationName) {
      where.variations = { some: { name: { equals: variationName, mode: 'insensitive' } } };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, color: true, variationTemplate: { include: { dimensions: true } } } },
          variations: true,
        },
        orderBy: { name: 'asc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.product.count({ where }),
    ]);

    // Calculate realized margin from completed orders
    const productIds = products.map(p => p.id);
    let margins: Record<string, number> = {};
    if (productIds.length > 0) {
      const rows = await prisma.$queryRaw<{ productId: string; avgMargin: number }[]>`
        SELECT oi."productId",
          AVG(
            (oi."unitPrice" - COALESCE(oi."costPrice", 0) - (oi."unitPrice" * COALESCE(oi."taxRate", 0) / 100.0) - COALESCE(p."operationalCost", 0))
            / NULLIF(oi."unitPrice", 0) * 100
          ) as "avgMargin"
        FROM "order_items" oi
        JOIN "orders" o ON o.id = oi."orderId"
        JOIN "products" p ON p.id = oi."productId"
        WHERE oi."productId" = ANY(${productIds}::text[])
          AND o.status = 'COMPLETED'
          AND o."tenantId" = ${request.tenantId}::text
        GROUP BY oi."productId"
      `;
      for (const r of rows) {
        margins[r.productId] = Number(r.avgMargin);
      }
    }

    const productsWithMargin = products.map(p => ({
      ...p,
      avgMargin: margins[p.id] ?? null,
    }));

    return { products: productsWithMargin, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
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

  // --- Variation CRUD ---

  const variationSchema = z.object({
    name: z.string().min(1, 'Nome da variação é obrigatório'),
    priceModifier: z.number().default(0),
    stockQty: z.number().default(0),
    lowStockAt: z.number().optional(),
    sku: z.string().optional(),
    barcode: z.string().optional(),
  });

  // Add variation to product
  app.post('/:id/variations', async (request, reply) => {
    const { id } = request.params as { id: string };

    const product = await prisma.product.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!product) return reply.status(404).send({ error: 'Produto não encontrado' });

    const parsed = variationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const variation = await prisma.productVariation.create({
      data: { ...parsed.data, productId: id },
    });

    // Auto-set hasVariations flag
    if (!product.hasVariations) {
      await prisma.product.update({ where: { id }, data: { hasVariations: true } });
    }

    return reply.status(201).send(variation);
  });

  // Update variation
  app.put('/:id/variations/:variationId', async (request, reply) => {
    const { id, variationId } = request.params as { id: string; variationId: string };

    const product = await prisma.product.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!product) return reply.status(404).send({ error: 'Produto não encontrado' });

    const existing = await prisma.productVariation.findFirst({
      where: { id: variationId, productId: id },
    });
    if (!existing) return reply.status(404).send({ error: 'Variação não encontrada' });

    const parsed = variationSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos' });
    }

    const variation = await prisma.productVariation.update({
      where: { id: variationId },
      data: parsed.data,
    });

    return variation;
  });

  // Delete variation
  app.delete('/:id/variations/:variationId', async (request, reply) => {
    const { id, variationId } = request.params as { id: string; variationId: string };

    const product = await prisma.product.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!product) return reply.status(404).send({ error: 'Produto não encontrado' });

    const existing = await prisma.productVariation.findFirst({
      where: { id: variationId, productId: id },
    });
    if (!existing) return reply.status(404).send({ error: 'Variação não encontrada' });

    await prisma.productVariation.delete({ where: { id: variationId } });

    // Check if any variations remain, otherwise unset flag
    const remaining = await prisma.productVariation.count({ where: { productId: id } });
    if (remaining === 0) {
      await prisma.product.update({ where: { id }, data: { hasVariations: false } });
    }

    return { success: true };
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
