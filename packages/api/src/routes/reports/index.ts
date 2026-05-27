import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';

export const reportRoutes: FastifyPluginAsync = async (app) => {
  app.get('/financial', async (request) => {
    const { startDate, endDate } = request.query as Record<string, string>;

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const orderWhere: any = {
      tenantId: request.tenantId,
      status: { not: 'CANCELLED' },
    };
    if (Object.keys(dateFilter).length > 0) {
      orderWhere.createdAt = dateFilter;
    }

    // Query all orders with items + customer + user in the period
    const orders = await prisma.order.findMany({
      where: orderWhere,
      include: {
        items: { include: { product: { select: { operationalCost: true } } } },
        customer: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
        payments: { select: { paymentMethod: true, amount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Split orders: PAID = faturamento real, PENDING = contas a receber
    const paidOrders = orders.filter(o => o.paymentStatus === 'PAID');
    const pendingOrders = orders.filter(o => o.paymentStatus === 'PENDING');

    // ── Summary (apenas vendas PAGAS) ──
    const revenue = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const orderCount = paidOrders.length;
    const avgTicket = orderCount > 0 ? revenue / orderCount : 0;

    // Profit = revenue - CMV (totalCost) - operational cost - tax (card fee)
    let costTotal = 0;
    let profit = 0;
    for (const o of paidOrders) {
      for (const item of o.items) {
        const itemRevenue = Number(item.total);
        const itemCost = Number(item.totalCost || 0);
        const opsCost = (Number(item.product?.operationalCost || 0)) * Number(item.quantity);
        const taxRate = Number(item.taxRate || 0); // taxa cartão (%) no momento da venda
        const taxAmount = itemRevenue * (taxRate / 100);
        costTotal += itemCost + opsCost + taxAmount;
        profit += itemRevenue - itemCost - opsCost - taxAmount;
      }
    }

    // ── Payment Methods (apenas vendas PAGAS) ──
    const paymentMap: Record<string, { count: number; total: number }> = {};
    for (const o of paidOrders) {
      if (o.payments && o.payments.length > 0) {
        for (const p of o.payments) {
          const method = p.paymentMethod || 'Outro';
          if (!paymentMap[method]) paymentMap[method] = { count: 0, total: 0 };
          paymentMap[method].total += Number(p.amount);
        }
        const firstMethod = o.payments[0].paymentMethod || 'Outro';
        if (!paymentMap[firstMethod]) paymentMap[firstMethod] = { count: 0, total: 0 };
        paymentMap[firstMethod].count++;
      } else {
        const method = o.paymentMethod || 'Outro';
        if (!paymentMap[method]) paymentMap[method] = { count: 0, total: 0 };
        paymentMap[method].count++;
        paymentMap[method].total += Number(o.total);
      }
    }
    const paymentMethods = Object.entries(paymentMap)
      .map(([method, data]) => ({ method, ...data }))
      .sort((a, b) => b.total - a.total);

    // ── Top Products (apenas vendas PAGAS) ──
    const productMap: Record<string, { name: string; quantity: number; revenue: number; profit: number }> = {};
    for (const o of paidOrders) {
      for (const item of o.items) {
        const name = item.productName;
        if (!productMap[name]) productMap[name] = { name, quantity: 0, revenue: 0, profit: 0 };
        const itemRevenue = Number(item.total);
        const itemCost = Number(item.totalCost || 0);
        const opsCost = (Number(item.product?.operationalCost || 0)) * Number(item.quantity);
        const taxRate = Number(item.taxRate || 0);
        const taxAmount = itemRevenue * (taxRate / 100);
        productMap[name].quantity += Number(item.quantity);
        productMap[name].revenue += itemRevenue;
        productMap[name].profit += itemRevenue - itemCost - opsCost - taxAmount;
      }
    }
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 30);

    // ── Top Customers (apenas vendas PAGAS) ──
    const customerMap: Record<string, { id: string; name: string; orders: number; total: number }> = {};
    for (const o of paidOrders) {
      if (!o.customerId) continue;
      const c = o.customer;
      if (!c) continue;
      if (!customerMap[c.id]) customerMap[c.id] = { id: c.id, name: c.name, orders: 0, total: 0 };
      customerMap[c.id].orders++;
      customerMap[c.id].total += Number(o.total);
    }
    const topCustomers = Object.values(customerMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    // ── Top Sellers (apenas vendas PAGAS) ──
    const sellerMap: Record<string, { id: string; name: string; orders: number; total: number }> = {};
    for (const o of paidOrders) {
      const u = o.user;
      if (!u) continue;
      if (!sellerMap[u.id]) sellerMap[u.id] = { id: u.id, name: u.name, orders: 0, total: 0 };
      sellerMap[u.id].orders++;
      sellerMap[u.id].total += Number(o.total);
    }
    const topSellers = Object.values(sellerMap)
      .sort((a, b) => b.total - a.total);

    // ── Curva ABC (apenas vendas PAGAS) ──
    const allProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = allProducts.reduce((sum, p) => sum + p.revenue, 0);
    let cumulative = 0;
    const abcCurve = allProducts.map((p) => {
      const pct = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0;
      cumulative += pct;
      let cls = 'C';
      if (cumulative - pct <= 80) cls = 'A';
      else if (cumulative - pct <= 95) cls = 'B';
      return {
        name: p.name,
        quantity: p.quantity,
        revenue: p.revenue,
        percentage: Math.round(pct * 100) / 100,
        cumulative: Math.round(cumulative * 100) / 100,
        class: cls,
      };
    });

    // ── Contas a Receber ──
    const pendingAmount = pendingOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const pendingCount = pendingOrders.length;
    const fiadoPendingOrders = pendingOrders.filter(o => {
      if (o.payments && o.payments.length > 0) {
        return o.payments.some(p => p.paymentMethod === 'credit_store');
      }
      return o.paymentMethod === 'credit_store';
    });
    const fiadoCount = fiadoPendingOrders.length;
    const fiadoAmount = fiadoPendingOrders.reduce((sum, o) => sum + Number(o.total), 0);

    return {
      period: { startDate: startDate || null, endDate: endDate || null },
      summary: {
        revenue: Math.round(revenue * 100) / 100,
        orderCount,
        avgTicket: Math.round(avgTicket * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        costTotal: Math.round(costTotal * 100) / 100,
      },
      pending: {
        count: pendingCount,
        amount: Math.round(pendingAmount * 100) / 100,
        fiadoCount,
        fiadoAmount: Math.round(fiadoAmount * 100) / 100,
      },
      paymentMethods,
      topProducts,
      topCustomers,
      topSellers,
      abcCurve,
    };
  });
};
