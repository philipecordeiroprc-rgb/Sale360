'use client';

import { ShoppingBag, Clock, AlertTriangle, Truck } from 'lucide-react';
import Link from 'next/link';
import type { PurchasesIndicators } from './types';
import { Legenda } from './Legenda';

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatCard({ icon: Icon, label, value, color = 'indigo', isCurrency = true, suffix = '' }: {
  icon: any; label: string; value: number; color?: string; isCurrency?: boolean; suffix?: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-500/10 text-indigo-400',
    green: 'bg-emerald-500/10 text-emerald-400',
    red: 'bg-red-500/10 text-red-400',
    amber: 'bg-amber-500/10 text-amber-400',
    blue: 'bg-blue-500/10 text-blue-400',
  };
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.indigo}`}>
          <Icon size={20} />
        </div>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">
        {isCurrency ? `R$ ${fmt(value)}` : `${fmt(value)}${suffix}`}
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-slate-800 rounded-lg" />
              <div className="h-3 bg-slate-800 rounded w-24" />
            </div>
            <div className="h-6 bg-slate-800 rounded w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComprasTab({ data, loading }: { data: PurchasesIndicators | null; loading: boolean }) {
  if (loading) return <Skeleton />;
  if (!data) return <p className="text-center py-12 text-slate-500">Nenhum dado disponível</p>;

  const d = data;

  return (
    <div className="space-y-4">
      {/* Main KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={ShoppingBag} label="Total Gasto em Compras" value={d.totalGasto} color="amber" />
        <StatCard icon={Clock} label="Prazo Médio de Entrega" value={d.prazoMedioEntrega} color="blue" isCurrency={false} suffix=" dias" />
        <StatCard icon={AlertTriangle} label="Compras Pendentes" value={d.comprasPendentes.total} color="indigo" isCurrency={false} suffix="" />
      </div>

      {/* Pending purchases alert */}
      {d.comprasPendentes.total > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-amber-400" />
            <h4 className="text-sm font-semibold text-amber-300">Compras Pendentes</h4>
          </div>
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-slate-400">Rascunho: </span>
              <span className="text-white font-medium">{d.comprasPendentes.draft}</span>
            </div>
            <div>
              <span className="text-slate-400">Confirmadas: </span>
              <span className="text-white font-medium">{d.comprasPendentes.confirmed}</span>
            </div>
          </div>
          <Link href="/purchases" className="inline-block mt-3 text-xs text-indigo-400 hover:text-indigo-300">
            Ir para Compras →
          </Link>
        </div>
      )}

      {/* Purchases by Supplier */}
      {d.porFornecedor.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
          <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Truck size={16} className="text-slate-500" />
            Compras por Fornecedor
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3 font-medium">Fornecedor</th>
                  <th className="py-2 pr-3 font-medium text-right">Qtd Compras</th>
                  <th className="py-2 font-medium text-right">Total Gasto</th>
                </tr>
              </thead>
              <tbody>
                {d.porFornecedor.map(s => (
                  <tr key={s.id || s.name} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-2 pr-3 text-white">{s.name}</td>
                    <td className="py-2 pr-3 text-right text-slate-300">{s.count}</td>
                    <td className="py-2 text-right text-white font-medium">R$ {fmt(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {d.porFornecedor.length === 0 && d.totalGasto === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <ShoppingBag size={48} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400">Nenhuma compra recebida no período</p>
        </div>
      )}

      <Legenda items={[
        { term: 'Total Gasto em Compras', definition: 'Soma de todas as compras com status Recebido no período.' },
        { term: 'Prazo Médio de Entrega', definition: 'Média de dias entre a data do pedido e a data de recebimento da mercadoria.' },
        { term: 'Compras Pendentes', definition: 'Pedidos em Rascunho (ainda não enviados) + Confirmados (enviados, aguardando entrega).' },
      ]} />
    </div>
  );
}
