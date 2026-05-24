import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';

const createSupplierSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  cnpj: z.string().optional(),
  ie: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  contactName: z.string().optional(),
  address: z.string().optional(),
  addressNumber: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  notes: z.string().optional(),
});

const updateSupplierSchema = createSupplierSchema.partial();

export const supplierRoutes: FastifyPluginAsync = async (app) => {
  // List all suppliers
  app.get('/', async (request) => {
    const { search, active, page = '1', limit = '50' } = request.query as Record<string, string>;

    const where: any = { tenantId: request.tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { cnpj: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    if (active !== undefined) where.active = active === 'true';

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: { _count: { select: { purchases: true } } },
        orderBy: { name: 'asc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.supplier.count({ where }),
    ]);

    return { suppliers, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
  });

  // Get single supplier
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const supplier = await prisma.supplier.findFirst({
      where: { id, tenantId: request.tenantId },
      include: {
        purchases: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: { select: { purchases: true } },
      },
    });
    if (!supplier) return reply.status(404).send({ error: 'Fornecedor não encontrado' });
    return supplier;
  });

  // Create supplier
  app.post('/', async (request, reply) => {
    const parsed = createSupplierSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const supplier = await prisma.supplier.create({
      data: { ...parsed.data, tenantId: request.tenantId },
    });

    return reply.status(201).send(supplier);
  });

  // Update supplier
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateSupplierSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos' });
    }

    const exists = await prisma.supplier.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!exists) return reply.status(404).send({ error: 'Fornecedor não encontrado' });

    const supplier = await prisma.supplier.update({
      where: { id },
      data: parsed.data,
    });

    return supplier;
  });

  // Toggle active
  app.patch('/:id/toggle', async (request, reply) => {
    const { id } = request.params as { id: string };
    const supplier = await prisma.supplier.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!supplier) return reply.status(404).send({ error: 'Fornecedor não encontrado' });

    const updated = await prisma.supplier.update({
      where: { id },
      data: { active: !supplier.active },
    });

    return updated;
  });

  // Import suppliers (bulk)
  app.post('/import', async (request, reply) => {
    const { rows } = request.body as { rows: Record<string, string>[] };
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return reply.status(400).send({ error: 'Nenhuma linha para importar' });
    }

    const errors: { row: number; message: string }[] = [];
    const warnings: string[] = [];
    let imported = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = (row['Nome'] || '').trim();
      if (!name) {
        errors.push({ row: i, message: 'Nome é obrigatório' });
        continue;
      }

      // Parse SIM/NAO
      const ativoStr = (row['Ativo'] || '').trim().toUpperCase();
      const active = ativoStr === '' ? true : (ativoStr === 'SIM' || ativoStr === 'S' || ativoStr === 'YES');

      // Clean CNPJ (strip formatting)
      const cnpjRaw = (row['CNPJ'] || '').trim();
      const cnpj = cnpjRaw ? cnpjRaw.replace(/[^\d]/g, '') : undefined;

      try {
        // Check duplicate CNPJ if provided
        if (cnpj) {
          const dup = await prisma.supplier.findFirst({ where: { cnpj, tenantId: request.tenantId } });
          if (dup) {
            warnings.push(`Linha ${i + 1}: CNPJ ${cnpjRaw} já cadastrado para "${dup.name}" — pulado`);
            continue;
          }
        }

        await prisma.supplier.create({
          data: {
            tenantId: request.tenantId,
            name,
            cnpj,
            ie: (row['IE'] || '').trim() || undefined,
            email: (row['Email'] || '').trim() || undefined,
            phone: (row['Telefone'] || '').trim() || undefined,
            whatsapp: (row['WhatsApp'] || '').trim() || undefined,
            contactName: (row['Contato'] || '').trim() || undefined,
            address: (row['Endereço'] || '').trim() || undefined,
            addressNumber: (row['Número'] || '').trim() || undefined,
            complement: (row['Complemento'] || '').trim() || undefined,
            neighborhood: (row['Bairro'] || '').trim() || undefined,
            city: (row['Cidade'] || '').trim() || undefined,
            state: (row['Estado'] || '').trim() || undefined,
            zipCode: (row['CEP'] || '').trim() || undefined,
            notes: (row['Observações'] || '').trim() || undefined,
            active,
          },
        });
        imported++;
      } catch (err: any) {
        errors.push({ row: i, message: `Erro ao criar fornecedor "${name}": ${err.message}` });
      }
    }

    return reply.status(201).send({ imported, errors, warnings });
  });

  // Delete supplier
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const supplier = await prisma.supplier.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!supplier) return reply.status(404).send({ error: 'Fornecedor não encontrado' });

    const purchaseCount = await prisma.purchase.count({ where: { supplierId: id } });
    if (purchaseCount > 0) {
      return reply.status(400).send({ error: 'Fornecedor possui compras vinculadas. Remova as compras primeiro.' });
    }

    await prisma.supplier.delete({ where: { id } });
    return { success: true };
  });
};
