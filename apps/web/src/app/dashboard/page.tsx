'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Users, Package, ArrowUp, ArrowDown,
} from 'lucide-react';

// Stats cards with real-time animation
const statCards = [
  { id: 'sales', label: 'Vendas Hoje', value: 'R$ 1.240,00', change: '+12%', up: true, icon: DollarSign, color: '#34D399' },
  { id: 'orders', label: 'Pedidos', value: '23', change: '+8%', up: true, icon: ShoppingCart, color: '#6366F1' },
  { id: 'ticket', label: 'Ticket Médio', value: 'R$ 53,91', change: '-3%', up: false, icon: TrendingUp, color: '#FBBF24' },
  { id: 'customers', label: 'Novos Clientes', value: '7', change: '+15%', up: true, icon: Users, color: '#EC4899' },
];

const recentOrders = [
  { id: '#001023', customer: 'João Silva', items: 3, total: 'R$ 45,00', method: 'Pix', time: '5 min atrás' },
  { id: '#001022', customer: 'Maria Souza', items: 2, total: 'R$ 28,00', method: 'Dinheiro', time: '12 min atrás' },
  { id: '#001021', customer: 'Pedro Santos', items: 5, total: 'R$ 89,90', method: 'Crédito', time: '23 min atrás' },
  { id: '#001020', customer: 'Ana Costa', items: 1, total: 'R$ 16,00', method: 'Pix', time: '34 min atrás' },
  { id: '#001019', customer: 'Carlos Lima', items: 4, total: 'R$ 72,50', method: 'Débito', time: '45 min atrás' },
];

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Dashboard</h2>
          <p className="text-dark-600 mt-1">Resumo das operações de hoje</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-dark-800 border border-dark-700 rounded-xl text-sm text-white hover:bg-dark-700 transition-colors">
            Hoje
          </button>
          <button className="px-4 py-2 bg-dark-800 border border-dark-700 rounded-xl text-sm text-dark-600 hover:text-white hover:bg-dark-700 transition-colors">
            Semana
          </button>
          <button className="px-4 py-2 bg-dark-800 border border-dark-700 rounded-xl text-sm text-dark-600 hover:text-white hover:bg-dark-700 transition-colors">
            Mês
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.id}
            className="bg-dark-800 border border-dark-700 rounded-2xl p-6 hover:border-dark-600 transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: card.color + '20' }}
              >
                <card.icon size={24} color={card.color} />
              </div>
              <span
                className={`flex items-center gap-1 text-xs font-semibold ${
                  card.up ? 'text-success' : 'text-danger'
                }`}
              >
                {card.up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                {card.change}
              </span>
            </div>
            <p className="text-dark-600 text-sm">{card.label}</p>
            <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-dark-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Vendas Recentes</h3>
          <button className="text-sm text-accent hover:text-accent-light transition-colors">
            Ver todas →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700 text-dark-600 text-xs uppercase tracking-wider">
                <th className="text-left p-4 font-medium">Pedido</th>
                <th className="text-left p-4 font-medium">Cliente</th>
                <th className="text-center p-4 font-medium">Itens</th>
                <th className="text-right p-4 font-medium">Total</th>
                <th className="text-center p-4 font-medium">Pagamento</th>
                <th className="text-right p-4 font-medium">Hora</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-dark-700/50 hover:bg-dark-700/50 transition-colors"
                >
                  <td className="p-4">
                    <span className="text-accent font-mono text-sm">{order.id}</span>
                  </td>
                  <td className="p-4 text-white text-sm">{order.customer}</td>
                  <td className="p-4 text-center text-dark-600 text-sm">{order.items}</td>
                  <td className="p-4 text-right text-white font-semibold text-sm">{order.total}</td>
                  <td className="p-4 text-center">
                    <span className="px-2 py-1 bg-dark-700 rounded-md text-xs text-white">
                      {order.method}
                    </span>
                  </td>
                  <td className="p-4 text-right text-dark-600 text-xs">{order.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Nova Venda', emoji: '💰', color: '#34D399' },
          { label: 'Adicionar Produto', emoji: '📦', color: '#6366F1' },
          { label: 'Abrir Comanda', emoji: '📋', color: '#FBBF24' },
          { label: 'Cadastrar Cliente', emoji: '👤', color: '#EC4899' },
        ].map((action) => (
          <button
            key={action.label}
            className="flex flex-col items-center gap-3 p-6 bg-dark-800 border border-dark-700 rounded-2xl hover:border-dark-600 transition-all group"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-transform group-hover:scale-110"
              style={{ backgroundColor: action.color + '20' }}
            >
              {action.emoji}
            </div>
            <span className="text-sm text-white font-medium">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
