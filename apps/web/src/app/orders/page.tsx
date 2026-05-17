'use client';

import { useState } from 'react';
import { Search, Filter, Download, Eye } from 'lucide-react';

const orders = [
  { id: '#001023', customer: 'João Silva', items: 3, total: 'R$ 45,00', method: 'Pix', status: 'completed', date: '16/05/2026 14:25' },
  { id: '#001022', customer: 'Maria Souza', items: 2, total: 'R$ 28,00', method: 'Dinheiro', status: 'completed', date: '16/05/2026 14:13' },
  { id: '#001021', customer: 'Pedro Santos', items: 5, total: 'R$ 89,90', method: 'Crédito', status: 'completed', date: '16/05/2026 13:56' },
  { id: '#001020', customer: 'Ana Costa', items: 1, total: 'R$ 16,00', method: 'Pix', status: 'cancelled', date: '16/05/2026 12:30' },
  { id: '#001019', customer: 'Carlos Lima', items: 4, total: 'R$ 72,50', method: 'Débito', status: 'completed', date: '16/05/2026 11:45' },
];

export default function OrdersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = orders.filter((o) => {
    if (search && !o.id.includes(search) && !o.customer.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    return true;
  });

  const totalRevenue = filtered
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + parseFloat(o.total.replace('R$ ', '').replace(',', '.')), 0);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Vendas</h2>
          <p className="text-slate-400 mt-1">{orders.length} vendas hoje</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-400">Faturamento Hoje</p>
            <p className="text-xl font-bold text-emerald-400">
              R$ {totalRevenue.toFixed(2)}
            </p>
          </div>
          <button className="flex items-center gap-2 bg-slate-900 border border-slate-800 text-white px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors">
            <Download size={18} />
            Exportar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por número ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        {['all', 'completed', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              statusFilter === s
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {s === 'all' ? 'Todos' : s === 'completed' ? 'Concluídos' : 'Cancelados'}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                <th className="text-left p-4 font-medium">Pedido</th>
                <th className="text-left p-4 font-medium">Cliente</th>
                <th className="text-center p-4 font-medium">Itens</th>
                <th className="text-right p-4 font-medium">Total</th>
                <th className="text-center p-4 font-medium">Pagamento</th>
                <th className="text-center p-4 font-medium">Status</th>
                <th className="text-right p-4 font-medium">Data</th>
                <th className="text-center p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                  <td className="p-4">
                    <span className="text-indigo-400 font-mono text-sm font-semibold">{order.id}</span>
                  </td>
                  <td className="p-4 text-white text-sm">{order.customer}</td>
                  <td className="p-4 text-center text-slate-400 text-sm">{order.items}</td>
                  <td className="p-4 text-right text-white font-semibold text-sm">{order.total}</td>
                  <td className="p-4 text-center">
                    <span className="px-2 py-1 bg-slate-800 rounded-md text-xs text-white">{order.method}</span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      order.status === 'completed'
                        ? 'bg-emerald-400/20 text-emerald-400'
                        : 'bg-red-400/20 text-red-400'
                    }`}>
                      {order.status === 'completed' ? 'Concluído' : 'Cancelado'}
                    </span>
                  </td>
                  <td className="p-4 text-right text-slate-400 text-xs">{order.date}</td>
                  <td className="p-4 text-center">
                    <button className="p-2 hover:bg-slate-600 rounded-lg transition-colors">
                      <Eye size={16} className="text-slate-400 hover:text-white" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
