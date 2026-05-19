'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, DollarSign, ShoppingCart, Users, Package, Clock,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function DashboardPage() {
  const { tenant } = useAuth();
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
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            {tenant?.companyName || 'Dashboard'}
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">Resumo das operacoes de hoje</p>
        </div>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 animate-pulse">
              <div className="h-10 w-10 bg-slate-800 rounded-lg mb-3" />
              <div className="h-3.5 bg-slate-800 rounded w-1/2 mb-1.5" />
              <div className="h-5 bg-slate-800 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((card) => (
            <div
              key={card.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-500 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: card.color + '20' }}
                >
                  <card.icon size={20} color={card.color} />
                </div>
              </div>
              <p className="text-slate-400 text-xs">{card.label}</p>
              <p className="text-lg font-bold text-white mt-0.5">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Vendas Recentes</h3>
          <span className="text-xs text-slate-500">{recentOrders.length} pedidos</span>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-8 text-center">
            <ShoppingCart size={32} className="mx-auto text-slate-600 mb-2" />
            <p className="text-sm text-slate-400">Nenhuma venda registrada</p>
            <p className="text-xs text-slate-500 mt-0.5">As vendas aparecerao aqui</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                  <th className="text-left px-3 py-2 font-medium">Pedido</th>
                  <th className="text-left px-3 py-2 font-medium">Cliente</th>
                  <th className="text-center px-3 py-2 font-medium">Itens</th>
                  <th className="text-right px-3 py-2 font-medium">Total</th>
                  <th className="text-center px-3 py-2 font-medium">Pagamento</th>
                  <th className="text-right px-3 py-2 font-medium">Hora</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o: any) => (
                  <tr key={o.id} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                    <td className="px-3 py-2">
                      <span className="text-indigo-400 font-mono text-sm">#{o.orderNumber}</span>
                    </td>
                    <td className="px-3 py-2 text-white text-sm">
                        {o.customer?.name || o.customerName ? (
                          <span>
                            {o.customer?.name || o.customerName}
                            {!o.customer?.id && o.customerName && (
                              <span className="ml-1 text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">Avulso</span>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                    <td className="px-3 py-2 text-center text-slate-400 text-sm">{o.items?.length || 0}</td>
                    <td className="px-3 py-2 text-right text-white font-semibold text-sm">R$ {Number(o.total).toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="px-1.5 py-0.5 bg-slate-800 rounded-md text-[11px] text-white">{o.paymentMethod}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400 text-xs">
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Nova Venda', emoji: '💰', color: '#34D399', href: '/orders' },
          { label: 'Adicionar Produto', emoji: '📦', color: '#6366F1', href: '/products' },
          { label: 'Nova Compra', emoji: '📋', color: '#FBBF24', href: '/purchases' },
          { label: 'Cadastrar Cliente', emoji: '👤', color: '#EC4899', href: '/customers' },
        ].map((action) => (
          <a
            key={action.label}
            href={action.href}
            className="flex flex-col items-center gap-2 p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-500 transition-all group"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-transform group-hover:scale-110"
              style={{ backgroundColor: action.color + '20' }}
            >
              {action.emoji}
            </div>
            <span className="text-xs text-white font-medium">{action.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
