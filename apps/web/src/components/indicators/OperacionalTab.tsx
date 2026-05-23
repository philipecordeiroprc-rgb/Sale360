'use client';

import { WifiOff, UserCheck, Clock } from 'lucide-react';
import type { OperationalIndicators } from './types';

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 animate-pulse">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-slate-800 rounded-lg" />
          <div className="h-3 bg-slate-800 rounded w-24" />
        </div>
        <div className="h-6 bg-slate-800 rounded w-28" />
      </div>
    </div>
  );
}

export function OperacionalTab({ data, loading }: { data: OperationalIndicators | null; loading: boolean }) {
  if (loading) return <Skeleton />;
  if (!data) return <p className="text-center py-12 text-slate-500">Nenhum dado disponível</p>;

  const d = data;
  const maxHourCount = Math.max(...d.horariosPico.map(h => h.count), 1);
  const maxHourTotal = Math.max(...d.horariosPico.map(h => h.total), 1);
  const peakThreshold = maxHourCount * 0.7;
  const peakHours = d.horariosPico.filter(h => h.count >= peakThreshold).map(h => h.hour);

  return (
    <div className="space-y-4">
      {/* Offline % */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${d.percentualOffline > 10 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
            <WifiOff size={20} />
          </div>
          <div>
            <span className="text-xs text-slate-400">% Vendas Offline</span>
            <p className="text-xl font-bold text-white">{fmt(d.percentualOffline)}%</p>
          </div>
        </div>
        {d.percentualOffline > 10 && (
          <p className="mt-2 text-xs text-red-400/80">
            Mais de 10% das vendas foram registradas offline. Verifique a conexão dos dispositivos.
          </p>
        )}
      </div>

      {/* Sales by seller */}
      {d.vendasPorVendedor.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
          <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <UserCheck size={16} className="text-slate-500" />
            Vendas por Vendedor
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3 font-medium">Vendedor</th>
                  <th className="py-2 pr-3 font-medium text-right">Qtd Vendas</th>
                  <th className="py-2 pr-3 font-medium text-right">Faturamento</th>
                  <th className="py-2 font-medium text-right">Ticket Médio</th>
                </tr>
              </thead>
              <tbody>
                {d.vendasPorVendedor.map(s => (
                  <tr key={s.id || s.name} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-2 pr-3 text-white">{s.name}</td>
                    <td className="py-2 pr-3 text-right text-slate-300">{s.orders}</td>
                    <td className="py-2 pr-3 text-right text-white font-medium">R$ {fmt(s.total)}</td>
                    <td className="py-2 text-right text-slate-300">
                      R$ {fmt(s.orders > 0 ? s.total / s.orders : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hourly breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
        <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Clock size={16} className="text-slate-500" />
          Horários de Pico (vendas por hora)
        </h4>
        <div className="space-y-1.5">
          {d.horariosPico.map(h => {
            const isPeak = h.count >= peakThreshold && h.count > 0;
            const barWidth = maxHourTotal > 0 ? (h.total / maxHourTotal) * 100 : 0;
            return (
              <div key={h.hour} className="flex items-center gap-2 text-xs">
                <span className="w-10 text-right text-slate-500 shrink-0">
                  {String(h.hour).padStart(2, '0')}h
                </span>
                <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isPeak ? 'bg-indigo-500' : 'bg-slate-700'}`}
                    style={{ width: `${Math.max(barWidth, h.count > 0 ? 3 : 0)}%` }}
                  />
                </div>
                <span className={`w-10 text-right shrink-0 ${isPeak ? 'text-indigo-400 font-medium' : 'text-slate-500'}`}>
                  {h.count}
                </span>
                <span className="w-28 text-right text-slate-300 shrink-0">
                  R$ {fmt(h.total)}
                </span>
              </div>
            );
          })}
        </div>
        {peakHours.length > 0 && (
          <p className="mt-3 text-[10px] text-slate-500">
            Picos: {peakHours.map(h => `${String(h).padStart(2, '0')}h`).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
