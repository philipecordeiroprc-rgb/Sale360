import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';
import { normalizePaymentMethod, hasFiadoPayment } from '../../lib/payment-utils.js';

const publicOrderSchema = z.object({
  tenantSlug: z.string().min(1),
  customerName: z.string().min(1, 'Nome é obrigatório'),
  customerPhone: z.string().min(1, 'Telefone é obrigatório'),
  customerEmail: z.string().email().optional().or(z.literal('')),
  items: z.array(z.object({
    productId: z.string().min(1),
    variationId: z.string().optional(),
    productName: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    total: z.number().positive(),
  })).min(1, 'Adicione pelo menos um produto'),
  subtotal: z.number(),
  discount: z.number().default(0),
  total: z.number(),
  paymentMethod: z.string().optional(),
  payments: z.array(z.object({
    paymentMethod: z.string().min(1),
    amount: z.number().positive(),
  })).optional(),
  couponCode: z.string().optional(),
  couponDiscount: z.number().optional(),
  notes: z.string().optional(),
  dueDate: z.string().optional(),
});

export const publicRoutes: FastifyPluginAsync = async (app) => {
  // GET catalog data by tenant slug
  app.get('/catalog/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, companyName: true, status: true },
    });

    if (!tenant) {
      return reply.status(404).send({ error: 'Loja não encontrada' });
    }

    if (tenant.status !== 'ACTIVE' && tenant.status !== 'TRIAL') {
      return reply.status(404).send({ error: 'Loja indisponível' });
    }

    const settings = await prisma.catalogSettings.findUnique({
      where: { tenantId: tenant.id },
      include: {
        banners: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
        paymentMethods: { where: { enabled: true } },
      },
    });

    if (!settings || !settings.active) {
      return reply.status(404).send({ error: 'Catálogo não encontrado' });
    }

    // Load products
    const products = await prisma.product.findMany({
      where: { tenantId: tenant.id, active: true },
      include: {
        category: { select: { id: true, name: true, color: true, variationTemplate: { include: { dimensions: { orderBy: { orderIndex: 'asc' } } } } } },
        variations: { orderBy: { name: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    // Apply outOfStockBehavior
    let filteredProducts = products;
    if (settings.outOfStockBehavior === 'hide') {
      filteredProducts = products.filter((p) => {
        if (p.hasVariations && p.variations.length > 0) {
          return p.variations.some((v) => Number(v.stockQty) > 0);
        }
        return Number(p.stockQty) > 0;
      });
    }

    // Get categories for filtered products
    const categoryIds = [...new Set(filteredProducts.map((p) => p.categoryId).filter(Boolean))] as string[];
    const categories = categoryIds.length > 0
      ? await prisma.category.findMany({
          where: { id: { in: categoryIds }, tenantId: tenant.id },
          orderBy: { sortOrder: 'asc' },
        })
      : [];

    return {
      store: {
        name: settings.storeName || tenant.companyName,
        phone: settings.storePhone,
        document: settings.document,
        companyName: settings.companyName,
        primaryColor: settings.primaryColor,
        backgroundColor: settings.backgroundColor,
        displayMode: settings.displayMode,
        outOfStockBehavior: settings.outOfStockBehavior,
        logoPath: settings.logoPath,
        acceptOrders: settings.acceptOrders,
        postOrderMessage: settings.postOrderMessage,
        whatsAppNumber: settings.whatsAppNumber,
        receiveWhatsApp: settings.receiveWhatsApp,
        instagram: settings.instagram,
        email: settings.email,
        aboutUs: settings.aboutUs,
      },
      banners: settings.banners.map((b) => ({
        id: b.id,
        imagePath: b.imagePath,
        linkUrl: b.linkUrl,
      })),
      paymentMethods: settings.paymentMethods.sort((a, b) => {
        const order = ['pix', 'debit', 'credit', 'cash', 'food_voucher', 'meal_voucher', 'credit_store'];
        return order.indexOf(a.paymentMethod) - order.indexOf(b.paymentMethod);
      }),
      categories,
      products: filteredProducts,
    };
  });

  // GET single product detail
  app.get('/catalog/:slug/product/:id', async (request, reply) => {
    const { slug, id } = request.params as { slug: string; id: string };

    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (!tenant) return reply.status(404).send({ error: 'Loja não encontrada' });

    const product = await prisma.product.findFirst({
      where: { id, tenantId: tenant.id, active: true },
      include: {
        category: { select: { id: true, name: true, variationTemplate: { include: { dimensions: { orderBy: { orderIndex: 'asc' } } } } } },
        variations: { orderBy: { name: 'asc' } },
      },
    });

    if (!product) return reply.status(404).send({ error: 'Produto não encontrado' });
    return product;
  });

  // Create order from catalog
  app.post('/orders', async (request, reply) => {
    const parsed = publicOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    // Find tenant
    const tenant = await prisma.tenant.findUnique({ where: { slug: data.tenantSlug } });
    if (!tenant) return reply.status(404).send({ error: 'Loja não encontrada' });

    // Verify catalog accepts orders
    const settings = await prisma.catalogSettings.findUnique({
      where: { tenantId: tenant.id },
      include: { paymentMethods: { where: { enabled: true } } },
    });

    if (!settings || !settings.active || !settings.acceptOrders) {
      return reply.status(400).send({ error: 'Esta loja não está aceitando pedidos online no momento.' });
    }

    // Build effective payments (multi or legacy single) — normalize method names
    let effectivePayments: Array<{ paymentMethod: string; amount: number }> = [];
    if (data.payments && data.payments.length > 0) {
      effectivePayments = data.payments.map(p => ({
        paymentMethod: normalizePaymentMethod(p.paymentMethod),
        amount: p.amount,
      }));
    } else if (data.paymentMethod) {
      effectivePayments = [{ paymentMethod: normalizePaymentMethod(data.paymentMethod), amount: data.total }];
    } else {
      return reply.status(400).send({ error: 'paymentMethod ou payments é obrigatório.' });
    }

    // Validate all payment methods are enabled
    for (const p of effectivePayments) {
      const pmEnabled = settings.paymentMethods.some((pm) => pm.paymentMethod === p.paymentMethod);
      if (!pmEnabled) {
        return reply.status(400).send({ error: `Método de pagamento "${p.paymentMethod}" não disponível.` });
      }
    }

    // Find or create customer (by phone if provided)
    let customerId: string | undefined;
    if (data.customerPhone) {
      const existingCustomer = await prisma.customer.findFirst({
        where: { tenantId: tenant.id, phone: data.customerPhone },
      });
      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const newCustomer = await prisma.customer.create({
          data: {
            tenantId: tenant.id,
            name: data.customerName,
            phone: data.customerPhone,
            email: data.customerEmail || undefined,
          },
        });
        customerId = newCustomer.id;
      }
    }

    // Validate coupon if provided
    let couponId: string | undefined;
    let couponDiscount = 0;
    if (data.couponCode) {
      const coupon = await prisma.coupon.findFirst({
        where: { tenantId: tenant.id, code: data.couponCode, active: true },
      });

      if (coupon) {
        const now = new Date();
        const validFrom = coupon.validFrom ? new Date(coupon.validFrom) <= now : true;
        const validUntil = coupon.validUntil ? new Date(coupon.validUntil) >= now : true;
        const usageOk = !coupon.usageLimit || (coupon.usageCount || 0) < coupon.usageLimit;

        if (validFrom && validUntil && usageOk) {
          couponId = coupon.id;
          couponDiscount = data.couponDiscount || 0;
        }
      }
    }

    // Generate order number
    const lastOrder = await prisma.order.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const orderNumber = (lastOrder?.orderNumber || 0) + 1;

    // Calculate due date for credit_store
    let dueDate: Date | undefined;
    const isFiadoOrder = hasFiadoPayment(effectivePayments);
    if (isFiadoOrder) {
      const pmSettings = settings.paymentMethods.find((pm) => pm.paymentMethod === 'credit_store');
      const days = pmSettings?.dueDays || 30;
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + days);
    }
    if (data.dueDate) {
      dueDate = new Date(data.dueDate);
    }

    // Primary method for legacy column
    const primaryMethod = effectivePayments[0].paymentMethod;

    // Todos os pedidos do catálogo entram como PENDING — o vendedor confirma
    // e dá baixa no estoque manualmente pelo painel admin.
    const order = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        orderNumber,
        customerId,
        customerName: !customerId ? data.customerName : undefined,
        source: 'ONLINE',
        status: 'PENDING',
        paymentMethod: primaryMethod,
        paymentStatus: 'PENDING',
        subtotal: data.subtotal,
        discount: data.discount,
        total: data.total,
        couponId,
        couponDiscount: couponDiscount > 0 ? couponDiscount : undefined,
        dueDate,
        notes: data.notes || `Pedido via catálogo online`,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            variationId: item.variationId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        },
      },
    });

    // Create OrderPayment records
    for (const payment of effectivePayments) {
      await prisma.orderPayment.create({
        data: {
          orderId: order.id,
          paymentMethod: payment.paymentMethod,
          amount: payment.amount,
        },
      });
    }

    // Fiado: registrar crédito do cliente e entrada no fluxo de caixa
    if (isFiadoOrder && customerId) {
      const fiadoAmount = effectivePayments
        .filter(p => p.paymentMethod === 'credit_store')
        .reduce((sum, p) => sum + p.amount, 0);

      if (fiadoAmount > 0) {
        await prisma.customer.update({
          where: { id: customerId },
          data: {
            totalPurchases: { increment: 1 },
            totalSpent: { increment: data.total },
            lastPurchaseAt: new Date(),
          },
        });

        const updatedCustomer = await prisma.customer.update({
          where: { id: customerId },
          data: { creditBalance: { increment: fiadoAmount } },
        });

        await prisma.creditTransaction.create({
          data: {
            customerId,
            type: 'LOAN',
            amount: fiadoAmount,
            balanceAfter: updatedCustomer.creditBalance,
            referenceId: order.id,
            notes: `Venda fiado #${orderNumber} (catálogo)`,
          },
        });

        await prisma.cashFlow.create({
          data: {
            tenantId: tenant.id,
            type: 'IN',
            category: 'venda',
            description: `Pedido online #${orderNumber} (fiado)`,
            amount: data.total,
            dueDate: dueDate || new Date(),
            orderId: order.id,
          },
        });
      }
    }

    // Increment coupon usage
    if (couponId) {
      await prisma.coupon.update({
        where: { id: couponId },
        data: { usageCount: { increment: 1 } },
      }).catch(() => {}); // best effort
    }

    return reply.status(201).send({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: Number(order.total),
      },
      storePhone: settings.whatsAppNumber || settings.storePhone,
      storeName: settings.storeName || tenant.companyName,
      postOrderMessage: settings.postOrderMessage,
    });
  });

  // Validate coupon (public)
  app.post('/coupons/validate', async (request, reply) => {
    const schema = z.object({
      tenantSlug: z.string().min(1),
      code: z.string().min(1),
      subtotal: z.number(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos' });
    }

    const { tenantSlug, code, subtotal } = parsed.data;

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
    if (!tenant) return reply.status(404).send({ error: 'Loja não encontrada' });

    const coupon = await prisma.coupon.findFirst({
      where: { tenantId: tenant.id, code: code.toUpperCase(), active: true },
    });

    if (!coupon) {
      return reply.status(200).send({ valid: false, error: 'Cupom não encontrado' });
    }

    const now = new Date();
    if (coupon.validFrom && new Date(coupon.validFrom) > now) {
      return reply.status(200).send({ valid: false, error: 'Cupom ainda não está válido' });
    }
    if (coupon.validUntil && new Date(coupon.validUntil) < now) {
      return reply.status(200).send({ valid: false, error: 'Cupom expirado' });
    }
    if (coupon.usageLimit && (coupon.usageCount || 0) >= coupon.usageLimit) {
      return reply.status(200).send({ valid: false, error: 'Cupom esgotado' });
    }
    if (coupon.minOrderValue && subtotal < Number(coupon.minOrderValue)) {
      return reply.status(200).send({
        valid: false,
        error: `Valor mínimo do pedido: R$ ${Number(coupon.minOrderValue).toFixed(2)}`,
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = subtotal * (Number(coupon.discountValue) / 100);
    } else {
      discountAmount = Number(coupon.discountValue);
    }

    if (discountAmount > subtotal) discountAmount = subtotal;

    return {
      valid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      discountAmount,
    };
  });
};
