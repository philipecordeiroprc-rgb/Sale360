import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  price: z.number().default(0),
  lowStockAt: z.number().optional(),
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
          category: { select: { id: true, name: true, variationTemplate: { include: { dimensions: true } } } },
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
      const idList = productIds.map(id => `'${id}'`).join(',');
      const rows = await prisma.$queryRawUnsafe<{ productId: string; avgMargin: number }[]>(
        `SELECT oi."productId",
          AVG(
            (oi."unitPrice" - COALESCE(oi."costPrice", 0) - (oi."unitPrice" * COALESCE(oi."taxRate", 0) / 100.0) - COALESCE(p."operationalCost", 0))
            / NULLIF(oi."unitPrice", 0) * 100
          ) as "avgMargin"
        FROM "order_items" oi
        JOIN "orders" o ON o.id = oi."orderId"
        JOIN "products" p ON p.id = oi."productId"
        WHERE oi."productId" = ANY(ARRAY[${idList}]::text[])
          AND o.status = 'COMPLETED'
          AND o."tenantId" = '${request.tenantId}'
        GROUP BY oi."productId"`,
      );
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

  // Upload product image
  const uploadDir = path.resolve(process.cwd(), '../uploads');
  const productsDir = path.join(uploadDir, 'products');

  app.post('/:id/image', async (request, reply) => {
    const { id } = request.params as { id: string };

    const product = await prisma.product.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!product) return reply.status(404).send({ error: 'Produto não encontrado' });

    const file = await request.file();
    if (!file) return reply.status(400).send({ error: 'Nenhum arquivo enviado' });

    const ext = path.extname(file.filename).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      return reply.status(400).send({ error: 'Formato inválido. Use JPG, PNG ou WebP.' });
    }

    await fs.mkdir(productsDir, { recursive: true });

    const filename = `${request.tenantId}_${id}_${Date.now()}${ext}`;
    const filepath = path.join(productsDir, filename);

    await fs.writeFile(filepath, await file.toBuffer());

    // Remove old image if exists
    if (product.imageUrl) {
      const oldPath = path.join(uploadDir, product.imageUrl);
      fs.unlink(oldPath).catch(() => {});
    }

    const imageUrl = `products/${filename}`;
    await prisma.product.update({
      where: { id },
      data: { imageUrl },
    });

    return { imageUrl };
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

  // CSV Import — Simple products
  app.post('/import', async (request, reply) => {
    const { rows, mode, dim1Label, dim2Label } = request.body as {
      rows: Record<string, string>[];
      mode?: 'simple' | 'variations';
      dim1Label?: string;
      dim2Label?: string;
    };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return reply.status(400).send({ error: 'Nenhuma linha para importar' });
    }

    const errors: { row: number; message: string }[] = [];
    const warnings: string[] = [];
    let imported = 0;

    // Pre-fetch categories for name matching
    const categories = await prisma.category.findMany({
      where: { tenantId: request.tenantId },
      include: { variationTemplate: { include: { dimensions: true } } },
    });

    // Helper: parse Brazilian decimal
    const parseDecimal = (v: string | undefined): number => {
      if (!v || v.trim() === '') return 0;
      const cleaned = v.trim().replace(/\./g, '').replace(',', '.');
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    };

    // Helper: parse SIM/NAO
    const parseSim = (v: string | undefined, defaultVal = true): boolean => {
      if (!v || v.trim() === '') return defaultVal;
      const upper = v.trim().toUpperCase();
      return upper === 'SIM' || upper === 'S' || upper === 'YES';
    };

    // Helper: validate unit
    const validUnits = ['UN', 'KG', 'G', 'L', 'ML', 'M', 'PC', 'CX', 'PAR', 'FD', 'PCT', 'M2'];
    const parseUnit = (v: string | undefined): string => {
      if (!v || v.trim() === '') return 'UN';
      const upper = v.trim().toUpperCase();
      return validUnits.includes(upper) ? upper : 'UN';
    };

    if (mode === 'variations') {
      // ============================================================
      // VARIATIONS MODE
      // ============================================================
      const dim1 = dim1Label || 'Tamanho';
      const dim2 = dim2Label || undefined;

      // Group rows by product name
      const productGroups = new Map<string, { row: Record<string, string>; variations: Record<string, string>[] }[]>();
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const nomeProduto = (row['Nome do Produto'] || '').trim();
        if (!nomeProduto) {
          errors.push({ row: i, message: 'Nome do Produto é obrigatório' });
          continue;
        }

        let group = productGroups.get(nomeProduto.toLowerCase());
        if (!group) {
          group = [];
          productGroups.set(nomeProduto.toLowerCase(), group);
        }
        group.push({ row, variations: [] });
      }

      for (const [groupName, groupRows] of productGroups) {
        try {
          const firstRow = groupRows[0].row;
          const nomeProduto = firstRow['Nome do Produto']?.trim();
          const categoriaNome = (firstRow['Categoria'] || '').trim();
          const precoBase = parseDecimal(firstRow['Preço Base']);

          if (!precoBase) {
            errors.push({ row: -1, message: `Produto "${nomeProduto}": Preço Base inválido` });
            continue;
          }

          // Resolve category
          let categoryId: string | undefined;
          let variationTemplate: any;
          if (categoriaNome) {
            const cat = categories.find((c: any) => c.name.toLowerCase() === categoriaNome.toLowerCase());
            if (cat) {
              categoryId = cat.id;
              variationTemplate = cat.variationTemplate;
            } else {
              warnings.push(`Categoria "${categoriaNome}" não encontrada para o produto "${nomeProduto}"`);
            }
          }

          // Create product
          const product = await prisma.product.create({
            data: {
              tenantId: request.tenantId,
              name: nomeProduto,
              price: precoBase,
              categoryId,
              hasVariations: true,
              active: true,
              stockQty: 0, // summed from variations below
            },
          });

          // Create variations
          let totalStock = 0;
          for (let vi = 0; vi < groupRows.length; vi++) {
            const r = groupRows[vi].row;
            const dim1Val = (r[dim1] || '').trim();
            const dim2Val = dim2 ? (r[dim2] || '').trim() : '';
            const variationName = dim2Val ? `${dim1Val} ${dim2Val}` : dim1Val;
            const qtd = parseDecimal(r['Qtd']);
            const priceModifier = parseDecimal(r['Preço Extra']);
            const sku = (r['SKU'] || '').trim() || undefined;
            const barcode = (r['Código de Barras'] || '').trim() || undefined;
            const lowStock = parseDecimal(r['Estoque Mínimo']) || undefined;

            if (!variationName || qtd < 0) {
              warnings.push(`Produto "${nomeProduto}", linha ${vi + 1}: variação inválida, pulada`);
              continue;
            }

            await prisma.productVariation.create({
              data: {
                productId: product.id,
                name: variationName,
                priceModifier,
                stockQty: qtd,
                lowStockAt: lowStock,
                sku,
                barcode,
              },
            });
            totalStock += qtd;
          }

          // Update product total stock
          await prisma.product.update({
            where: { id: product.id },
            data: { stockQty: totalStock },
          });

          imported++;
        } catch (err: any) {
          errors.push({ row: -1, message: `Erro ao criar produto "${groupName}": ${err.message}` });
        }
      }
    } else {
      // ============================================================
      // SIMPLE MODE
      // ============================================================
      const toCreate: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = (row['Nome'] || '').trim();
        if (!name) {
          errors.push({ row: i, message: 'Nome é obrigatório' });
          continue;
        }

        const precoVenda = parseDecimal(row['Preço de Venda']);
        if (!precoVenda && precoVenda !== 0) {
          errors.push({ row: i, message: 'Preço de Venda é obrigatório' });
          continue;
        }

        // Resolve category by name
        let categoryId: string | undefined;
        const categoriaNome = (row['Categoria'] || '').trim();
        if (categoriaNome) {
          const cat = categories.find((c: any) => c.name.toLowerCase() === categoriaNome.toLowerCase());
          if (cat) {
            categoryId = cat.id;
          } else {
            warnings.push(`Linha ${i + 1}: Categoria "${categoriaNome}" não encontrada`);
          }
        }

        toCreate.push({
          tenantId: request.tenantId,
          name,
          description: (row['Descrição'] || '').trim() || undefined,
          sku: (row['SKU'] || '').trim() || undefined,
          barcode: (row['Código de Barras'] || '').trim() || undefined,
          categoryId,
          price: precoVenda,
          costPrice: parseDecimal(row['Custo Unitário']) || undefined,
          operationalCost: parseDecimal(row['Custo Operacional']) || undefined,
          taxRate: parseDecimal(row['Taxa (%)']) || undefined,
          stockQty: parseDecimal(row['Estoque Inicial']) || 0,
          lowStockAt: parseDecimal(row['Estoque Mínimo']) || undefined,
          unit: parseUnit(row['Unidade']),
          active: parseSim(row['Ativo'], true),
          isFractional: parseSim(row['Fracionado'], false),
        });
      }

      // Create in transaction
      for (const item of toCreate) {
        try {
          await prisma.product.create({ data: item });
          imported++;
        } catch (err: any) {
          errors.push({ row: -1, message: `Erro ao criar produto "${item.name}": ${err.message}` });
        }
      }
    }

    return reply.status(201).send({ imported, errors, warnings });
  });
};
