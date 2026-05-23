'use client';

import { DollarSign, TrendingUp, TrendingDown, CreditCard, ShoppingCart, Percent } from 'lucide-react';
import type { FinancialIndicators } from './types';
import { Legenda } from './Legenda';

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatCard({ icon: Icon, label, value, color = 'indigo', isCurrency = true }: {
  icon: any; label: string; value: number; color?: string; isCurrency?: boolean;
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
        {isCurrency ? `R$ ${fmt(value)}` : `${fmt(value)}%`}
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-slate-800 rounded-lg" />
              <div className="h-3 bg-slate-800 rounded w-20" />
            </div>
            <div className="h-6 bg-slate-800 rounded w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentBar({ method, count, total, percentage, maxPct }: {
  method: string; count: number; total: number; percentage: number; maxPct: number;
}) {
  const labels: Record<string, string> = {
    pix: 'Pix', credit: 'Crédito', debit: 'Débito', cash: 'Dinheiro',
    credit_store: 'Fiado', other: 'Outro',
  };
  const colors: Record<string, string> = {
    pix: 'bg-emerald-500', credit: 'bg-indigo-500', debit: 'bg-blue-500',
    cash: 'bg-amber-500', credit_store: 'bg-red-400',
  };
  const barWidth = maxPct > 0 ? (percentage / maxPct) * 100 : 0;

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-sm text-slate-300 w-20 shrink-0">{labels[method] || method}</span>
      <div className="flex-1 h-6 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colors[method] || 'bg-slate-500'} transition-all`}
          style={{ width: `${Math.max(barWidth, 2)}%` }}
        />
      </div>
      <div className="text-right shrink-0 w-36">
        <p className="text-sm text-white font-medium">R$ {fmt(total)}</p>
        <p className="text-[10px] text-slate-500">{count} vendas · {fmt(percentage)}%</p>
      </div>
    </div>
  );
}

export function FinanceiroTab({ data, loading }: { data: FinancialIndicators | null; loading: boolean }) {
  if (loading) return <Skeleton />;
  if (!data) return <p className="text-center py-12 text-slate-500">Nenhum dado disponível</p>;

  const f = data;
  const noData = f.faturamentoBruto === 0 && f.cmv === 0;

  return (
    <div className="space-y-4">
      {noData && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <DollarSign size={48} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400">Nenhum dado financeiro no período selecionado</p>
          <p className="text-xs text-slate-500 mt-1">Ajuste o filtro de data para ver os indicadores</p>
        </div>
      )}

      {/* Main KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard icon={DollarSign} label="Faturamento Bruto" value={f.faturamentoBruto} color="indigo" />
        <StatCard icon={TrendingUp} label="Faturamento Líquido" value={f.faturamentoLiquido} color="blue" />
        <StatCard icon={ShoppingCart} label="CMV" value={f.cmv} color="amber" />
        <StatCard icon={TrendingUp} label="Lucro Bruto" value={f.lucroBruto} color={f.lucroBruto >= 0 ? 'green' : 'red'} />
        <StatCard icon={Percent} label="Margem Bruta" value={f.margemBruta} color="indigo" isCurrency={false} />
        <StatCard
          icon={f.lucroLiquidoEstimado >= 0 ? TrendingUp : TrendingDown}
          label="Lucro Líquido Estimado"
          value={f.lucroLiquidoEstimado}
          color={f.lucroLiquidoEstimado >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={ShoppingCart} label="Custo Operacional" value={f.custoOperacional} color="amber" />
        <StatCard icon={CreditCard} label="Perda Taxa Cartão" value={f.perdaTaxaCartao} color="red" />
        <StatCard icon={DollarSign} label="Ticket Médio" value={f.ticketMedio} color="blue" />
      </div>

      {/* Payment method breakdown */}
      {f.faturamentoPorFormaPagamento.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
          <h4 className="text-sm font-semibold text-white mb-4">Faturamento por Forma de Pagamento</h4>
          <div className="space-y-1">
            {f.faturamentoPorFormaPagamento.map(pm => (
              <PaymentBar
                key={pm.method}
                method={pm.method}
                count={pm.count}
                total={pm.total}
                percentage={pm.percentage}
                maxPct={f.faturamentoPorFormaPagamento[0]?.percentage || 0}
              />
            ))}
          </div>
        </div>
      )}

      <Legenda items={[
        { term: 'Faturamento Bruto', definition: 'Soma de todas as vendas finalizadas, sem deduzir descontos ou custos.' },
        { term: 'Faturamento Líquido', definition: 'Faturamento Bruto - descontos concedidos - cupons aplicados.' },
        { term: 'CMV', definition: 'Custo da Mercadoria Vendida — soma do custo unitário de cada produto vendido, baseado no PEPS (primeiro que entra, primeiro que sai).' },
        { term: 'Lucro Bruto', definition: 'Faturamento Líquido - CMV. Mostra o ganho antes de descontar custos operacionais e taxas.' },
        { term: 'Margem Bruta', definition: '(Lucro Bruto / Faturamento Líquido) × 100. Percentual do faturamento que é lucro bruto.' },
        { term: 'Custo Operacional', definition: 'Soma dos custos operacionais por item vendido (embalagem, frete, preparo).' },
        { term: 'Perda Taxa Cartão', definition: 'Soma do % da maquininha sobre o valor de cada venda paga com crédito ou débito.' },
        { term: 'Lucro Líquido Estimado', definition: 'Lucro Bruto - Custo Operacional - Perda Taxa Cartão. Estimativa do que realmente sobrou.' },
        { term: 'Ticket Médio', definition: 'Faturamento Bruto / número de vendas. Valor médio (em R$) de cada venda.' },
      ]} />
    </div>
  );
}
