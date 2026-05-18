'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, DollarSign, ShoppingCart, Users, Package,
} from 'lucide-react';
import api from '@/lib/api';

export default function DashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [newCustomers, setNewCustomers] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [todayData, ordersData, customersData, productsData] = await Promise.all([
          api.orders.todaySummary(),
          api.orders.list({ page: 1 }),
          api.customers.list({ page: 1 }),
          api.products.list({ page: 1 }),
        ]);

        setSummary(todayData);
        setRecentOrders(ordersData.orders?.slice(0, 10) || []);

        // Count new customers today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const newToday = (customersData.customers || []).filter(
          (c: any) => new Date(c.createdAt) >= today
        ).length;
        setNewCustomers(newToday);

        setProductCount(productsData.total || 0);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const totalSales = summary?.totalSales || 0;
  const orderCount = summary?.count || 0;
  const ticketMedio = orderCount > 0 ? totalSales / orderCount : 0;

  const statCards = [
    { id: 'sales', label: 'Vendas Hoje', value: `R$ ${totalSales.toFixed(2)}`, icon: DollarSign, color: '#34D399' },
    { id: 'orders', label: 'Pedidos Hoje', value: String(orderCount), icon: ShoppingCart, color: '#6366F1' },
    { id: 'ticket', label: 'Ticket Medio', value: `R$ ${ticketMedio.toFixed(2)}`, icon: TrendingUp, color: '#FBBF24' },
    { id: 'customers', label: 'Novos Clientes', value: String(newCustomers), icon: Users, color: '#EC4899' },
  ];

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Dashboard</h2>
          <p className="text-slate-400 mt-1">Resumo das operacoes de hoje</p>
        </div>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 animate-pulse">
              <div className="h-12 w-12 bg-slate-800 rounded-xl mb-4" />
              <div className="h-4 bg-slate-800 rounded w-1/2 mb-2" />
              <div className="h-6 bg-slate-800 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div
              key={card.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-500 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: card.color + '20' }}
                >
                  <card.icon size={24} color={card.color} />
                </div>
              </div>
              <p className="text-slate-400 text-sm">{card.label}</p>
              <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Vendas Recentes</h3>
          <span className="text-sm text-slate-500">{recentOrders.length} pedidos</span>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart size={40} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">Nenhuma venda registrada</p>
            <p className="text-slate-500 text-sm mt-1">As vendas aparecerao aqui</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="text-left p-4 font-medium">Pedido</th>
                  <th className="text-left p-4 font-medium">Cliente</th>
                  <th className="text-center p-4 font-medium">Itens</th>
                  <th className="text-right p-4 font-medium">Total</th>
                  <th className="text-center p-4 font-medium">Pagamento</th>
                  <th className="text-right p-4 font-medium">Hora</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o: any) => (
                  <tr key={o.id} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                    <td className="p-4">
                      <span className="text-indigo-400 font-mono text-sm">#{o.orderNumber}</span>
                    </td>
                    <td className="p-4 text-white text-sm">
                        {o.customer?.name || o.customerName ? (
                          <span>
                            {o.customer?.name || o.customerName}
                            {!o.customer?.id && o.customerName && (
                              <span className="ml-1.5 text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">Avulso</span>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                    <td className="p-4 text-center text-slate-400 text-sm">{o.items?.length || 0}</td>
                    <td className="p-4 text-right text-white font-semibold text-sm">R$ {Number(o.total).toFixed(2)}</td>
                    <td className="p-4 text-center">
                      <span className="px-2 py-1 bg-slate-800 rounded-md text-xs text-white">{o.paymentMethod}</span>
                    </td>
                    <td className="p-4 text-right text-slate-400 text-xs">
                      {new Date(o.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Nova Venda', emoji: '💰', color: '#34D399', href: '/orders' },
          { label: 'Adicionar Produto', emoji: '📦', color: '#6366F1', href: '/products' },
          { label: 'Nova Compra', emoji: '📋', color: '#FBBF24', href: '/purchases' },
          { label: 'Cadastrar Cliente', emoji: '👤', color: '#EC4899', href: '/customers' },
        ].map((action) => (
          <a
            key={action.label}
            href={action.href}
            className="flex flex-col items-center gap-3 p-6 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-500 transition-all group"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-transform group-hover:scale-110"
              style={{ backgroundColor: action.color + '20' }}
            >
              {action.emoji}
            </div>
            <span className="text-sm text-white font-medium">{action.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
