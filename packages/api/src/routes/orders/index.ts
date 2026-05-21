import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';

const orderItemSchema = z.object({
  productId: z.string().optional(),
  variationId: z.string().optional(),
  productName: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number(),
  total: z.number(),
});

const createOrderSchema = z.object({
  deviceId: z.string().optional(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
  subtotal: z.number(),
  discount: z.number().default(0),
  total: z.number(),
  paymentMethod: z.string(),
  paymentStatus: z.enum(['PAID', 'PENDING', 'PARTIAL', 'CREDIT_STORE']).default('PAID'),
  source: z.enum(['PDV', 'ONLINE', 'WHATSAPP', 'DELIVERY', 'COMAND']).default('PDV'),
  notes: z.string().optional(),
  localId: z.string().optional(),
  createdAtDevice: z.string().optional(),
  couponId: z.string().optional(),
  couponDiscount: z.number().optional(),
  dueDate: z.string().optional(), // vencimento para fiado
});

export const orderRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const {
      page = '1',
      limit = '20',
      status,
      source,
      startDate,
      endDate,
      customerId,
      paymentMethod,
    } = request.query as Record<string, string>;

    const where: any = { tenantId: request.tenantId };
    if (status) {
      // PAID/PENDING/PARTIAL/CREDIT_STORE → paymentStatus
      // CANCELLED → status (OrderStatus)
      if (['PAID', 'PENDING', 'PARTIAL', 'CREDIT_STORE'].includes(status)) {
        where.paymentStatus = status;
        where.status = { not: 'CANCELLED' };
      } else {
        where.status = status;
      }
    }
    if (source) where.source = source;
    if (customerId) where.customerId = customerId;
    if (paymentMethod) {
      const methods = paymentMethod.split(',').filter(Boolean);
      where.paymentMethod = methods.length === 1 ? methods[0] : { in: methods };
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          customer: { select: { id: true, name: true, phone: true } },
          user: { select: { id: true, name: true } },
          coupon: { select: { id: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.order.count({ where }),
    ]);

    return { orders, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) };
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await prisma.order.findFirst({
      where: { OR: [{ id }, { localId: id }], tenantId: request.tenantId },
      include: {
        items: true,
        customer: true,
        user: { select: { id: true, name: true } },
        coupon: { select: { id: true, code: true } },
        delivery: true,
      },
    });
    if (!order) return reply.status(404).send({ error: 'Venda não encontrada' });
    return order;
  });

  // Create order with FIFO/PEPS consumption
  app.post('/', async (request, reply) => {
    const parsed = createOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const { items, localId, createdAtDevice, ...orderData } = parsed.data;

    // Generate order number
    const lastOrder = await prisma.order.findFirst({
      where: { tenantId: request.tenantId },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const orderNumber = (lastOrder?.orderNumber || 0) + 1;

    // Pre-validate stock for all items (fail fast before transaction)
    for (const item of items) {
      if (item.productId) {
        // Check stock for this product+variant from inventory batches
        const batches = await prisma.inventoryBatch.findMany({
          where: {
            tenantId: request.tenantId,
            productId: item.productId,
            variationId: item.variationId || null,
            remainingQty: { gt: 0 },
          },
        });
        const totalAvailable = batches.reduce((sum, b) => sum + Number(b.remainingQty), 0);
        if (totalAvailable < item.quantity) {
          return reply.status(400).send({
            error: `Estoque insuficiente para "${item.productName}". Disponível: ${totalAvailable}, Necessário: ${item.quantity}`,
          });
        }
      }
    }

    // Validate coupon if provided
    let validatedCoupon: any = null;
    if (orderData.couponId) {
      const coupon = await prisma.coupon.findFirst({
        where: { id: orderData.couponId, tenantId: request.tenantId, active: true },
        include: { products: true, categories: true },
      });
      if (!coupon) {
        return reply.status(400).send({ valid: false, error: 'Cupom não encontrado ou inativo' });
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
      if (coupon.minOrderValue && orderData.subtotal < Number(coupon.minOrderValue)) {
        return reply.status(400).send({
          valid: false,
          error: `Pedido mínimo de R$ ${Number(coupon.minOrderValue).toFixed(2)} para usar este cupom`,
        });
      }
      // Check product/category restrictions
      const productIds = items.map((i) => i.productId).filter(Boolean) as string[];
      if (coupon.products.length > 0 && productIds.length > 0) {
        const couponProductIds = new Set(coupon.products.map((p: any) => p.productId));
        const hasEligible = productIds.some((pid) => couponProductIds.has(pid));
        if (!hasEligible) {
          return reply.status(400).send({ valid: false, error: 'Este cupom não se aplica aos produtos do pedido' });
        }
      }
      // Category check would need categoryIds from product lookup — skip for now (PDV doesn't send them)
      validatedCoupon = coupon;
    }

    const order = await prisma.$transaction(async (tx) => {
      // Create order with items (costPrice/totalCost filled after FIFO calc)
      const itemsData = await Promise.all(items.map(async (item) => {
        let costPrice: number | undefined;
        let totalCost: number | undefined;

        if (item.productId) {
          // Tax rate from payment method config (product taxRate is for pricing reference only)
          let taxRate: number | undefined;
          const paymentConfig = await tx.paymentMethodConfig.findUnique({
            where: {
              tenantId_paymentMethod: {
                tenantId: request.tenantId,
                paymentMethod: orderData.paymentMethod,
              },
            },
            select: { taxRate: true },
          });
          taxRate = paymentConfig?.taxRate ? Number(paymentConfig.taxRate) : 0;

          // FIFO: consume from oldest batches
          let remaining = item.quantity;
          let totalCostAcc = 0;
          const batches = await tx.inventoryBatch.findMany({
            where: {
              tenantId: request.tenantId,
              productId: item.productId,
              variationId: item.variationId || null,
              remainingQty: { gt: 0 },
            },
            orderBy: { receivedAt: 'asc' },
          });

          for (const batch of batches) {
            if (remaining <= 0) break;
            const consume = Math.min(Number(batch.remainingQty), remaining);
            const batchCost = Number(batch.unitCost);

            // Decrement batch remaining quantity
            await tx.inventoryBatch.update({
              where: { id: batch.id },
              data: { remainingQty: { decrement: consume } },
            });

            // Create SALE_OUT movement
            await tx.inventoryMovement.create({
              data: {
                tenantId: request.tenantId,
                productId: item.productId,
                variationId: item.variationId || null,
                type: 'SALE_OUT',
                quantity: -consume,
                unitCost: batchCost,
                totalCost: -(consume * batchCost),
                batchId: batch.id,
                notes: `Venda #${orderNumber} - ${item.productName}`,
              },
            });

            totalCostAcc += consume * batchCost;
            remaining -= consume;
          }

          // Weighted average cost for this item
          costPrice = totalCostAcc / item.quantity;
          totalCost = totalCostAcc;

          // Update product/variation stock
          if (item.variationId) {
            await tx.productVariation.update({
              where: { id: item.variationId },
              data: { stockQty: { decrement: item.quantity } },
            });
          }
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQty: { decrement: item.quantity },
              costPrice: Math.round(costPrice * 100) / 100,
            },
          });

          return {
            productId: item.productId,
            variationId: item.variationId || null,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            costPrice: costPrice ? Math.round(costPrice * 100) / 100 : undefined,
            totalCost: totalCost ? Math.round(totalCost * 100) / 100 : undefined,
            taxRate,
          };
        }

        return {
          productId: item.productId,
          variationId: item.variationId || null,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        };
      }));

      const o = await tx.order.create({
        data: {
          ...orderData,
          tenantId: request.tenantId,
          userId: request.userId,
          orderNumber,
          localId,
          createdAtDevice: createdAtDevice ? new Date(createdAtDevice) : null,
          dueDate: orderData.dueDate ? new Date(orderData.dueDate) : null,
          syncStatus: 'SYNCED',
          items: { create: itemsData },
        },
        include: { items: true, customer: true },
      });

      // Update inventory movements with orderId
      await tx.inventoryMovement.updateMany({
        where: {
          tenantId: request.tenantId,
          notes: { startsWith: `Venda #${orderNumber}` },
          orderId: undefined,
        },
        data: { orderId: o.id },
      });

      // Update customer stats
      if (orderData.customerId) {
        await tx.customer.update({
          where: { id: orderData.customerId },
          data: {
            totalPurchases: { increment: 1 },
            totalSpent: { increment: orderData.total },
            lastPurchaseAt: new Date(),
          },
        });

        // Fiado/credit: increment creditBalance and create LOAN transaction
        if (orderData.paymentStatus === 'PENDING' || orderData.paymentStatus === 'CREDIT_STORE') {
          const updatedCustomer = await tx.customer.update({
            where: { id: orderData.customerId },
            data: { creditBalance: { increment: orderData.total } },
          });
          await tx.creditTransaction.create({
            data: {
              customerId: orderData.customerId,
              type: 'LOAN',
              amount: orderData.total,
              balanceAfter: updatedCustomer.creditBalance,
              referenceId: o.id,
              notes: `Venda fiado #${orderNumber}`,
            },
          });
        }
      }

      // Register in cash flow
      await tx.cashFlow.create({
        data: {
          tenantId: request.tenantId,
          type: 'IN',
          category: 'venda',
          description: `Venda #${orderNumber}`,
          amount: orderData.total,
          dueDate: orderData.dueDate ? new Date(orderData.dueDate) : new Date(),
          paidAt: orderData.paymentStatus === 'PAID' ? new Date() : null,
          orderId: o.id,
        },
      });

      // Increment coupon usage count
      if (validatedCoupon) {
        await tx.coupon.update({
          where: { id: validatedCoupon.id },
          data: { usageCount: { increment: 1 } },
        });
      }

      return o;
    });

    return reply.status(201).send(order);
  });

  // Cancel order with FIFO/PEPS reversal
  app.post('/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await prisma.order.findFirst({
      where: { OR: [{ id }, { localId: id }], tenantId: request.tenantId },
      include: { items: true },
    });
    if (!order) return reply.status(404).send({ error: 'Venda não encontrada' });

    if (order.status === 'CANCELLED') {
      return reply.status(400).send({ error: 'Venda já cancelada' });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (item.productId) {
          // Create SALE_CANCEL movement
          await tx.inventoryMovement.create({
            data: {
              tenantId: request.tenantId,
              productId: item.productId,
              variationId: (item as any).variationId || null,
              type: 'SALE_CANCEL',
              quantity: item.quantity,
              unitCost: item.costPrice ? Number(item.costPrice) : 0,
              totalCost: item.totalCost ? Number(item.totalCost) : 0,
              orderId: order.id,
              notes: `Cancelamento venda #${order.orderNumber} - ${item.productName}`,
            },
          });

          // Return stock as a new batch (preserves cost history)
          if (item.costPrice) {
            await tx.inventoryBatch.create({
              data: {
                tenantId: request.tenantId,
                productId: item.productId,
                variationId: (item as any).variationId || null,
                quantity: item.quantity,
                remainingQty: item.quantity,
                unitCost: Number(item.costPrice),
                receivedAt: new Date(),
              },
            });
          }

          // Update product/variation stock
          if ((item as any).variationId) {
            await tx.productVariation.update({
              where: { id: (item as any).variationId },
              data: { stockQty: { increment: item.quantity } },
            });
          }
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: { increment: item.quantity } },
          });
        }
      }

      // Cancel order
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' },
      });

      // Reverse cash flow
      await tx.cashFlow.create({
        data: {
          tenantId: request.tenantId,
          type: 'OUT',
          category: 'estorno',
          description: `Cancelamento venda #${order.orderNumber}`,
          amount: order.total,
          dueDate: new Date(),
          paidAt: new Date(),
          orderId: order.id,
        },
      });
    });

    return { success: true };
  });

  // Today's summary
  app.get('/today-summary', async (request) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: {
        tenantId: request.tenantId,
        createdAt: { gte: today },
        status: 'COMPLETED',
      },
      select: { total: true, paymentMethod: true, paymentStatus: true },
    });

    const paidOrders = orders.filter(o => o.paymentStatus === 'PAID');
    const pendingOrders = orders.filter(o => o.paymentStatus === 'PENDING' || o.paymentStatus === 'CREDIT_STORE');

    const totalSales = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const pendingAmount = pendingOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const count = paidOrders.length;
    const pendingCount = pendingOrders.length;
    const byMethod = orders.reduce((acc: Record<string, { count: number; total: number }>, o) => {
      const method = o.paymentMethod || 'outro';
      if (!acc[method]) acc[method] = { count: 0, total: 0 };
      acc[method].count++;
      acc[method].total += Number(o.total);
      return acc;
    }, {});

    return { date: today.toISOString().slice(0, 10), totalSales, count, pendingAmount, pendingCount, byMethod };
  });

  // Confirm an ONLINE pending order (consume stock, mark as paid)
  app.post('/:id/confirm', async (request, reply) => {
    const { id } = request.params as { id: string };

    const order = await prisma.order.findFirst({
      where: { OR: [{ id }, { localId: id }], tenantId: request.tenantId },
      include: { items: true, customer: true },
    });
    if (!order) return reply.status(404).send({ error: 'Venda não encontrada' });

    if (order.source !== 'ONLINE') {
      return reply.status(400).send({ error: 'Apenas pedidos online podem ser confirmados' });
    }
    if (order.status === 'CANCELLED') {
      return reply.status(400).send({ error: 'Pedido já cancelado' });
    }
    if (order.paymentStatus !== 'PENDING') {
      return reply.status(400).send({ error: 'Pedido já foi confirmado' });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (item.productId) {
          // FIFO: consume from oldest batches
          const qty = Number(item.quantity);
          let remaining = qty;
          const batches = await tx.inventoryBatch.findMany({
            where: {
              tenantId: request.tenantId,
              productId: item.productId,
              variationId: (item as any).variationId || null,
              remainingQty: { gt: 0 },
            },
            orderBy: { receivedAt: 'asc' },
          });

          let totalCostAcc = 0;
          for (const batch of batches) {
            if (remaining <= 0) break;
            const consume = Math.min(Number(batch.remainingQty), remaining);
            const batchCost = Number(batch.unitCost);
            totalCostAcc += consume * batchCost;

            await tx.inventoryBatch.update({
              where: { id: batch.id },
              data: { remainingQty: { decrement: consume } },
            });

            await tx.inventoryMovement.create({
              data: {
                tenantId: request.tenantId,
                productId: item.productId,
                variationId: (item as any).variationId || null,
                type: 'SALE_OUT',
                quantity: -consume,
                unitCost: batchCost,
                totalCost: -(consume * batchCost),
                batchId: batch.id,
                orderId: order.id,
                notes: `Pedido online #${order.orderNumber} - ${item.productName}`,
              },
            });

            remaining -= consume;
          }

          // Update product/variation stock
          if ((item as any).variationId) {
            await tx.productVariation.update({
              where: { id: (item as any).variationId },
              data: { stockQty: { decrement: qty } },
            });
          }
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: { decrement: qty } },
          });

          const costPrice = totalCostAcc / qty;
          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              costPrice: Math.round(costPrice * 100) / 100,
              totalCost: Math.round(totalCostAcc * 100) / 100,
            },
          });
        }
      }

      // Update order status (and optionally payment method)
      const { paymentMethod } = (request.body as Record<string, unknown>) || {};
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          ...(paymentMethod ? { paidWithMethod: paymentMethod as string } : {}),
        },
      });

      // Register in cash flow
      await tx.cashFlow.create({
        data: {
          tenantId: request.tenantId,
          type: 'IN',
          category: 'venda',
          description: `Pedido online #${order.orderNumber}`,
          amount: order.total,
          dueDate: new Date(),
          paidAt: new Date(),
          orderId: order.id,
        },
      });

      // Update customer stats
      if (order.customerId) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            totalPurchases: { increment: 1 },
            totalSpent: { increment: order.total },
            lastPurchaseAt: new Date(),
          },
        });
      }
    });

    return { success: true, message: 'Pedido confirmado! Estoque atualizado.' };
  });

  // Receive payment for a pending fiado order
  app.post('/:id/pay', async (request, reply) => {
    const { id } = request.params as { id: string };

    const order = await prisma.order.findFirst({
      where: { OR: [{ id }, { localId: id }], tenantId: request.tenantId },
      include: { items: true, customer: true },
    });
    if (!order) return reply.status(404).send({ error: 'Venda não encontrada' });

    if (order.paymentStatus === 'PAID') {
      return reply.status(400).send({ error: 'Venda já está paga' });
    }
    if (order.status === 'CANCELLED') {
      return reply.status(400).send({ error: 'Venda cancelada não pode ser paga' });
    }

    const schema = z.object({
      paidAmount: z.number().optional(), // valor parcial (default: total)
      paymentMethod: z.string().optional(), // novo metodo de pagamento ao quitar fiado
    });
    const parsed = schema.safeParse(request.body || {});
    const paidAmount = parsed.success && parsed.data.paidAmount ? parsed.data.paidAmount : Number(order.total);
    const paymentMethod = parsed.success ? parsed.data.paymentMethod : undefined;
    const newPaymentStatus = paidAmount >= Number(order.total) ? 'PAID' : 'PARTIAL';

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: newPaymentStatus,
          paidAmount: { increment: paidAmount },
          ...(paymentMethod ? { paidWithMethod: paymentMethod as string } : {}),
        },
      });

      // Update cash flow
      await tx.cashFlow.updateMany({
        where: { orderId: order.id, type: 'IN' },
        data: { paidAt: new Date() },
      });

      // Decrease customer creditBalance and create PAYMENT transaction
      if (order.customerId) {
        const updatedCustomer = await tx.customer.update({
          where: { id: order.customerId },
          data: { creditBalance: { decrement: paidAmount } },
        });
        await tx.creditTransaction.create({
          data: {
            customerId: order.customerId,
            type: 'PAYMENT',
            amount: paidAmount,
            balanceAfter: updatedCustomer.creditBalance,
            referenceId: order.id,
            notes: `Pagamento venda #${order.orderNumber}`,
          },
        });
      }
    });

    if (newPaymentStatus === 'PARTIAL') {
      const remaining = Number(order.total) - Number(order.paidAmount) - paidAmount;
      return { success: true, status: 'PARTIAL', remaining, message: `Pagamento parcial recebido. Restam R$ ${remaining.toFixed(2)}` };
    }

    return { success: true, status: 'PAID', message: 'Pagamento recebido com sucesso!' };
  });
};
