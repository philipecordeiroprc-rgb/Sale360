import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';

const purchaseItemSchema = z.object({
  productId: z.string().optional(),
  variationId: z.string().optional(),
  productName: z.string().min(1, 'Nome do produto é obrigatório'),
  quantity: z.number().positive('Quantidade deve ser positiva'),
  unitCost: z.number().min(0, 'Custo unitário não pode ser negativo'),
  total: z.number(),
  salePrice: z.number().optional(),
  operationalCost: z.number().optional(),
  taxRatePct: z.number().optional(),
  marginPct: z.number().optional(),
});

const createPurchaseSchema = z.object({
  supplierId: z.string().min(1, 'Fornecedor é obrigatório'),
  customerId: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1, 'Pelo menos 1 item é obrigatório'),
  discount: z.number().default(0),
  notes: z.string().optional(),
});

export const purchaseRoutes: FastifyPluginAsync = async (app) => {
  // List purchases
  app.get('/', async (request) => {
    const {
      status,
      supplierId,
      startDate,
      endDate,
      page = '1',
      limit = '20',
    } = request.query as Record<string, string>;

    const where: any = { tenantId: request.tenantId };
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } },
          items: true,
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.purchase.count({ where }),
    ]);

    return { purchases, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
  });

  // Get single purchase
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const purchase = await prisma.purchase.findFirst({
      where: { id, tenantId: request.tenantId },
      include: {
        supplier: true,
        items: {
          include: {
            product: { select: { id: true, name: true, unit: true, stockQty: true } },
            variation: { select: { id: true, name: true, stockQty: true } },
          },
        },
      },
    });
    if (!purchase) return reply.status(404).send({ error: 'Compra não encontrada' });
    return purchase;
  });

  // Create purchase (DRAFT)
  app.post('/', async (request, reply) => {
    const parsed = createPurchaseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const { items, supplierId, customerId, discount, notes } = parsed.data;

    // Validate supplier belongs to tenant
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId: request.tenantId },
    });
    if (!supplier) return reply.status(404).send({ error: 'Fornecedor não encontrado' });

    // Validate customer if provided
    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, tenantId: request.tenantId },
      });
      if (!customer) return reply.status(404).send({ error: 'Cliente não encontrado' });
    }

    // Calculate totals
    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const total = subtotal - discount;

    // Generate order number
    const lastPurchase = await prisma.purchase.findFirst({
      where: { tenantId: request.tenantId },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const orderNumber = (lastPurchase?.orderNumber || 0) + 1;

    const purchase = await prisma.purchase.create({
      data: {
        tenantId: request.tenantId,
        supplierId,
        customerId: customerId || undefined,
        orderNumber,
        status: 'DRAFT',
        subtotal,
        discount,
        total,
        notes,
        items: {
          create: items.map((item) => ({
            productId: item.productId || undefined,
            variationId: item.variationId || undefined,
            productName: item.productName,
            quantity: item.quantity,
            unitCost: item.unitCost,
            total: item.total,
            salePrice: item.salePrice || undefined,
            operationalCost: item.operationalCost || undefined,
            taxRatePct: item.taxRatePct || undefined,
            marginPct: item.marginPct || undefined,
          })),
        },
      },
      include: {
        items: true,
        supplier: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
      },
    });

    // Update product pricing for items with salePrice
    for (const item of items) {
      if (item.productId && item.salePrice && item.salePrice > 0) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            price: item.salePrice,
            taxRate: item.taxRatePct || undefined,
            operationalCost: item.operationalCost || undefined,
          },
        });
      }
    }

    return reply.status(201).send(purchase);
  });

  // Update purchase (only DRAFT)
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const purchase = await prisma.purchase.findFirst({
      where: { id, tenantId: request.tenantId },
      include: { items: true },
    });
    if (!purchase) return reply.status(404).send({ error: 'Compra não encontrada' });
    if (purchase.status !== 'DRAFT') {
      return reply.status(400).send({ error: 'Apenas compras em rascunho podem ser editadas' });
    }

    const parsed = createPurchaseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const { items, supplierId, discount, notes } = parsed.data;
    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const total = subtotal - discount;

    // Replace items: delete old, create new
    await prisma.$transaction(async (tx) => {
      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

      await tx.purchase.update({
        where: { id },
        data: {
          supplierId,
          subtotal,
          discount,
          total,
          notes,
          items: {
            create: items.map((item) => ({
              productId: item.productId || undefined,
              variationId: item.variationId || undefined,
              productName: item.productName,
              quantity: item.quantity,
              unitCost: item.unitCost,
              total: item.total,
              salePrice: item.salePrice || undefined,
              operationalCost: item.operationalCost || undefined,
              taxRatePct: item.taxRatePct || undefined,
              marginPct: item.marginPct || undefined,
            })),
          },
        },
      });
    });

    const updated = await prisma.purchase.findFirst({
      where: { id },
      include: { items: true, supplier: { select: { id: true, name: true } } },
    });

    return updated;
  });

  // Receive purchase — PEPS core: creates InventoryBatches + Movements
  app.post('/:id/receive', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { itemExpiryDates } = (request.body || {}) as { itemExpiryDates?: Record<string, string | null> };

    // Quick existence check (status validation happens atomically inside transaction)
    const purchaseExists = await prisma.purchase.findFirst({
      where: { id, tenantId: request.tenantId },
      select: { id: true, status: true },
    });
    if (!purchaseExists) return reply.status(404).send({ error: 'Compra não encontrada' });
    if (purchaseExists.status === 'CANCELLED') {
      return reply.status(400).send({ error: 'Compra cancelada não pode ser recebida' });
    }
    if (purchaseExists.status === 'RECEIVED') {
      return reply.status(400).send({ error: 'Compra já foi recebida' });
    }

    const receivedAt = new Date();

    try {
      await prisma.$transaction(async (tx) => {
        // Atomic guard: only proceed if still DRAFT (prevents TOCTOU race condition)
        const result = await tx.purchase.updateMany({
          where: { id, status: 'DRAFT' },
          data: { status: 'RECEIVED', receivedAt },
        });
        if (result.count === 0) {
          throw new Error('DUPLICATE_RECEIVE');
        }

        // Re-read items inside transaction after lock is acquired
        const purchase = await tx.purchase.findFirst({
          where: { id },
          include: { items: true },
        });
        if (!purchase) throw new Error('PURCHASE_NOT_FOUND');

      // For each item, resolve variations first, then create batches
      for (const item of purchase.items) {
        let variationId = item.variationId || undefined;

        // If no variationId but product name has " - ", find or create variation
        if (!variationId && item.productId && item.productName.includes(' - ')) {
          const varName = item.productName.split(' - ').slice(1).join(' - ');
          // Try existing variation first to avoid duplicates
          const existingVar = await tx.productVariation.findFirst({
            where: { productId: item.productId, name: varName },
          });
          if (existingVar) {
            variationId = existingVar.id;
            await tx.purchaseItem.update({
              where: { id: item.id },
              data: { variationId: existingVar.id },
            });
          } else {
            const newVar = await tx.productVariation.create({
              data: {
                productId: item.productId,
                name: varName,
                stockQty: 0,
              },
            });
            variationId = newVar.id;
            await tx.purchaseItem.update({
              where: { id: item.id },
              data: { variationId: newVar.id },
            });
            await tx.product.update({
              where: { id: item.productId },
              data: { hasVariations: true },
            });
          }
        }

        // Update variation stock
        if (variationId) {
          await tx.productVariation.update({
            where: { id: variationId },
            data: { stockQty: { increment: item.quantity } },
          });
        }

        // Create batch with correct variationId and optional expiry date
        const batchExpiry = itemExpiryDates?.[item.id] ? new Date(itemExpiryDates[item.id]!) : undefined;
        await tx.inventoryBatch.create({
          data: {
            tenantId: request.tenantId,
            productId: item.productId || undefined,
            variationId,
            purchaseItemId: item.id,
            quantity: item.quantity,
            remainingQty: item.quantity,
            unitCost: item.unitCost,
            receivedAt,
            expiryDate: batchExpiry || undefined,
          },
        });

        // Create movement with correct variationId
        await tx.inventoryMovement.create({
          data: {
            tenantId: request.tenantId,
            productId: item.productId || undefined,
            variationId,
            type: 'PURCHASE_IN',
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.total,
            purchaseId: id,
            notes: `Compra #${purchase.orderNumber} - ${item.productName}`,
          },
        });

        // Update product stock and cost price
        if (item.productId) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product) {
            const currentStock = Number(product.stockQty);
            const currentCost = Number(product.costPrice || 0);
            const newStock = currentStock + Number(item.quantity);
            const weightedCost = currentStock > 0
              ? (currentStock * currentCost + Number(item.quantity) * Number(item.unitCost)) / newStock
              : Number(item.unitCost);

            await tx.product.update({
              where: { id: item.productId },
              data: {
                stockQty: { increment: item.quantity },
                costPrice: Math.round(weightedCost * 100) / 100,
              },
            });
          }
        }
      }
    });

    // Return updated purchase
    const updated = await prisma.purchase.findFirst({
      where: { id },
      include: { items: true, supplier: true },
    });

    return reply.status(200).send(updated);
  });

  // Import purchases (bulk CSV)
  app.post('/import', async (request, reply) => {
    const { rows } = request.body as { rows: Record<string, string>[] };
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return reply.status(400).send({ error: 'Nenhuma linha para importar' });
    }

    const errors: { row: number; message: string }[] = [];
    const warnings: string[] = [];
    let imported = 0;

    // Helper: parse Brazilian decimal
    const parseDecimal = (v: string | undefined): number => {
      if (!v || v.trim() === '') return 0;
      const cleaned = v.trim().replace(/\./g, '').replace(',', '.');
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    };

    // Helper: parse DD/MM/AAAA
    const parseDate = (v: string | undefined): Date | null => {
      if (!v || v.trim() === '') return null;
      const parts = v.trim().split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts.map(Number);
        const d = new Date(year, month - 1, day);
        if (!isNaN(d.getTime())) return d;
      }
      // Try ISO format
      const d = new Date(v.trim());
      return isNaN(d.getTime()) ? null : d;
    };

    // Pre-fetch suppliers and products for name matching
    const suppliers = await prisma.supplier.findMany({ where: { tenantId: request.tenantId } });
    const products = await prisma.product.findMany({
      where: { tenantId: request.tenantId },
      include: { variations: true },
    });

    // Group rows by (orderNumber + supplierId)
    interface GroupKey { orderNumber: string; supplierId: string; supplierName: string; }
    const groups = new Map<string, { key: GroupKey; items: { row: Record<string, string>; rowIndex: number }[] }>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const orderNumber = (row['Nº Pedido'] || '').trim();
      const supplierName = (row['Fornecedor'] || '').trim();
      const productName = (row['Produto'] || '').trim();

      if (!orderNumber) { errors.push({ row: i, message: 'Nº Pedido é obrigatório' }); continue; }
      if (!supplierName) { errors.push({ row: i, message: 'Fornecedor é obrigatório' }); continue; }
      if (!productName) { errors.push({ row: i, message: 'Produto é obrigatório' }); continue; }

      const supplier = suppliers.find((s: any) => s.name.toLowerCase() === supplierName.toLowerCase());
      if (!supplier) { errors.push({ row: i, message: `Fornecedor "${supplierName}" não encontrado` }); continue; }

      // Check product exists
      const product = products.find((p: any) => p.name.toLowerCase() === productName.toLowerCase());
      if (!product) { errors.push({ row: i, message: `Produto "${productName}" não encontrado` }); continue; }

      const groupKey = `${orderNumber}__${supplier.id}`;
      let group = groups.get(groupKey);
      if (!group) {
        group = { key: { orderNumber, supplierId: supplier.id, supplierName: supplier.name }, items: [] };
        groups.set(groupKey, group);
      }
      group.items.push({ row, rowIndex: i });
    }

    // Generate order numbers sequentially per tenant
    const maxOrder = await prisma.purchase.findFirst({
      where: { tenantId: request.tenantId },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    let nextOrderNumber = (maxOrder?.orderNumber || 0) + 1;

    // Process each purchase group in a transaction
    for (const [_, group] of groups) {
      try {
        await prisma.$transaction(async (tx) => {
          const { orderNumber: _on, supplierId, supplierName } = group.key;

          // Calculate totals
          let subtotal = 0;
          const purchaseItems: any[] = [];
          const batchItems: { productId: string; variationId?: string; variationName?: string; productName: string; quantity: number; unitCost: number; salePrice?: number; receivedAt: Date }[] = [];

          for (const { row, rowIndex } of group.items) {
            const productName = (row['Produto'] || '').trim();
            const variacaoNome = (row['Variação'] || '').trim();
            const quantidade = parseDecimal(row['Quantidade']);
            const custoUnitario = parseDecimal(row['Custo Unitário']);
            const precoVendaStr = (row['Preço de Venda'] || '').trim();
            const precoVenda = precoVendaStr ? parseDecimal(precoVendaStr) : undefined;
            const dataRecebimento = parseDate(row['Data Recebimento']);
            const status = ((row['Status'] || '').trim().toUpperCase() || 'RECEIVED') as 'DRAFT' | 'CONFIRMED' | 'RECEIVED';
            const observacao = (row['Observação'] || '').trim() || undefined;

            if (quantidade <= 0) {
              errors.push({ row: rowIndex, message: `Quantidade inválida para "${productName}"` });
              continue;
            }
            if (custoUnitario <= 0) {
              warnings.push(`Linha ${rowIndex + 1}: Custo unitário zero para "${productName}"`);
            }
            if (!dataRecebimento && status === 'RECEIVED') {
              errors.push({ row: rowIndex, message: `Data de Recebimento inválida para "${productName}"` });
              continue;
            }
            if (!['DRAFT', 'CONFIRMED', 'RECEIVED'].includes(status)) {
              errors.push({ row: rowIndex, message: `Status inválido: "${status}". Use DRAFT, CONFIRMED ou RECEIVED` });
              continue;
            }

            // Find product
            const product = products.find((p: any) => p.name.toLowerCase() === productName.toLowerCase());
            if (!product) {
              errors.push({ row: rowIndex, message: `Produto "${productName}" não encontrado` });
              continue;
            }

            // Find variation if specified
            let variationId: string | undefined;
            if (variacaoNome && product.hasVariations) {
              const variation = product.variations.find((v: any) => v.name.toLowerCase() === variacaoNome.toLowerCase());
              if (variation) {
                variationId = variation.id;
              } else {
                // Auto-create variation if product has variations enabled
                const newVar = await tx.productVariation.create({
                  data: {
                    productId: product.id,
                    name: variacaoNome,
                    stockQty: 0,
                  },
                });
                variationId = newVar.id;
                warnings.push(`Linha ${rowIndex + 1}: Variação "${variacaoNome}" criada automaticamente para "${productName}"`);
              }
            }

            const total = quantidade * custoUnitario;
            subtotal += total;

            purchaseItems.push({
              productId: product.id,
              variationId,
              productName,
              quantity: quantidade,
              unitCost: custoUnitario,
              total,
              salePrice: precoVenda,
            });

            if (status === 'RECEIVED' && dataRecebimento) {
              batchItems.push({
                productId: product.id,
                variationId,
                productName,
                quantity: quantidade,
                unitCost: custoUnitario,
                salePrice: precoVenda,
                receivedAt: dataRecebimento,
              });
            }
          }

          if (purchaseItems.length === 0) {
            errors.push({ row: -1, message: `Compra #${_on} (${supplierName}): nenhum item válido` });
            return;
          }

          // Create purchase
          const purchase = await tx.purchase.create({
            data: {
              tenantId: request.tenantId,
              supplierId,
              orderNumber: nextOrderNumber,
              status: (group.items[0].row['Status'] || 'RECEIVED').trim().toUpperCase() as any,
              notes: group.items[0].row['Observação']?.trim() || undefined,
              subtotal,
              discount: 0,
              total: subtotal,
              receivedAt: batchItems.length > 0 ? batchItems[0].receivedAt : undefined,
              items: {
                create: purchaseItems.map(item => ({
                  productId: item.productId,
                  productName: item.productName,
                  quantity: item.quantity,
                  unitCost: item.unitCost,
                  total: item.total,
                  salePrice: item.salePrice,
                })),
              },
            },
          });

          // Create batches and movements for RECEIVED items
          for (const batch of batchItems) {
            // Create InventoryBatch
            await tx.inventoryBatch.create({
              data: {
                tenantId: request.tenantId,
                productId: batch.productId,
                variationId: batch.variationId,
                quantity: batch.quantity,
                remainingQty: batch.quantity,
                unitCost: batch.unitCost,
                receivedAt: batch.receivedAt,
              },
            });

            // Create InventoryMovement
            await tx.inventoryMovement.create({
              data: {
                tenantId: request.tenantId,
                productId: batch.productId,
                variationId: batch.variationId,
                type: 'PURCHASE_IN',
                quantity: batch.quantity,
                unitCost: batch.unitCost,
                totalCost: batch.quantity * batch.unitCost,
                notes: `Compra #${nextOrderNumber} - ${batch.productName}`,
              },
            });

            // Update product stock and weighted cost
            const product = await tx.product.findUnique({ where: { id: batch.productId } });
            if (product) {
              const currentStock = Number(product.stockQty);
              const currentCost = Number(product.costPrice || 0);
              const newStock = currentStock + batch.quantity;
              const weightedCost = currentStock > 0
                ? (currentStock * currentCost + batch.quantity * batch.unitCost) / newStock
                : batch.unitCost;

              await tx.product.update({
                where: { id: batch.productId },
                data: {
                  stockQty: { increment: batch.quantity },
                  costPrice: Math.round(weightedCost * 100) / 100,
                },
              });
            }

            // Update variation stock
            if (batch.variationId) {
              await tx.productVariation.update({
                where: { id: batch.variationId },
                data: { stockQty: { increment: batch.quantity } },
              });
            }
          }

          nextOrderNumber++;
        });

        imported++;
      } catch (err: any) {
        errors.push({ row: -1, message: `Erro ao criar compra: ${err.message}` });
      }
    }

    return reply.status(201).send({ imported, errors, warnings });
  });

  // Cancel purchase
  app.post('/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };

    const purchase = await prisma.purchase.findFirst({
      where: { id, tenantId: request.tenantId },
      include: { items: true },
    });
    if (!purchase) return reply.status(404).send({ error: 'Compra não encontrada' });
    if (purchase.status === 'CANCELLED') {
      return reply.status(400).send({ error: 'Compra já está cancelada' });
    }

    await prisma.$transaction(async (tx) => {
      // If was received, reverse inventory
      if (purchase.status === 'RECEIVED') {
        for (const item of purchase.items) {
          // Create reversal movement
          await tx.inventoryMovement.create({
            data: {
              tenantId: request.tenantId,
              productId: item.productId || undefined,
              variationId: item.variationId || undefined,
              type: 'PURCHASE_CANCEL',
              quantity: -item.quantity,
              unitCost: item.unitCost,
              totalCost: -item.total,
              purchaseId: id,
              notes: `Cancelamento compra #${purchase.orderNumber} - ${item.productName}`,
            },
          });

          // Consume from batches (FIFO reverse: remove from newest batches first)
          let remaining = Number(item.quantity);
          const batches = await tx.inventoryBatch.findMany({
            where: {
              tenantId: request.tenantId,
              productId: item.productId || undefined,
              variationId: item.variationId || undefined,
              remainingQty: { gt: 0 },
            },
            orderBy: { receivedAt: 'desc' }, // newest first for reversal
          });

          for (const batch of batches) {
            if (remaining <= 0) break;
            const consume = Math.min(Number(batch.remainingQty), remaining);
            await tx.inventoryBatch.update({
              where: { id: batch.id },
              data: { remainingQty: { decrement: consume } },
            });
            remaining -= consume;
          }

          // Update product stock
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQty: { decrement: item.quantity } },
            });
          }
          if (item.variationId) {
            await tx.productVariation.update({
              where: { id: item.variationId },
              data: { stockQty: { decrement: item.quantity } },
            });
          }
        }
      }

      // Mark as cancelled
      await tx.purchase.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
    });

    return { success: true };
  });

  // Delete purchase (only DRAFT)
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const purchase = await prisma.purchase.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!purchase) return reply.status(404).send({ error: 'Compra não encontrada' });
    if (purchase.status !== 'DRAFT') {
      return reply.status(400).send({ error: 'Apenas compras em rascunho podem ser excluídas' });
    }

    await prisma.purchaseItem.deleteMany({ where: { purchaseId: id } });
    await prisma.purchase.delete({ where: { id } });

    return { success: true };
  });
};
