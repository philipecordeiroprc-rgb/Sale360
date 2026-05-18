import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';

const createCouponSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  description: z.string().optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  discountValue: z.number().positive('Valor deve ser positivo'),
  minOrderValue: z.number().optional(),
  maxDiscount: z.number().optional(),
  usageLimit: z.number().int().positive().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  active: z.boolean().default(true),
  productIds: z.array(z.string()).optional(),
  categoryIds: z.array(z.string()).optional(),
});

const updateCouponSchema = createCouponSchema.partial();

const validateSchema = z.object({
  code: z.string().min(1),
  orderSubtotal: z.number(),
  productIds: z.array(z.string()).optional(),
  categoryIds: z.array(z.string()).optional(),
});

export const couponRoutes: FastifyPluginAsync = async (app) => {
  // List coupons
  app.get('/', async (request) => {
    const { search, active } = request.query as Record<string, string>;

    const where: any = { tenantId: request.tenantId };
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (active !== undefined) where.active = active === 'true';

    const coupons = await prisma.coupon.findMany({
      where,
      include: {
        products: { include: { product: { select: { id: true, name: true } } } },
        categories: { include: { category: { select: { id: true, name: true } } } },
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { coupons };
  });

  // Get single
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const coupon = await prisma.coupon.findFirst({
      where: { id, tenantId: request.tenantId },
      include: {
        products: { include: { product: { select: { id: true, name: true } } } },
        categories: { include: { category: { select: { id: true, name: true } } } },
        _count: { select: { orders: true } },
      },
    });
    if (!coupon) return reply.status(404).send({ error: 'Cupom não encontrado' });
    return coupon;
  });

  // Create coupon
  app.post('/', async (request, reply) => {
    const parsed = createCouponSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const { productIds, categoryIds, ...data } = parsed.data;

    // Check code uniqueness
    const existing = await prisma.coupon.findFirst({
      where: { code: data.code.toUpperCase(), tenantId: request.tenantId },
    });
    if (existing) {
      return reply.status(409).send({ error: 'Já existe um cupom com este código' });
    }

    const coupon = await prisma.coupon.create({
      data: {
        ...data,
        code: data.code.toUpperCase(),
        tenantId: request.tenantId,
        validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        products: productIds?.length
          ? { create: productIds.map((pid) => ({ productId: pid })) }
          : undefined,
        categories: categoryIds?.length
          ? { create: categoryIds.map((cid) => ({ categoryId: cid })) }
          : undefined,
      },
      include: {
        products: { include: { product: { select: { id: true, name: true } } } },
        categories: { include: { category: { select: { id: true, name: true } } } },
      },
    });

    return reply.status(201).send(coupon);
  });

  // Update coupon
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateCouponSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const existing = await prisma.coupon.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!existing) return reply.status(404).send({ error: 'Cupom não encontrado' });

    const { productIds, categoryIds, ...data } = parsed.data;

    // Replace product/category associations if provided
    if (productIds !== undefined) {
      await prisma.couponProduct.deleteMany({ where: { couponId: id } });
      if (productIds.length > 0) {
        await prisma.couponProduct.createMany({
          data: productIds.map((pid) => ({ couponId: id, productId: pid })),
        });
      }
    }

    if (categoryIds !== undefined) {
      await prisma.couponCategory.deleteMany({ where: { couponId: id } });
      if (categoryIds.length > 0) {
        await prisma.couponCategory.createMany({
          data: categoryIds.map((cid) => ({ couponId: id, categoryId: cid })),
        });
      }
    }

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...data,
        code: data.code?.toUpperCase(),
        validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
      },
      include: {
        products: { include: { product: { select: { id: true, name: true } } } },
        categories: { include: { category: { select: { id: true, name: true } } } },
      },
    });

    return coupon;
  });

  // Delete coupon
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.coupon.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!existing) return reply.status(404).send({ error: 'Cupom não encontrado' });

    await prisma.coupon.delete({ where: { id } });
    return { success: true };
  });

  // Validate and calculate discount
  app.post('/validate', async (request, reply) => {
    const parsed = validateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const { code, orderSubtotal, productIds = [], categoryIds = [] } = parsed.data;

    const coupon = await prisma.coupon.findFirst({
      where: { code: code.toUpperCase(), tenantId: request.tenantId, active: true },
      include: {
        products: true,
        categories: true,
      },
    });

    if (!coupon) {
      return reply.status(404).send({ valid: false, error: 'Cupom não encontrado ou inativo' });
    }

    // Check date validity
    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) {
      return reply.status(400).send({ valid: false, error: 'Cupom ainda não está válido' });
    }
    if (coupon.validUntil && now > coupon.validUntil) {
      return reply.status(400).send({ valid: false, error: 'Cupom expirado' });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return reply.status(400).send({ valid: false, error: 'Limite de uso do cupom atingido' });
    }

    // Check min order value
    if (coupon.minOrderValue && orderSubtotal < Number(coupon.minOrderValue)) {
      return reply.status(400).send({
        valid: false,
        error: `Pedido mínimo de R$ ${Number(coupon.minOrderValue).toFixed(2)} para usar este cupom`,
      });
    }

    // Check product/category restrictions
    if (coupon.products.length > 0 && productIds.length > 0) {
      const couponProductIds = new Set(coupon.products.map((p) => p.productId));
      const hasEligible = productIds.some((pid) => couponProductIds.has(pid));
      if (!hasEligible) {
        return reply.status(400).send({
          valid: false,
          error: 'Este cupom não se aplica aos produtos do pedido',
        });
      }
    }

    if (coupon.categories.length > 0 && categoryIds.length > 0) {
      const couponCategoryIds = new Set(coupon.categories.map((c) => c.categoryId));
      const hasEligible = categoryIds.some((cid) => couponCategoryIds.has(cid));
      if (!hasEligible) {
        return reply.status(400).send({
          valid: false,
          error: 'Este cupom não se aplica às categorias do pedido',
        });
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = orderSubtotal * (Number(coupon.discountValue) / 100);
      if (coupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
      }
    } else {
      discountAmount = Number(coupon.discountValue);
    }

    // Don't exceed subtotal
    discountAmount = Math.min(discountAmount, orderSubtotal);

    return {
      valid: true,
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      discountAmount: Math.round(discountAmount * 100) / 100,
      newTotal: Math.round((orderSubtotal - discountAmount) * 100) / 100,
    };
  });
};
