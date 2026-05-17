import type { FastifyPluginAsync } from 'fastify';
import { prisma, DimensionType } from '@sale360/db';
import { z } from 'zod';

// Default presets for seed / new tenants
export const DEFAULT_TEMPLATES: {
  name: string;
  tenantId?: string;
  dimensions: { type: DimensionType; label: string; options: string[]; orderIndex: number }[];
}[] = [
  {
    name: 'Vestuário Adulto',
    dimensions: [
      { type: 'TAMANHO_LETRA', label: 'Tamanho', options: ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'], orderIndex: 0 },
      { type: 'TAMANHO_NUMERO', label: 'Tamanho (Núm.)', options: ['36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56'], orderIndex: 1 },
      { type: 'COR', label: 'Cor', options: ['Vermelho', 'Azul', 'Verde', 'Preto', 'Branco', 'Amarelo', 'Rosa', 'Cinza', 'Marrom', 'Laranja', 'Roxo', 'Bege'], orderIndex: 2 },
    ],
  },
  {
    name: 'Vestuário Infantil',
    dimensions: [
      { type: 'TAMANHO_NUMERO', label: 'Tamanho', options: ['2', '4', '6', '8', '10', '12', '14', '16', '18', '20'], orderIndex: 0 },
      { type: 'COR', label: 'Cor', options: ['Vermelho', 'Azul', 'Verde', 'Preto', 'Branco', 'Amarelo', 'Rosa', 'Cinza', 'Marrom', 'Laranja', 'Roxo', 'Bege'], orderIndex: 1 },
    ],
  },
  {
    name: 'Calçados',
    dimensions: [
      { type: 'TAMANHO_NUMERO', label: 'Tamanho', options: ['33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'], orderIndex: 0 },
      { type: 'COR', label: 'Cor', options: ['Preto', 'Branco', 'Marrom', 'Azul Marinho', 'Bege', 'Vermelho'], orderIndex: 1 },
    ],
  },
  {
    name: 'Volume (Líquidos)',
    dimensions: [
      { type: 'VOLUME', label: 'Volume', options: ['100ml', '200ml', '250ml', '300ml', '350ml', '500ml', '600ml', '750ml', '1L', '1.5L', '2L', '5L', '10L', '20L'], orderIndex: 0 },
    ],
  },
  {
    name: 'Peso (Granel/Alimentos)',
    dimensions: [
      { type: 'PESO', label: 'Peso', options: ['50g', '100g', '200g', '250g', '500g', '750g', '1kg', '2kg', '5kg', '10kg', '20kg', '50kg'], orderIndex: 0 },
    ],
  },
  {
    name: 'Unidades (Geral)',
    dimensions: [
      { type: 'PERSONALIZADO', label: 'Unidade', options: ['UN', 'PC', 'CX', 'PAR', 'FD', 'PCT'], orderIndex: 0 },
    ],
  },
];

const dimensionSchema = z.object({
  type: z.enum(['TAMANHO_LETRA', 'TAMANHO_NUMERO', 'COR', 'VOLUME', 'PESO', 'PERSONALIZADO']),
  label: z.string().min(1),
  options: z.array(z.string()).min(1),
  orderIndex: z.number().int().default(0),
});

const createTemplateSchema = z.object({
  name: z.string().min(1),
  dimensions: z.array(dimensionSchema).min(1),
});

const updateTemplateSchema = createTemplateSchema.partial();

export const variationTemplateRoutes: FastifyPluginAsync = async (app) => {
  // List all templates (global + tenant-specific)
  app.get('/', async (request) => {
    const templates = await prisma.variationTemplate.findMany({
      where: {
        OR: [
          { tenantId: null },           // global defaults
          { tenantId: request.tenantId }, // tenant custom
        ],
      },
      include: {
        dimensions: { orderBy: { orderIndex: 'asc' } },
      },
      orderBy: [{ tenantId: 'asc' }, { name: 'asc' }],
    });

    return templates.map((t) => ({
      ...t,
      dimensions: t.dimensions.map((d) => ({
        ...d,
        options: JSON.parse(d.options) as string[],
      })),
    }));
  });

  // Get single template
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const template = await prisma.variationTemplate.findFirst({
      where: {
        id,
        OR: [
          { tenantId: null },
          { tenantId: request.tenantId },
        ],
      },
      include: {
        dimensions: { orderBy: { orderIndex: 'asc' } },
      },
    });

    if (!template) return reply.status(404).send({ error: 'Template não encontrado' });
    return {
      ...template,
      dimensions: template.dimensions.map((d) => ({
        ...d,
        options: JSON.parse(d.options) as string[],
      })),
    };
  });

  // Create tenant-specific template
  app.post('/', async (request, reply) => {
    const parsed = createTemplateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const template = await prisma.variationTemplate.create({
      data: {
        name: parsed.data.name,
        tenantId: request.tenantId,
        dimensions: {
          create: parsed.data.dimensions.map((d) => ({
            type: d.type,
            label: d.label,
            options: JSON.stringify(d.options),
            orderIndex: d.orderIndex,
          })),
        },
      },
      include: { dimensions: { orderBy: { orderIndex: 'asc' } } },
    });

    return reply.status(201).send({
      ...template,
      dimensions: template.dimensions.map((d) => ({
        ...d,
        options: JSON.parse(d.options) as string[],
      })),
    });
  });

  // Update template (tenant-specific only)
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateTemplateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos' });
    }

    const existing = await prisma.variationTemplate.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!existing) return reply.status(404).send({ error: 'Template não encontrado' });

    // Update template
    const updateData: any = {};
    if (parsed.data.name) updateData.name = parsed.data.name;

    if (parsed.data.dimensions) {
      // Replace all dimensions (delete + recreate)
      await prisma.variationDimension.deleteMany({ where: { templateId: id } });
      await prisma.variationDimension.createMany({
        data: parsed.data.dimensions.map((d) => ({
          templateId: id,
          type: d.type,
          label: d.label,
          options: JSON.stringify(d.options),
          orderIndex: d.orderIndex,
        })),
      });
    }

    const template = await prisma.variationTemplate.update({
      where: { id },
      data: updateData,
      include: { dimensions: { orderBy: { orderIndex: 'asc' } } },
    });

    return {
      ...template,
      dimensions: template.dimensions.map((d) => ({
        ...d,
        options: JSON.parse(d.options) as string[],
      })),
    };
  });

  // Delete template (tenant-specific only)
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.variationTemplate.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!existing) return reply.status(404).send({ error: 'Template não encontrado' });

    await prisma.variationTemplate.delete({ where: { id } });
    return { success: true };
  });
};
