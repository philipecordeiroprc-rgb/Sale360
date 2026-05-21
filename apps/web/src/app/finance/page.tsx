'use client';

import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, ShoppingCart, CreditCard, Package, Users, UserCheck, BarChart3, Clock, ArrowRight } from 'lucide-react';
import api from '@/lib/api';

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const show = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

const ABC_COLORS: Record<string, string> = {
  A: 'bg-emerald-500/20 text-emerald-400',
  B: 'bg-amber-500/20 text-amber-400',
  C: 'bg-red-500/20 text-red-400',
};

export default function FinancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'customers' | 'sellers' | 'abc'>('overview');
  const { toast, show } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const result = await api.reports.financial(params);
      setData(result);
    } catch (err: any) {
      show(err.message || 'Erro ao carregar dados', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const s = data?.summary;
  const format = (n: number) => n?.toFixed(2) || '0.00';

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Financeiro</h1>
          <p className="text-slate-400 text-sm mt-1">Relatorios e analise financeira</p>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">De</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Ate</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
          </div>
          <button onClick={loadData} disabled={loading}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {loading ? 'Carregando...' : 'Filtrar'}
          </button>
          {/* Quick presets */}
          <div className="flex gap-1 ml-2">
            {[
              { label: 'Hoje', days: 0 },
              { label: '7 dias', days: 7 },
              { label: '30 dias', days: 30 },
              { label: 'Tudo', days: -1 },
            ].map((preset) => (
              <button key={preset.label} onClick={() => {
                const end = new Date();
                const start = new Date();
                if (preset.days === -1) { setStartDate(''); setEndDate(''); }
                else if (preset.days === 0) { start.setHours(0,0,0,0); setStartDate(start.toISOString().slice(0,10)); setEndDate(end.toISOString().slice(0,10)); }
                else { start.setDate(start.getDate() - preset.days); setStartDate(start.toISOString().slice(0,10)); setEndDate(end.toISOString().slice(0,10)); }
              }}
                className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6 animate-pulse">
              <div className="h-5 bg-slate-800 rounded w-1/3 mb-4" />
              <div className="h-4 bg-slate-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : !data ? (
        <div className="text-center py-12">
          <BarChart3 size={48} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400">Clique em Filtrar para carregar os dados</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Faturamento', value: `R$ ${format(s.revenue)}`, icon: DollarSign, color: '#34D399' },
              { label: 'Qtd de Vendas', value: String(s.orderCount), icon: ShoppingCart, color: '#6366F1' },
              { label: 'Ticket Medio', value: `R$ ${format(s.avgTicket)}`, icon: TrendingUp, color: '#FBBF24' },
              { label: 'Lucro', value: `R$ ${format(s.profit)}`, icon: CreditCard, color: s.profit >= 0 ? '#EC4899' : '#EF4444' },
            ].map((card) => (
              <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: card.color + '20' }}>
                    <card.icon size={20} color={card.color} />
                  </div>
                </div>
                <p className="text-slate-400 text-xs">{card.label}</p>
                <p className="text-xl font-bold text-white mt-0.5">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Contas a Receber */}
          {data.pending && data.pending.count > 0 && (
            <a
              href="/orders?status=PENDING"
              className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex items-center justify-between hover:bg-amber-500/20 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/20">
                  <Clock size={20} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Contas a Receber</p>
                  <p className="text-xl font-bold text-white mt-0.5">
                    {data.pending.count} vendas — R$ {data.pending.amount.toFixed(2)}
                  </p>
                  {data.pending.fiadoCount > 0 && (
                    <p className="text-xs text-amber-400/80 mt-0.5">
                      {data.pending.fiadoCount} Fiado — R$ {data.pending.fiadoAmount.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
              <ArrowRight size={20} className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          )}

          {/* Tab navigation */}
          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            {[
              { id: 'overview' as const, label: 'Pagamentos', icon: CreditCard },
              { id: 'products' as const, label: 'Produtos', icon: Package },
              { id: 'customers' as const, label: 'Clientes', icon: Users },
              { id: 'sellers' as const, label: 'Vendedores', icon: UserCheck },
              { id: 'abc' as const, label: 'Curva ABC', icon: BarChart3 },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${
                  activeTab === tab.id ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
                }`}>
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab: Payment Methods */}
          {activeTab === 'overview' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-white font-semibold">Meios de Pagamento</h3>
              </div>
              {data.paymentMethods?.length === 0 ? (
                <p className="p-8 text-center text-slate-500">Nenhum dado no periodo</p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {data.paymentMethods?.map((pm: any) => {
                    const pct = s.revenue > 0 ? (pm.total / s.revenue) * 100 : 0;
                    return (
                      <div key={pm.method} className="px-4 py-3 flex items-center gap-4">
                        <span className="text-white text-sm font-medium w-24">{pm.method}</span>
                        <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-slate-400 text-sm w-20 text-right">{pct.toFixed(1)}%</span>
                        <span className="text-white text-sm font-medium w-28 text-right">R$ {pm.total.toFixed(2)}</span>
                        <span className="text-slate-500 text-xs w-16 text-right">{pm.count} vendas</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab: Top Products */}
          {activeTab === 'products' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-white font-semibold">Ranking de Produtos</h3>
              </div>
              {data.topProducts?.length === 0 ? (
                <p className="p-8 text-center text-slate-500">Nenhum produto vendido no periodo</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs">
                        <th className="text-left p-3 font-medium w-10">#</th>
                        <th className="text-left p-3 font-medium">Produto</th>
                        <th className="text-right p-3 font-medium">Qtd</th>
                        <th className="text-right p-3 font-medium">Receita</th>
                        <th className="text-right p-3 font-medium">Lucro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts?.map((p: any, i: number) => (
                        <tr key={p.name} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="p-3 text-slate-500 font-mono">{i + 1}</td>
                          <td className="p-3 text-white truncate max-w-xs">{p.name}</td>
                          <td className="p-3 text-right text-slate-400">{p.quantity}</td>
                          <td className="p-3 text-right text-white">R$ {p.revenue.toFixed(2)}</td>
                          <td className={`p-3 text-right font-medium ${p.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            R$ {p.profit.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab: Top Customers */}
          {activeTab === 'customers' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-white font-semibold">Ranking de Clientes</h3>
              </div>
              {data.topCustomers?.length === 0 ? (
                <p className="p-8 text-center text-slate-500">Nenhum cliente no periodo</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs">
                        <th className="text-left p-3 font-medium w-10">#</th>
                        <th className="text-left p-3 font-medium">Cliente</th>
                        <th className="text-right p-3 font-medium">Compras</th>
                        <th className="text-right p-3 font-medium">Total</th>
                        <th className="text-right p-3 font-medium">Medio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topCustomers?.map((c: any, i: number) => (
                        <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="p-3 text-slate-500 font-mono">{i + 1}</td>
                          <td className="p-3 text-white">{c.name}</td>
                          <td className="p-3 text-right text-slate-400">{c.orders}</td>
                          <td className="p-3 text-right text-white">R$ {c.total.toFixed(2)}</td>
                          <td className="p-3 text-right text-slate-400">R$ {(c.total / c.orders).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab: Top Sellers */}
          {activeTab === 'sellers' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-white font-semibold">Ranking de Vendedores</h3>
              </div>
              {data.topSellers?.length === 0 ? (
                <p className="p-8 text-center text-slate-500">Nenhum vendedor no periodo</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs">
                        <th className="text-left p-3 font-medium w-10">#</th>
                        <th className="text-left p-3 font-medium">Vendedor</th>
                        <th className="text-right p-3 font-medium">Vendas</th>
                        <th className="text-right p-3 font-medium">Faturamento</th>
                        <th className="text-right p-3 font-medium">Medio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topSellers?.map((s: any, i: number) => (
                        <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="p-3 text-slate-500 font-mono">{i + 1}</td>
                          <td className="p-3 text-white">{s.name}</td>
                          <td className="p-3 text-right text-slate-400">{s.orders}</td>
                          <td className="p-3 text-right text-white">R$ {s.total.toFixed(2)}</td>
                          <td className="p-3 text-right text-slate-400">R$ {(s.total / s.orders).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab: Curva ABC */}
          {activeTab === 'abc' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-white font-semibold">Curva ABC</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Classe A: 80% do faturamento | Classe B: 15% | Classe C: 5%
                </p>
              </div>
              {data.abcCurve?.length === 0 ? (
                <p className="p-8 text-center text-slate-500">Nenhum dado no periodo</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs">
                        <th className="text-left p-3 font-medium w-10">#</th>
                        <th className="text-left p-3 font-medium">Produto</th>
                        <th className="text-center p-3 font-medium w-16">Classe</th>
                        <th className="text-right p-3 font-medium">Qtd</th>
                        <th className="text-right p-3 font-medium">Receita</th>
                        <th className="text-right p-3 font-medium">%</th>
                        <th className="text-right p-3 font-medium">% Acum.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.abcCurve?.map((item: any, i: number) => (
                        <tr key={item.name} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="p-3 text-slate-500 font-mono">{i + 1}</td>
                          <td className="p-3 text-white truncate max-w-xs">{item.name}</td>
                          <td className="p-3 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ABC_COLORS[item.class]}`}>
                              {item.class}
                            </span>
                          </td>
                          <td className="p-3 text-right text-slate-400">{item.quantity}</td>
                          <td className="p-3 text-right text-white">R$ {item.revenue.toFixed(2)}</td>
                          <td className="p-3 text-right text-slate-400">{item.percentage}%</td>
                          <td className="p-3 text-right text-white font-medium">{item.cumulative}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
