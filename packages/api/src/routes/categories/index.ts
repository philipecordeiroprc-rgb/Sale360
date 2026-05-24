import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';

const createCategorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  sortOrder: z.number().int().default(0),
  variationTemplateId: z.string().optional(),
});

const updateCategorySchema = createCategorySchema.extend({
  variationTemplateId: z.string().nullable().optional(),
}).partial();

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
        variationTemplate: {
          include: { dimensions: { orderBy: { orderIndex: 'asc' } } },
        },
      },
    });
    if (!category) return reply.status(404).send({ error: 'Categoria não encontrada' });
    return {
      ...category,
      variationTemplate: category.variationTemplate
        ? {
            ...category.variationTemplate,
            dimensions: category.variationTemplate.dimensions.map((d) => ({
              ...d,
              options: JSON.parse(d.options) as string[],
            })),
          }
        : null,
    };
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

  // Import categories (bulk)
  app.post('/import', async (request, reply) => {
    const { rows } = request.body as { rows: Record<string, string>[] };
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return reply.status(400).send({ error: 'Nenhuma linha para importar' });
    }

    const errors: { row: number; message: string }[] = [];
    const warnings: string[] = [];
    let imported = 0;
    const toCreate: { name: string; sortOrder: number; variationTemplateId?: string }[] = [];

    // Pre-fetch variation templates for name matching
    const templates = await prisma.variationTemplate.findMany({
      where: { OR: [{ tenantId: request.tenantId }, { tenantId: null }] },
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = (row['Nome'] || '').trim();
      if (!name) {
        errors.push({ row: i, message: 'Nome é obrigatório' });
        continue;
      }
      const sortOrder = parseInt((row['Ordem'] || '0').trim(), 10) || 0;
      const templateName = (row['Template de Variação'] || '').trim();

      let variationTemplateId: string | undefined;
      if (templateName) {
        const found = templates.find((t: any) => t.name.toLowerCase() === templateName.toLowerCase());
        if (found) {
          variationTemplateId = found.id;
        } else {
          warnings.push(`Linha ${i + 1}: Template "${templateName}" não encontrado — categoria "${name}" importada sem template`);
        }
      }

      toCreate.push({ name, sortOrder, variationTemplateId });
    }

    // Create in batches (skip duplicate names with warning)
    for (const cat of toCreate) {
      try {
        const existing = await prisma.category.findFirst({
          where: { name: cat.name, tenantId: request.tenantId },
        });
        if (existing) {
          warnings.push(`Categoria "${cat.name}" já existe — pulada`);
          continue;
        }
        await prisma.category.create({
          data: { name: cat.name, sortOrder: cat.sortOrder, variationTemplateId: cat.variationTemplateId, tenantId: request.tenantId },
        });
        imported++;
      } catch (err: any) {
        errors.push({ row: -1, message: `Erro ao criar categoria "${cat.name}": ${err.message}` });
      }
    }

    return reply.status(201).send({ imported, errors, warnings });
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
