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
