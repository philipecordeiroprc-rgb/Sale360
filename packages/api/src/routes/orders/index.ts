import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';
import {
  normalizePaymentMethod,
  validatePaymentTotal,
  hasFiadoPayment,
  getWeightedTaxRate,
  paymentEntrySchema,
} from '../../lib/payment-utils.js';
import { startOfDay, endOfDay } from '../../lib/date-utils.js';

const orderItemSchema = z.object({
  productId: z.string().optional(),
  variationId: z.string().optional(),
  batchId: z.string().optional(), // lote específico (vendedor escolheu na venda)
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
  paymentMethod: z.string().optional(),
  payments: z.array(paymentEntrySchema).optional(),
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
    } else {
      // Por padrão, exclui vendas canceladas da lista principal
      where.status = { not: 'CANCELLED' };
    }
    if (source) where.source = source;
    if (customerId) where.customerId = customerId;
    if (paymentMethod) {
      const methods = paymentMethod.split(',').filter(Boolean);
      where.OR = [
        { paymentMethod: methods.length === 1 ? methods[0] : { in: methods } },
        { payments: { some: { paymentMethod: { in: methods } } } },
      ];
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const [y, m, d] = startDate.split('-').map(Number);
        where.createdAt.gte = new Date(y, m - 1, d);
      }
      if (endDate) {
        const [y, m, d] = endDate.split('-').map(Number);
        where.createdAt.lte = new Date(y, m - 1, d, 23, 59, 59, 999);
      }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          customer: { select: { id: true, name: true, phone: true } },
          user: { select: { id: true, name: true } },
          coupon: { select: { id: true, code: true } },
          payments: { select: { id: true, paymentMethod: true, amount: true } },
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
        payments: { select: { id: true, paymentMethod: true, amount: true } },
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

    const { items, localId, createdAtDevice, payments, ...orderData } = parsed.data;

    // Build effective payments list (new multi-payment or legacy single)
    let effectivePayments: Array<{ paymentMethod: string; amount: number }> = [];
    if (payments && payments.length > 0) {
      // Validate sum equals total
      if (!validatePaymentTotal(payments, orderData.total)) {
        return reply.status(400).send({
          error: 'Soma dos pagamentos não corresponde ao total da venda',
        });
      }
      effectivePayments = payments.map(p => ({
        paymentMethod: normalizePaymentMethod(p.paymentMethod),
        amount: p.amount,
      }));
    } else if (orderData.paymentMethod) {
      // Backward compatible: single payment
      effectivePayments = [{
        paymentMethod: normalizePaymentMethod(orderData.paymentMethod),
        amount: orderData.total,
      }];
    } else {
      return reply.status(400).send({ error: 'paymentMethod ou payments é obrigatório' });
    }

    // Derive paymentStatus: PENDING if any payment is fiado
    const isFiado = hasFiadoPayment(effectivePayments);
    if (isFiado && orderData.paymentStatus === 'PAID') {
      orderData.paymentStatus = 'PENDING';
    }

    // Primary method for legacy Order.paymentMethod column
    const primaryMethod = effectivePayments[0].paymentMethod;

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
          // Tax rate: weighted average from all payment methods
          let taxRate = 0;
          for (const payment of effectivePayments) {
            const config = await tx.paymentMethodConfig.findUnique({
              where: {
                tenantId_paymentMethod: {
                  tenantId: request.tenantId,
                  paymentMethod: payment.paymentMethod,
                },
              },
              select: { taxRate: true },
            });
            const rate = config?.taxRate ? Number(config.taxRate) : 0;
            taxRate += (rate * payment.amount) / orderData.total;
          }
          taxRate = Math.round(taxRate * 100) / 100;

          // FIFO: consume from oldest batches, optionally starting from a specific batch
          let remaining = item.quantity;
          let totalCostAcc = 0;

          // If seller chose a specific batch, try to consume from it first
          if ((item as any).batchId) {
            const chosenBatch = await tx.inventoryBatch.findFirst({
              where: {
                id: (item as any).batchId,
                tenantId: request.tenantId,
                remainingQty: { gt: 0 },
              },
            });
            if (chosenBatch) {
              const consume = Math.min(Number(chosenBatch.remainingQty), remaining);
              const batchCost = Number(chosenBatch.unitCost);

              await tx.inventoryBatch.update({
                where: { id: chosenBatch.id },
                data: { remainingQty: { decrement: consume } },
              });

              await tx.inventoryMovement.create({
                data: {
                  tenantId: request.tenantId,
                  productId: item.productId,
                  variationId: item.variationId || null,
                  type: 'SALE_OUT',
                  quantity: -consume,
                  unitCost: batchCost,
                  totalCost: -(consume * batchCost),
                  batchId: chosenBatch.id,
                  notes: `Venda #${orderNumber} - ${item.productName} (lote escolhido)`,
                },
              });

              totalCostAcc += consume * batchCost;
              remaining -= consume;
            }
          }

          // Remaining: consume FEFO (nearest expiry first, nulls last), then FIFO by receivedAt
          const batches = await tx.inventoryBatch.findMany({
            where: {
              tenantId: request.tenantId,
              productId: item.productId,
              variationId: item.variationId || null,
              remainingQty: { gt: 0 },
            },
            orderBy: [
              { expiryDate: { sort: 'asc', nulls: 'last' } },
              { receivedAt: 'asc' },
            ],
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
          paymentMethod: primaryMethod, // legacy: first payment method
          tenantId: request.tenantId,
          userId: request.userId,
          orderNumber,
          localId,
          createdAtDevice: createdAtDevice ? new Date(createdAtDevice) : null,
          dueDate: orderData.dueDate ? new Date(orderData.dueDate) : null,
          syncStatus: 'SYNCED',
          items: { create: itemsData },
        },
        include: { items: true, customer: true, payments: true },
      });

      // Create OrderPayment records
      for (const payment of effectivePayments) {
        await tx.orderPayment.create({
          data: {
            orderId: o.id,
            paymentMethod: payment.paymentMethod,
            amount: payment.amount,
          },
        });
      }

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
        if (isFiado) {
          const fiadoAmount = effectivePayments
            .filter(p => p.paymentMethod === 'credit_store')
            .reduce((sum, p) => sum + p.amount, 0);
          const updatedCustomer = await tx.customer.update({
            where: { id: orderData.customerId },
            data: { creditBalance: { increment: fiadoAmount } },
          });
          await tx.creditTransaction.create({
            data: {
              customerId: orderData.customerId,
              type: 'LOAN',
              amount: fiadoAmount,
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
      // Check if this order actually consumed stock (has costPrice set on items)
      const hasConsumedStock = order.items.some(item => item.costPrice != null);

      for (const item of order.items) {
        if (item.productId) {
          // Only restore stock and create cancel movement if stock was consumed
          if (hasConsumedStock) {
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
            await tx.inventoryBatch.create({
              data: {
                tenantId: request.tenantId,
                productId: item.productId,
                variationId: (item as any).variationId || null,
                quantity: item.quantity,
                remainingQty: item.quantity,
                unitCost: item.costPrice ? Number(item.costPrice) : 0,
                receivedAt: new Date(),
              },
            });

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
      select: {
        total: true,
        paymentMethod: true,
        paymentStatus: true,
        payments: { select: { paymentMethod: true, amount: true } },
      },
    });

    const paidOrders = orders.filter(o => o.paymentStatus === 'PAID');
    const pendingOrders = orders.filter(o => o.paymentStatus === 'PENDING' || o.paymentStatus === 'CREDIT_STORE');

    const totalSales = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const pendingAmount = pendingOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const count = paidOrders.length;
    const pendingCount = pendingOrders.length;
    const byMethod = orders.reduce((acc: Record<string, { count: number; total: number }>, o) => {
      if (o.payments && o.payments.length > 0) {
        for (const p of o.payments) {
          const method = p.paymentMethod || 'outro';
          if (!acc[method]) acc[method] = { count: 0, total: 0 };
          acc[method].total += Number(p.amount);
        }
        // Count the order once under its first payment method
        const firstMethod = o.payments[0].paymentMethod || 'outro';
        if (!acc[firstMethod]) acc[firstMethod] = { count: 0, total: 0 };
        acc[firstMethod].count++;
      } else {
        // Fallback for old orders without OrderPayment records
        const method = o.paymentMethod || 'outro';
        if (!acc[method]) acc[method] = { count: 0, total: 0 };
        acc[method].count++;
        acc[method].total += Number(o.total);
      }
      return acc;
    }, {});

    return { date: today.toISOString().slice(0, 10), totalSales, count, pendingAmount, pendingCount, byMethod };
  });

  // Confirm an ONLINE pending order (consume stock, mark as paid)
  app.post('/:id/confirm', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as {
      itemBatchIds?: Record<string, string>;
      paymentMethod?: string;
      payments?: Array<{ paymentMethod: string; amount: number }>;
    };
    const { itemBatchIds, paymentMethod: legacyPaymentMethod, payments } = body;

    // Build effective payments for confirm
    let confirmPayments: Array<{ paymentMethod: string; amount: number }> = [];
    if (payments && payments.length > 0) {
      confirmPayments = payments.map(p => ({
        paymentMethod: normalizePaymentMethod(p.paymentMethod),
        amount: p.amount,
      }));
    } else if (legacyPaymentMethod) {
      confirmPayments = [{ paymentMethod: normalizePaymentMethod(legacyPaymentMethod), amount: 0 }];
    }

    const order = await prisma.order.findFirst({
      where: { OR: [{ id }, { localId: id }], tenantId: request.tenantId },
      include: { items: true, customer: true, payments: true },
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

    // Fiado orders: keep payment PENDING so seller can receive payment separately
    const isFiadoOrder = order.payments?.some((p) => p.paymentMethod === 'credit_store')
      || order.paymentMethod === 'credit_store';

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (item.productId) {
          const qty = Number(item.quantity);
          let remaining = qty;
          let totalCostAcc = 0;

          // If admin chose a specific batch for this item, consume from it first
          const chosenBatchId = itemBatchIds?.[item.id];
          if (chosenBatchId) {
            const chosenBatch = await tx.inventoryBatch.findFirst({
              where: { id: chosenBatchId, tenantId: request.tenantId, remainingQty: { gt: 0 } },
            });
            if (chosenBatch) {
              const consume = Math.min(Number(chosenBatch.remainingQty), remaining);
              const batchCost = Number(chosenBatch.unitCost);
              totalCostAcc += consume * batchCost;

              await tx.inventoryBatch.update({
                where: { id: chosenBatch.id },
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
                  batchId: chosenBatch.id,
                  orderId: order.id,
                  notes: `Pedido online #${order.orderNumber} - ${item.productName} (lote escolhido)`,
                },
              });

              remaining -= consume;
            }
          }

          // Remaining: consume from oldest batches (FIFO)
          const batches = await tx.inventoryBatch.findMany({
            where: {
              tenantId: request.tenantId,
              productId: item.productId,
              variationId: (item as any).variationId || null,
              remainingQty: { gt: 0 },
            },
            orderBy: [
              { expiryDate: { sort: 'asc', nulls: 'last' } },
              { receivedAt: 'asc' },
            ],
          });

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
      const primaryConfirmMethod = confirmPayments.length > 0
        ? confirmPayments[0].paymentMethod
        : undefined;

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: isFiadoOrder ? 'PENDING' : 'PAID',
          status: 'COMPLETED',
          ...(primaryConfirmMethod ? { paymentMethod: primaryConfirmMethod, paidWithMethod: primaryConfirmMethod } : {}),
        },
      });

      // Non-fiado: create OrderPayment records + cash flow + customer stats
      if (!isFiadoOrder) {
        // Create OrderPayment records if not already present (idempotent)
        const existingPayments = await tx.orderPayment.count({ where: { orderId: order.id } });
        if (existingPayments === 0) {
          let effectiveConfirmPayments = confirmPayments;
          // If no explicit payments provided, derive from legacy method and order total
          if (effectiveConfirmPayments.length === 0) {
            const method = legacyPaymentMethod || order.paymentMethod || 'cash';
            effectiveConfirmPayments = [{ paymentMethod: normalizePaymentMethod(method), amount: Number(order.total) }];
          } else {
            // Resolve amounts: use provided amounts, or fall back to order total for first payment
            const totalAmount = effectiveConfirmPayments.reduce((s, p) => s + p.amount, 0);
            if (totalAmount === 0) {
              effectiveConfirmPayments = effectiveConfirmPayments.map((p, i) => ({
                ...p,
                amount: i === 0 ? Number(order.total) : 0,
              })).filter(p => p.amount > 0);
            } else if (!validatePaymentTotal(effectiveConfirmPayments, Number(order.total))) {
              throw new Error('Soma dos pagamentos não corresponde ao total do pedido');
            }
          }

          for (const payment of effectiveConfirmPayments) {
            await tx.orderPayment.create({
              data: {
                orderId: order.id,
                paymentMethod: payment.paymentMethod,
                amount: payment.amount,
              },
            });
          }

          // Weighted average tax rate across payment methods
          const total = Number(order.total);
          let weightedTax = 0;
          for (const payment of effectiveConfirmPayments) {
            const config = await tx.paymentMethodConfig.findUnique({
              where: {
                tenantId_paymentMethod: {
                  tenantId: request.tenantId,
                  paymentMethod: payment.paymentMethod,
                },
              },
              select: { taxRate: true },
            });
            const rate = config?.taxRate ? Number(config.taxRate) : 0;
            weightedTax += (rate * payment.amount) / total;
          }
          const taxRate = Math.round(weightedTax * 100) / 100;
          await tx.orderItem.updateMany({
            where: { orderId: order.id },
            data: { taxRate },
          });
        }

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
      paymentMethod: z.string().optional(), // legacy: metodo de pagamento ao quitar fiado
      payments: z.array(paymentEntrySchema).optional(), // multi-payment ao quitar
    });
    const parsed = schema.safeParse(request.body || {});
    const paidAmount = parsed.success && parsed.data.paidAmount ? parsed.data.paidAmount : Number(order.total);
    const paymentMethod = parsed.success ? parsed.data.paymentMethod : undefined;
    const payPayments = parsed.success && parsed.data.payments ? parsed.data.payments : undefined;
    const newPaymentStatus = paidAmount >= Number(order.total) ? 'PAID' : 'PARTIAL';

    // Build effective payments for this pay action
    let effectivePayPayments: Array<{ paymentMethod: string; amount: number }> = [];
    if (payPayments && payPayments.length > 0) {
      effectivePayPayments = payPayments.map(p => ({
        paymentMethod: normalizePaymentMethod(p.paymentMethod),
        amount: p.amount,
      }));
    } else if (paymentMethod) {
      effectivePayPayments = [{ paymentMethod: normalizePaymentMethod(paymentMethod), amount: paidAmount }];
    }

    // Primary payment method for legacy fields
    const primaryPayMethod = effectivePayPayments.length > 0
      ? effectivePayPayments[0].paymentMethod
      : paymentMethod;

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: newPaymentStatus,
          paidAmount: { increment: paidAmount },
          ...(primaryPayMethod ? { paidWithMethod: primaryPayMethod } : {}),
        },
      });

      // Create OrderPayment records for the pay action if not already present
      if (effectivePayPayments.length > 0) {
        const existingPayments = await tx.orderPayment.count({ where: { orderId: order.id } });
        if (existingPayments === 0) {
          for (const payment of effectivePayPayments) {
            await tx.orderPayment.create({
              data: {
                orderId: order.id,
                paymentMethod: payment.paymentMethod,
                amount: payment.amount,
              },
            });
          }
        }

        // Weighted average tax rate across pay methods
        let weightedTax = 0;
        for (const payment of effectivePayPayments) {
          const config = await tx.paymentMethodConfig.findUnique({
            where: {
              tenantId_paymentMethod: {
                tenantId: request.tenantId,
                paymentMethod: payment.paymentMethod,
              },
            },
            select: { taxRate: true },
          });
          const rate = config?.taxRate ? Number(config.taxRate) : 0;
          weightedTax += (rate * payment.amount) / paidAmount;
        }
        const taxRate = Math.round(weightedTax * 100) / 100;
        await tx.orderItem.updateMany({
          where: { orderId: order.id },
          data: { taxRate },
        });
      } else if (paymentMethod) {
        // Legacy fallback: single payment method
        const normalizedMethod = normalizePaymentMethod(paymentMethod);
        const paymentConfig = await tx.paymentMethodConfig.findUnique({
          where: {
            tenantId_paymentMethod: {
              tenantId: request.tenantId,
              paymentMethod: normalizedMethod,
            },
          },
          select: { taxRate: true },
        });
        const newTaxRate = paymentConfig?.taxRate ? Number(paymentConfig.taxRate) : 0;
        await tx.orderItem.updateMany({
          where: { orderId: order.id },
          data: { taxRate: newTaxRate },
        });
      }

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
