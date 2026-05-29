'use client';

import { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import api from '@/lib/api';
import { FinanceiroTab } from '@/components/indicators/FinanceiroTab';
import { EstoqueTab } from '@/components/indicators/EstoqueTab';
import { ComprasTab } from '@/components/indicators/ComprasTab';
import { ClientesTab } from '@/components/indicators/ClientesTab';
import { OperacionalTab } from '@/components/indicators/OperacionalTab';
import type { IndicatorsResponse } from '@/components/indicators/types';

type Tab = 'financeiro' | 'estoque' | 'compras' | 'clientes' | 'operacional';

const tabs: { key: Tab; label: string }[] = [
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'estoque', label: 'Estoque' },
  { key: 'compras', label: 'Abastecimento' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'operacional', label: 'Operacional' },
];

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function IndicadoresPage() {
  const [data, setData] = useState<IndicatorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('financeiro');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadData = async (sd?: string, ed?: string) => {
    setLoading(true);
    setError('');
    try {
      const params: any = {};
      if (sd) params.startDate = sd;
      if (ed) params.endDate = ed;
      const result = await api.indicators.list(params);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar indicadores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFilter = () => {
    loadData(startDate, endDate);
  };

  const setPreset = (days: number | null) => {
    if (days === null) {
      setStartDate('');
      setEndDate('');
      loadData();
      return;
    }
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    const sd = toISODate(start);
    const ed = toISODate(end);
    setStartDate(sd);
    setEndDate(ed);
    loadData(sd, ed);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Indicadores</h1>
          <p className="text-sm text-slate-400 mt-1">Visão completa do desempenho da sua loja</p>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            onClick={() => setPreset(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !startDate ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Tudo
          </button>
          <button
            onClick={() => setPreset(0)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            Hoje
          </button>
          <button
            onClick={() => setPreset(7)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            7 dias
          </button>
          <button
            onClick={() => setPreset(30)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            30 dias
          </button>
          <button
            onClick={() => setPreset(90)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            90 dias
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">De:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Até:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:border-indigo-500 outline-none"
            />
          </div>
          <button
            onClick={handleFilter}
            disabled={loading}
            className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
          >
            {loading ? 'Carregando...' : 'Filtrar'}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-indigo-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-400/10 border border-red-400/30 rounded-xl p-4 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => loadData(startDate, endDate)} className="text-red-400 hover:text-red-300 font-medium">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Initial empty state (before any load) */}
      {!loading && !error && !data && (
        <div className="text-center py-12">
          <BarChart3 size={48} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400">Clique em Filtrar para carregar os indicadores</p>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'financeiro' && <FinanceiroTab data={data?.financial || null} loading={loading} />}
      {activeTab === 'estoque' && <EstoqueTab data={data?.inventory || null} loading={loading} />}
      {activeTab === 'compras' && <ComprasTab data={data?.purchases || null} loading={loading} />}
      {activeTab === 'clientes' && <ClientesTab data={data?.customers || null} loading={loading} />}
      {activeTab === 'operacional' && <OperacionalTab data={data?.operational || null} loading={loading} />}
    </div>
  );
}
