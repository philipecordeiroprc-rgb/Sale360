import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';

const createCategorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  color: z.string().optional(),
  sortOrder: z.number().int().default(0),
  variationTemplateId: z.string().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

export const categoriesRoutes: FastifyPluginAsync = async (app) => {
  // List all categories
  app.get('/', async (request) => {
    const { search } = request.query as Record<string, string>;

    const where: any = { tenantId: request.tenantId };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const categories = await prisma.category.findMany({
      where,
      include: {
        _count: { select: { products: true } },
        variationTemplate: {
          include: { dimensions: { orderBy: { orderIndex: 'asc' } } },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return categories.map((cat) => ({
      ...cat,
      variationTemplate: cat.variationTemplate
        ? {
            ...cat.variationTemplate,
            dimensions: cat.variationTemplate.dimensions.map((d) => ({
              ...d,
              options: JSON.parse(d.options) as string[],
            })),
          }
        : null,
    }));
  });

  // Get single category
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const category = await prisma.category.findFirst({
      where: { id, tenantId: request.tenantId },
      include: {
        _count: { select: { products: true } },
      },
    });
    if (!category) return reply.status(404).send({ error: 'Categoria não encontrada' });
    return category;
  });

  // Create category
  app.post('/', async (request, reply) => {
    const parsed = createCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    // Check duplicate name
    const existing = await prisma.category.findFirst({
      where: { name: parsed.data.name, tenantId: request.tenantId },
    });
    if (existing) {
      return reply.status(409).send({ error: 'Já existe uma categoria com este nome' });
    }

    const category = await prisma.category.create({
      data: { ...parsed.data, tenantId: request.tenantId },
      include: { _count: { select: { products: true } } },
    });

    return reply.status(201).send(category);
  });

  // Update category
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos' });
    }

    const exists = await prisma.category.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!exists) return reply.status(404).send({ error: 'Categoria não encontrada' });

    // Check duplicate name if renaming
    if (parsed.data.name && parsed.data.name !== exists.name) {
      const duplicate = await prisma.category.findFirst({
        where: { name: parsed.data.name, tenantId: request.tenantId, id: { not: id } },
      });
      if (duplicate) {
        return reply.status(409).send({ error: 'Já existe uma categoria com este nome' });
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: parsed.data,
      include: { _count: { select: { products: true } } },
    });

    return category;
  });

  // Delete category
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const category = await prisma.category.findFirst({
      where: { id, tenantId: request.tenantId },
      include: { _count: { select: { products: true } } },
    });

    if (!category) return reply.status(404).send({ error: 'Categoria não encontrada' });

    if (category._count.products > 0) {
      return reply.status(400).send({
        error: `Não é possível excluir: ${category._count.products} produto(s) vinculado(s) a esta categoria`,
      });
    }

    await prisma.category.delete({ where: { id } });

    return { success: true };
  });
};
