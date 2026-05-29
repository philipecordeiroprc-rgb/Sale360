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
      { type: 'SABOR', label: 'Sabor', options: ['Morango', 'Chocolate', 'Baunilha', 'Coco', 'Limão', 'Maracujá', 'Uva', 'Laranja', 'Abacaxi', 'Framboesa', 'Menta', 'Caramelo', 'Café', 'Avelã', 'Doce de Leite'], orderIndex: 1 },
    ],
  },
  {
    name: 'Peso (Granel/Alimentos)',
    dimensions: [
      { type: 'PESO', label: 'Peso', options: ['50g', '100g', '200g', '250g', '500g', '750g', '1kg', '2kg', '5kg', '10kg', '20kg', '50kg'], orderIndex: 0 },
      { type: 'SABOR', label: 'Sabor', options: ['Morango', 'Chocolate', 'Baunilha', 'Coco', 'Limão', 'Maracujá', 'Uva', 'Laranja', 'Abacaxi', 'Framboesa', 'Menta', 'Caramelo', 'Café', 'Avelã', 'Doce de Leite'], orderIndex: 1 },
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
  type: z.enum(['TAMANHO_LETRA', 'TAMANHO_NUMERO', 'COR', 'VOLUME', 'PESO', 'SABOR', 'PERSONALIZADO']),
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
  // Seed global templates if none exist
  async function ensureGlobalDefaults() {
    const existing = await prisma.variationTemplate.count({ where: { tenantId: null } });
    if (existing > 0) return;

    for (const t of DEFAULT_TEMPLATES) {
      await prisma.variationTemplate.create({
        data: {
          name: t.name,
          tenantId: null,
          dimensions: {
            create: t.dimensions.map((d) => ({
              type: d.type,
              label: d.label,
              options: JSON.stringify(d.options),
              orderIndex: d.orderIndex,
            })),
          },
        },
      });
    }
  }

  // List all templates (global + tenant-specific)
  app.get('/', async (request) => {
    await ensureGlobalDefaults();
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

    // Dedup: prefer tenant template over global when same name exists
    const deduped = templates.reduce((acc, t) => {
      const existing = acc.find((x: any) => x.name === t.name);
      if (!existing) {
        acc.push(t);
      } else if (t.tenantId !== null && existing.tenantId === null) {
        // Replace global default with tenant-specific template
        acc[acc.indexOf(existing)] = t;
      }
      return acc;
    }, [] as typeof templates);

    return deduped.map((t) => ({
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

  // Import variation templates (bulk)
  app.post('/import', async (request, reply) => {
    const { rows } = request.body as { rows: Record<string, string>[] };
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return reply.status(400).send({ error: 'Nenhuma linha para importar' });
    }

    const errors: { row: number; message: string }[] = [];
    const warnings: string[] = [];
    let imported = 0;

    // Group rows by template name
    const templateGroups = new Map<string, { dim1Type: string; dim1Label: string; dim1Options: string[]; dim2Type?: string; dim2Label?: string; dim2Options?: string[] }>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = (row['Nome do Template'] || '').trim();
      if (!name) {
        errors.push({ row: i, message: 'Nome do Template é obrigatório' });
        continue;
      }
      const dim1Type = (row['Dim 1 - Tipo'] || '').trim();
      const dim1Label = (row['Dim 1 - Rótulo'] || '').trim();
      const dim1Opts = (row['Dim 1 - Opções'] || '').split(',').map((s: string) => s.trim()).filter(Boolean);
      if (!dim1Type || !dim1Label || dim1Opts.length === 0) {
        errors.push({ row: i, message: 'Dim 1 - Tipo, Rótulo e Opções são obrigatórios' });
        continue;
      }
      const dim2Type = (row['Dim 2 - Tipo'] || '').trim() || undefined;
      const dim2Label = (row['Dim 2 - Rótulo'] || '').trim() || undefined;
      const dim2OptsStr = (row['Dim 2 - Opções'] || '').trim();
      const dim2Opts = dim2OptsStr ? dim2OptsStr.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined;

      templateGroups.set(name, { dim1Type, dim1Label, dim1Options: dim1Opts, dim2Type, dim2Label, dim2Options: dim2Opts });
    }

    if (templateGroups.size === 0 && errors.length > 0) {
      return reply.status(400).send({ imported: 0, errors, warnings });
    }

    for (const [name, config] of templateGroups) {
      try {
        // Check if template with this name already exists for this tenant
        const existing = await prisma.variationTemplate.findFirst({
          where: { name, tenantId: request.tenantId },
        });
        if (existing) {
          warnings.push(`Template "${name}" já existe — pulado`);
          continue;
        }

        const dimensions: { type: any; label: string; options: string; orderIndex: number }[] = [
          { type: config.dim1Type, label: config.dim1Label, options: JSON.stringify(config.dim1Options), orderIndex: 0 },
        ];
        if (config.dim2Type && config.dim2Label && config.dim2Options && config.dim2Options.length > 0) {
          dimensions.push({ type: config.dim2Type, label: config.dim2Label, options: JSON.stringify(config.dim2Options), orderIndex: 1 });
        }

        await prisma.variationTemplate.create({
          data: {
            name,
            tenantId: request.tenantId,
            dimensions: { create: dimensions },
          },
        });
        imported++;
      } catch (err: any) {
        errors.push({ row: -1, message: `Erro ao criar template "${name}": ${err.message}` });
      }
    }

    return reply.status(201).send({ imported, errors, warnings });
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
