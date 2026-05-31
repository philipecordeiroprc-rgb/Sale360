import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';

const r2 = (v: number) => Math.round(v * 100) / 100;

export const indicatorRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const { startDate, endDate } = request.query as Record<string, string>;

    // ── Date filter ──
    const dateFilter: any = {};
    if (startDate) {
      const [y, m, d] = startDate.split('-').map(Number);
      dateFilter.gte = new Date(y, m - 1, d);
    }
    if (endDate) {
      const [y, m, d] = endDate.split('-').map(Number);
      dateFilter.lte = new Date(y, m - 1, d, 23, 59, 59, 999);
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const orderWhere: any = {
      tenantId: request.tenantId,
      status: { not: 'CANCELLED' },
    };
    if (hasDateFilter) orderWhere.createdAt = dateFilter;

    const purchaseWhere: any = {
      tenantId: request.tenantId,
      status: 'RECEIVED',
    };
    if (hasDateFilter) purchaseWhere.createdAt = dateFilter;

    // ── 7 parallel base queries ──
    const [
      orders,
      products,
      batches,
      receivedPurchases,
      pendingCounts,
      creditCustomers,
      lastSaleItems,
    ] = await Promise.all([
      // 1. Orders + items + user + customer
      prisma.order.findMany({
        where: orderWhere,
        include: {
          items: { include: { product: { select: { operationalCost: true } } } },
          user: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true } },
          payments: { select: { paymentMethod: true, amount: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // 2. Active products
      prisma.product.findMany({
        where: { tenantId: request.tenantId, active: true },
        select: {
          id: true, name: true, stockQty: true, price: true,
          lowStockAt: true, operationalCost: true,
        },
      }),
      // 3. Inventory batches with remaining stock
      prisma.inventoryBatch.findMany({
        where: { tenantId: request.tenantId, remainingQty: { gt: 0 } },
        select: { remainingQty: true, unitCost: true },
      }),
      // 4. Received purchases with supplier
      prisma.purchase.findMany({
        where: purchaseWhere,
        select: {
          total: true, createdAt: true, receivedAt: true,
          supplier: { select: { id: true, name: true } },
        },
      }),
      // 5. Pending purchase counts
      prisma.purchase.groupBy({
        by: ['status'],
        where: { tenantId: request.tenantId, status: { in: ['DRAFT', 'CONFIRMED'] } },
        _count: { _all: true },
      }),
      // 6. Customers with open credit
      prisma.customer.findMany({
        where: { tenantId: request.tenantId, creditBalance: { gt: 0 } },
        select: { id: true, name: true, creditBalance: true },
        orderBy: { creditBalance: 'desc' },
      }),
      // 7. Last sale per product (for encalhados)
      prisma.orderItem.findMany({
        where: {
          productId: { not: null },
          order: { tenantId: request.tenantId, status: { not: 'CANCELLED' } },
        },
        select: { productId: true, order: { select: { createdAt: true } } },
        orderBy: { order: { createdAt: 'desc' } },
      }),
    ]);

    // ── Split orders ──
    const paidOrders = orders.filter(o => o.paymentStatus === 'PAID');
    const pendingFiado = orders.filter(
      o => o.paymentStatus === 'PENDING' || o.paymentStatus === 'CREDIT_STORE',
    );

    // ═══════════════════════════════════════════
    // 1. FINANCEIRO
    // ═══════════════════════════════════════════

    let faturamentoBruto = 0;
    let faturamentoLiquido = 0;
    let cmv = 0;
    let custoOperacional = 0;
    let perdaTaxaCartao = 0;

    for (const o of paidOrders) {
      faturamentoBruto += Number(o.total);
      faturamentoLiquido += Number(o.total) - Number(o.discount || 0) - Number(o.couponDiscount || 0);
      for (const item of o.items) {
        cmv += Number(item.totalCost || 0);
        custoOperacional += Number(item.product?.operationalCost || 0) * Number(item.quantity);
        perdaTaxaCartao += Number(item.total) * (Number(item.taxRate || 0) / 100);
      }
    }

    const lucroBruto = faturamentoLiquido - cmv;
    const margemBruta = faturamentoLiquido > 0 ? (lucroBruto / faturamentoLiquido) * 100 : 0;
    const lucroLiquidoEstimado = lucroBruto - custoOperacional - perdaTaxaCartao;
    const ticketMedio = paidOrders.length > 0 ? faturamentoBruto / paidOrders.length : 0;

    // Faturamento por forma de pagamento
    // Fiado settled: use paidWithMethod (real settlement method), not credit_store
    const paymentMap = new Map<string, { count: number; total: number; fiadoCount: number; fiadoTotal: number }>();
    let fiadoSettledTotal = 0;
    let fiadoSettledCount = 0;
    for (const o of paidOrders) {
      const hasCreditStore = o.payments?.some(p => p.paymentMethod === 'credit_store')
        || o.paymentMethod === 'credit_store';

      if (hasCreditStore && (o as any).paidWithMethod) {
        // Fiado order that was settled — count under the actual settlement method
        const method = (o as any).paidWithMethod;
        const entry = paymentMap.get(method) || { count: 0, total: 0, fiadoCount: 0, fiadoTotal: 0 };
        entry.count++;
        entry.total += Number(o.total);
        entry.fiadoCount++;
        entry.fiadoTotal += Number(o.total);
        paymentMap.set(method, entry);
        fiadoSettledTotal += Number(o.total);
        fiadoSettledCount++;
      } else if (o.payments && o.payments.length > 0) {
        for (const p of o.payments) {
          const method = p.paymentMethod || 'outro';
          const entry = paymentMap.get(method) || { count: 0, total: 0, fiadoCount: 0, fiadoTotal: 0 };
          entry.total += Number(p.amount);
          paymentMap.set(method, entry);
        }
        // Count the order once under its first payment method
        const firstMethod = o.payments[0].paymentMethod || 'outro';
        const firstEntry = paymentMap.get(firstMethod) || { count: 0, total: 0, fiadoCount: 0, fiadoTotal: 0 };
        firstEntry.count++;
        paymentMap.set(firstMethod, firstEntry);
      } else {
        // Fallback for old orders without OrderPayment records
        const method = o.paymentMethod || 'outro';
        const entry = paymentMap.get(method) || { count: 0, total: 0, fiadoCount: 0, fiadoTotal: 0 };
        entry.count++;
        entry.total += Number(o.total);
        paymentMap.set(method, entry);
      }
    }
    const faturamentoPorFormaPagamento = Array.from(paymentMap.entries())
      .map(([method, v]) => ({
        method,
        count: v.count,
        total: r2(v.total),
        percentage: faturamentoBruto > 0 ? r2((v.total / faturamentoBruto) * 100) : 0,
        fiadoCount: v.fiadoCount,
        fiadoTotal: r2(v.fiadoTotal),
      }))
      .sort((a, b) => b.total - a.total);

    const financial = {
      faturamentoBruto: r2(faturamentoBruto),
      faturamentoLiquido: r2(faturamentoLiquido),
      cmv: r2(cmv),
      lucroBruto: r2(lucroBruto),
      margemBruta: r2(margemBruta),
      custoOperacional: r2(custoOperacional),
      perdaTaxaCartao: r2(perdaTaxaCartao),
      lucroLiquidoEstimado: r2(lucroLiquidoEstimado),
      ticketMedio: r2(ticketMedio),
      faturamentoPorFormaPagamento,
      fiadoSettled: {
        count: fiadoSettledCount,
        total: r2(fiadoSettledTotal),
      },
    };

    // ═══════════════════════════════════════════
    // 2. ESTOQUE
    // ═══════════════════════════════════════════

    // Valor total estoque (custo) via batches
    let valorTotalEstoqueCusto = 0;
    for (const b of batches) {
      valorTotalEstoqueCusto += Number(b.remainingQty) * Number(b.unitCost);
    }

    // Valor potencial venda (preço de venda × stock atual)
    let valorPotencialEstoqueVenda = 0;
    for (const p of products) {
      valorPotencialEstoqueVenda += Number(p.stockQty) * Number(p.price);
    }

    const margemPotencial = valorPotencialEstoqueVenda - valorTotalEstoqueCusto;
    const margemPotencialPercent = valorPotencialEstoqueVenda > 0
      ? (margemPotencial / valorPotencialEstoqueVenda) * 100 : 0;

    // Dias de cobertura
    const daysInPeriod = hasDateFilter
      ? Math.max(1, Math.ceil((Number(dateFilter.lte || new Date()) - Number(dateFilter.gte || new Date())) / 86400000))
      : 30;
    const dailyAvgRevenue = faturamentoBruto / daysInPeriod;
    const diasCobertura = dailyAvgRevenue > 0 ? valorTotalEstoqueCusto / dailyAvgRevenue : 0;

    // Giro de estoque
    const giroEstoque = valorTotalEstoqueCusto > 0 ? cmv / valorTotalEstoqueCusto : 0;

    // Top 10 produtos mais vendidos (dos paidOrders)
    const productSalesMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const o of paidOrders) {
      for (const item of o.items) {
        const pid = item.productId || 'deleted';
        const existing = productSalesMap.get(pid);
        if (existing) {
          existing.quantity += Number(item.quantity);
          existing.revenue += Number(item.total);
        } else {
          productSalesMap.set(pid, {
            name: item.productName || 'Produto removido',
            quantity: Number(item.quantity),
            revenue: Number(item.total),
          });
        }
      }
    }
    const top10Produtos = Array.from(productSalesMap.entries())
      .map(([id, v]) => ({ id: id === 'deleted' ? null : id, ...v, revenue: r2(v.revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Last sale date per product (dedup from lastSaleItems)
    const lastSaleMap = new Map<string, Date>();
    for (const item of lastSaleItems) {
      if (item.productId && item.order && !lastSaleMap.has(item.productId)) {
        lastSaleMap.set(item.productId, new Date(item.order.createdAt));
      }
    }

    // Produtos encalhados
    const now = Date.now();
    const DAY = 86400000;
    let encDias30 = 0, encDias60 = 0, encDias90 = 0;
    const encList: { id: string; name: string; lastSaleAt: string }[] = [];
    for (const p of products) {
      const lastSale = lastSaleMap.get(p.id);
      if (!lastSale) {
        // Nunca vendeu
        encDias30++; encDias60++; encDias90++;
        encList.push({ id: p.id, name: p.name, lastSaleAt: '' });
        continue;
      }
      const daysSince = (now - lastSale.getTime()) / DAY;
      if (daysSince > 90) { encDias30++; encDias60++; encDias90++; }
      else if (daysSince > 60) { encDias30++; encDias60++; }
      else if (daysSince > 30) { encDias30++; }
      if (daysSince > 30) {
        encList.push({ id: p.id, name: p.name, lastSaleAt: lastSale.toISOString() });
      }
    }
    encList.sort((a, b) => {
      if (!a.lastSaleAt) return -1;
      if (!b.lastSaleAt) return 1;
      return new Date(a.lastSaleAt).getTime() - new Date(b.lastSaleAt).getTime();
    });

    // Produtos com estoque baixo
    const estoqueBaixo = products
      .filter(p => p.lowStockAt !== null && Number(p.stockQty) <= Number(p.lowStockAt!))
      .map(p => ({
        id: p.id,
        name: p.name,
        stockQty: Number(p.stockQty),
        lowStockAt: Number(p.lowStockAt!),
      }))
      .sort((a, b) => (a.stockQty / a.lowStockAt) - (b.stockQty / b.lowStockAt));

    const inventory = {
      valorTotalEstoqueCusto: r2(valorTotalEstoqueCusto),
      valorPotencialEstoqueVenda: r2(valorPotencialEstoqueVenda),
      margemPotencial: r2(margemPotencial),
      margemPotencialPercent: r2(margemPotencialPercent),
      diasCobertura: r2(diasCobertura),
      top10Produtos,
      produtosEncalhados: {
        dias30: encDias30,
        dias60: encDias60,
        dias90: encDias90,
        lista: encList.slice(0, 20),
      },
      estoqueBaixo,
      giroEstoque: r2(giroEstoque),
    };

    // ═══════════════════════════════════════════
    // 3. COMPRAS & FORNECEDORES
    // ═══════════════════════════════════════════

    let totalGasto = 0;
    let totalDeliveryDays = 0;
    let deliveriesWithDates = 0;
    const supplierMap = new Map<string, { name: string; total: number; count: number }>();

    for (const p of receivedPurchases) {
      totalGasto += Number(p.total);
      const sid = p.supplier?.id || 'unknown';
      const entry = supplierMap.get(sid) || {
        name: p.supplier?.name || 'Fornecedor removido',
        total: 0,
        count: 0,
      };
      entry.total += Number(p.total);
      entry.count++;
      supplierMap.set(sid, entry);

      if (p.receivedAt) {
        totalDeliveryDays += (new Date(p.receivedAt).getTime() - new Date(p.createdAt).getTime()) / DAY;
        deliveriesWithDates++;
      }
    }

    const prazoMedioEntrega = deliveriesWithDates > 0 ? totalDeliveryDays / deliveriesWithDates : 0;

    const porFornecedor = Array.from(supplierMap.entries())
      .map(([id, v]) => ({ id: id === 'unknown' ? '' : id, ...v, total: r2(v.total) }))
      .sort((a, b) => b.total - a.total);

    // Compras pendentes
    let draftCount = 0, confirmedCount = 0;
    for (const g of pendingCounts) {
      if (g.status === 'DRAFT') draftCount = g._count._all;
      if (g.status === 'CONFIRMED') confirmedCount = g._count._all;
    }

    const purchases = {
      totalGasto: r2(totalGasto),
      porFornecedor,
      prazoMedioEntrega: r2(prazoMedioEntrega),
      comprasPendentes: {
        draft: draftCount,
        confirmed: confirmedCount,
        total: draftCount + confirmedCount,
      },
    };

    // ═══════════════════════════════════════════
    // 4. CLIENTES
    // ═══════════════════════════════════════════

    const customerMap = new Map<string, { name: string; total: number; orders: number }>();
    for (const o of paidOrders) {
      if (!o.customerId) continue;
      const entry = customerMap.get(o.customerId) || {
        name: o.customer?.name || 'Cliente removido',
        total: 0,
        orders: 0,
      };
      entry.total += Number(o.total);
      entry.orders++;
      customerMap.set(o.customerId, entry);
    }

    const totalAtivos = customerMap.size;
    const clientesComMaisDeUma = Array.from(customerMap.values()).filter(c => c.orders > 1).length;
    const percentualRecorrentes = totalAtivos > 0 ? (clientesComMaisDeUma / totalAtivos) * 100 : 0;

    const top10Clientes = Array.from(customerMap.entries())
      .map(([id, v]) => ({ id, ...v, total: r2(v.total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const ordersWithCustomer = paidOrders.filter(o => o.customerId).length;
    const totalFromCustomers = Array.from(customerMap.values()).reduce((s, c) => s + c.total, 0);
    const ticketMedioPorCliente = ordersWithCustomer > 0 ? totalFromCustomers / ordersWithCustomer : 0;

    // Fiado em aberto
    let fiadoEmAberto = 0;
    const fiadoClientes = creditCustomers.map(c => {
      const bal = Number(c.creditBalance);
      fiadoEmAberto += bal;
      return { id: c.id, name: c.name, creditBalance: r2(bal) };
    });

    const customers = {
      totalAtivos,
      top10Clientes,
      percentualRecorrentes: r2(percentualRecorrentes),
      fiadoEmAberto: r2(fiadoEmAberto),
      fiadoClientes,
      ticketMedioPorCliente: r2(ticketMedioPorCliente),
    };

    // ═══════════════════════════════════════════
    // 5. OPERACIONAL
    // ═══════════════════════════════════════════

    // Vendas por vendedor
    const sellerMap = new Map<string, { name: string; orders: number; total: number }>();
    for (const o of paidOrders) {
      const uid = o.userId || 'unassigned';
      const entry = sellerMap.get(uid) || {
        name: o.user?.name || 'Não atribuído',
        orders: 0,
        total: 0,
      };
      entry.orders++;
      entry.total += Number(o.total);
      sellerMap.set(uid, entry);
    }
    const vendasPorVendedor = Array.from(sellerMap.entries())
      .map(([id, v]) => ({ id: id === 'unassigned' ? '' : id, ...v, total: r2(v.total) }))
      .sort((a, b) => b.total - a.total);

    // Horários de pico
    const hourlyMap = new Map<number, { count: number; total: number }>();
    for (let h = 0; h < 24; h++) hourlyMap.set(h, { count: 0, total: 0 });
    for (const o of paidOrders) {
      const hour = new Date(o.createdAt).getHours();
      const entry = hourlyMap.get(hour)!;
      entry.count++;
      entry.total += Number(o.total);
    }
    const horariosPico = Array.from(hourlyMap.entries())
      .map(([hour, v]) => ({ hour, count: v.count, total: r2(v.total) }));

    // % vendas offline
    const offlineCount = orders.filter(o => o.syncStatus !== 'SYNCED').length;
    const percentualOffline = orders.length > 0 ? (offlineCount / orders.length) * 100 : 0;

    const operational = {
      vendasPorVendedor,
      horariosPico,
      percentualOffline: r2(percentualOffline),
    };

    // ── Response ──
    return {
      financial,
      inventory,
      purchases,
      customers,
      operational,
    };
  });
};
