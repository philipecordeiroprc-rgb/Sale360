'use client';

import { useState } from 'react';
import { Search, Plus, Phone, Mail, Star } from 'lucide-react';

const customers = [
  { id: '1', name: 'João Silva', phone: '(11) 99999-0001', email: 'joao@email.com', purchases: 12, totalSpent: 'R$ 540,00', creditBalance: 0, lastPurchase: 'Hoje' },
  { id: '2', name: 'Maria Souza', phone: '(11) 98765-0002', email: '', purchases: 8, totalSpent: 'R$ 320,00', creditBalance: 15.00, lastPurchase: 'Ontem' },
  { id: '3', name: 'Pedro Santos', phone: '(11) 91234-0003', email: 'pedro@email.com', purchases: 25, totalSpent: 'R$ 1.240,00', creditBalance: 0, lastPurchase: '3 dias' },
  { id: '4', name: 'Ana Costa', phone: '(11) 94567-0004', email: '', purchases: 3, totalSpent: 'R$ 52,00', creditBalance: 50.00, lastPurchase: '1 semana' },
];

export default function CustomersPage() {
  const [search, setSearch] = useState('');

  const filtered = customers.filter((c) => {
    if (!search) return true;
    return c.name.toLowerCase().includes(search.toLowerCase()) ||
           c.phone.includes(search) ||
           c.email.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Clientes</h2>
          <p className="text-slate-400 mt-1">{customers.length} clientes cadastrados</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-3 rounded-xl font-semibold transition-colors">
          <Plus size={20} />
          Novo Cliente
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white placeholder-dark-600 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Customer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((customer) => (
          <div key={customer.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-500 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <span className="text-lg font-bold text-indigo-400">
                  {customer.name.charAt(0)}
                </span>
              </div>
              {customer.purchases > 10 && (
                <Star size={16} className="text-amber-400" fill="#FBBF24" />
              )}
            </div>

            <h3 className="text-white font-semibold text-lg mb-3">{customer.name}</h3>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Phone size={14} />
                <span>{customer.phone}</span>
              </div>
              {customer.email && (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Mail size={14} />
                  <span>{customer.email}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-800">
              <div>
                <p className="text-xs text-slate-400">Compras</p>
                <p className="text-white font-bold">{customer.purchases}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Gasto</p>
                <p className="text-emerald-400 font-bold">{customer.totalSpent}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Fiado</p>
                <p className={`font-bold ${customer.creditBalance > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  R$ {customer.creditBalance.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Última Compra</p>
                <p className="text-slate-400 text-sm">{customer.lastPurchase}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
