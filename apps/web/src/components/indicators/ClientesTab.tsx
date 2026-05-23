'use client';

import { Users, TrendingUp, AlertTriangle, DollarSign, Repeat } from 'lucide-react';
import Link from 'next/link';
import type { CustomerIndicators } from './types';
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

export function ClientesTab({ data, loading }: { data: CustomerIndicators | null; loading: boolean }) {
  if (loading) return <Skeleton />;
  if (!data) return <p className="text-center py-12 text-slate-500">Nenhum dado disponível</p>;

  const d = data;

  return (
    <div className="space-y-4">
      {/* Main KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={Users} label="Clientes Ativos" value={d.totalAtivos} color="indigo" isCurrency={false} suffix="" />
        <StatCard icon={Repeat} label="% Recorrentes" value={d.percentualRecorrentes} color="green" isCurrency={false} suffix="%" />
        <StatCard icon={AlertTriangle} label="Fiado em Aberto" value={d.fiadoEmAberto} color={d.fiadoEmAberto > 0 ? 'red' : 'green'} />
      </div>

      {/* Fiado alert */}
      {d.fiadoEmAberto > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-amber-400" />
            <h4 className="text-sm font-semibold text-amber-300">
              Fiado em Aberto: R$ {fmt(d.fiadoEmAberto)} ({d.fiadoClientes.length} clientes)
            </h4>
          </div>
          {d.fiadoClientes.length > 0 && (
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-amber-500/20 text-amber-400/60">
                    <th className="py-2 pr-3 font-medium">Cliente</th>
                    <th className="py-2 font-medium text-right">Saldo Devedor</th>
                  </tr>
                </thead>
                <tbody>
                  {d.fiadoClientes.slice(0, 10).map(c => (
                    <tr key={c.id} className="border-b border-amber-500/10">
                      <td className="py-2 pr-3 text-white">{c.name}</td>
                      <td className="py-2 text-right text-red-400 font-medium">R$ {fmt(c.creditBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Link href="/customers" className="inline-block text-xs text-indigo-400 hover:text-indigo-300">
            Ir para Clientes →
          </Link>
        </div>
      )}

      {/* Top 10 Customers */}
      {d.top10Clientes.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
          <h4 className="text-sm font-semibold text-white mb-4">Top 10 Clientes por Gasto</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3 font-medium w-8">#</th>
                  <th className="py-2 pr-3 font-medium">Cliente</th>
                  <th className="py-2 pr-3 font-medium text-right">Compras</th>
                  <th className="py-2 font-medium text-right">Total Gasto</th>
                </tr>
              </thead>
              <tbody>
                {d.top10Clientes.map((c, i) => (
                  <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-2 pr-3 text-slate-500">{i + 1}</td>
                    <td className="py-2 pr-3 text-white">{c.name}</td>
                    <td className="py-2 pr-3 text-right text-slate-300">{c.orders}</td>
                    <td className="py-2 text-right text-white font-medium">R$ {fmt(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ticket Médio por Cliente */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-400">
            <DollarSign size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-400">Ticket Médio por Cliente</span>
            <p className="text-lg font-bold text-white">R$ {fmt(d.ticketMedioPorCliente)}</p>
          </div>
        </div>
      </div>

      {d.totalAtivos === 0 && d.fiadoEmAberto === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <Users size={48} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400">Nenhum cliente com atividade no período</p>
        </div>
      )}
    </div>
  );
}
