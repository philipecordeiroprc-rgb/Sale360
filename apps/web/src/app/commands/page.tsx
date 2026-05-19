'use client';

import { useState, useEffect } from 'react';
import { ClipboardList, Plus, Search } from 'lucide-react';
import api from '@/lib/api';

export default function CommandsPage() {
  const [commands, setCommands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCommands = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.commands.list({ page: 1 });
      setCommands(data.commands || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar comandas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCommands(); }, []);

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Comandas</h1>
          <p className="text-slate-400 text-sm mt-0.5">Gerencie as comandas abertas</p>
        </div>
        <button
          className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-2 rounded-lg font-medium text-sm transition-colors"
        >
          <Plus size={16} />
          Nova Comanda
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] text-slate-500 uppercase tracking-wider">
              <th className="text-left px-4 py-2.5 font-medium">Comanda</th>
              <th className="text-left px-4 py-2.5 font-medium">Cliente</th>
              <th className="text-center px-4 py-2.5 font-medium">Itens</th>
              <th className="text-right px-4 py-2.5 font-medium">Total</th>
              <th className="text-center px-4 py-2.5 font-medium">Status</th>
              <th className="text-right px-4 py-2.5 font-medium">Abertura</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">Carregando...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <p className="text-red-400 text-sm mb-2">{error}</p>
                  <button onClick={loadCommands} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs">Tentar novamente</button>
                </td>
              </tr>
            ) : commands.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <ClipboardList size={32} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-sm text-slate-400">Nenhuma comanda aberta</p>
                </td>
              </tr>
            ) : (
              commands.map((c: any) => (
                <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-indigo-400 font-mono text-sm">#{c.commandNumber || c.id}</td>
                  <td className="px-4 py-2.5 text-white text-sm">{c.customerName || '—'}</td>
                  <td className="px-4 py-2.5 text-center text-slate-400 text-sm">{c.items?.length || 0}</td>
                  <td className="px-4 py-2.5 text-right text-white font-medium text-sm">R$ {Number(c.total || 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.status === 'OPEN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {c.status === 'OPEN' ? 'Aberta' : c.status === 'CLOSED' ? 'Fechada' : c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500 text-xs">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
