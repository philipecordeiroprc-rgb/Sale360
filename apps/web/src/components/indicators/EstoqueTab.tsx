'use client';

import { Package, TrendingUp, AlertTriangle, Clock, Layers, Archive } from 'lucide-react';
import { useState } from 'react';
import type { InventoryIndicators } from './types';
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(7)].map((_, i) => (
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

export function EstoqueTab({ data, loading }: { data: InventoryIndicators | null; loading: boolean }) {
  const [showEncalhados, setShowEncalhados] = useState(false);

  if (loading) return <Skeleton />;
  if (!data) return <p className="text-center py-12 text-slate-500">Nenhum dado disponível</p>;

  const d = data;

  return (
    <div className="space-y-4">
      {/* Main KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Package} label="Valor Estoque (Custo)" value={d.valorTotalEstoqueCusto} color="amber" />
        <StatCard icon={TrendingUp} label="Valor Potencial (Venda)" value={d.valorPotencialEstoqueVenda} color="green" />
        <StatCard icon={TrendingUp} label="Margem Potencial (R$)" value={d.margemPotencial} color={d.margemPotencial >= 0 ? 'green' : 'red'} />
        <StatCard icon={TrendingUp} label="Margem Potencial (%)" value={d.margemPotencialPercent} color="indigo" isCurrency={false} suffix="%" />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={Clock} label="Dias de Cobertura" value={d.diasCobertura} color="blue" isCurrency={false} suffix=" dias" />
        <StatCard icon={Layers} label="Giro de Estoque" value={d.giroEstoque} color="indigo" isCurrency={false} suffix="x" />
        <StatCard icon={AlertTriangle} label="Encalhados (30d)" value={d.produtosEncalhados.dias30} color="red" isCurrency={false} suffix=" itens" />
      </div>

      {/* Low stock alert */}
      {d.estoqueBaixo.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-amber-400" />
            <h4 className="text-sm font-semibold text-amber-300">Estoque Baixo ({d.estoqueBaixo.length} produtos)</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-amber-500/20 text-amber-400/60">
                  <th className="py-2 pr-3 font-medium">Produto</th>
                  <th className="py-2 pr-3 font-medium text-right">Estoque Atual</th>
                  <th className="py-2 font-medium text-right">Mínimo</th>
                </tr>
              </thead>
              <tbody>
                {d.estoqueBaixo.map(p => {
                  const ratio = p.stockQty / p.lowStockAt;
                  return (
                    <tr key={p.id} className="border-b border-amber-500/10">
                      <td className="py-2 pr-3 text-white">{p.name}</td>
                      <td className={`py-2 pr-3 text-right font-medium ${ratio <= 0.5 ? 'text-red-400' : 'text-amber-300'}`}>
                        {p.stockQty}
                      </td>
                      <td className="py-2 text-right text-amber-400/60">{p.lowStockAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top 10 Products */}
      {d.top10Produtos.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
          <h4 className="text-sm font-semibold text-white mb-4">Top 10 Produtos Mais Vendidos</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3 font-medium w-8">#</th>
                  <th className="py-2 pr-3 font-medium">Produto</th>
                  <th className="py-2 pr-3 font-medium text-right">Qtd Vendida</th>
                  <th className="py-2 font-medium text-right">Receita</th>
                </tr>
              </thead>
              <tbody>
                {d.top10Produtos.map((p, i) => (
                  <tr key={p.id || i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-2 pr-3 text-slate-500">{i + 1}</td>
                    <td className="py-2 pr-3 text-white">{p.name}</td>
                    <td className="py-2 pr-3 text-right text-slate-300">{p.quantity}</td>
                    <td className="py-2 text-right text-white font-medium">R$ {fmt(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Encalhados */}
      {d.produtosEncalhados.lista.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Archive size={16} className="text-slate-500" />
            Produtos Encalhados
          </h4>
          <div className="flex gap-3 mb-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">
              <p className="text-lg font-bold text-red-400">{d.produtosEncalhados.dias30}</p>
              <p className="text-[10px] text-red-400/60">&gt;30 dias</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-center">
              <p className="text-lg font-bold text-amber-400">{d.produtosEncalhados.dias60}</p>
              <p className="text-[10px] text-amber-400/60">&gt;60 dias</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2 text-center">
              <p className="text-lg font-bold text-orange-400">{d.produtosEncalhados.dias90}</p>
              <p className="text-[10px] text-orange-400/60">&gt;90 dias</p>
            </div>
          </div>
          <button
            onClick={() => setShowEncalhados(!showEncalhados)}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            {showEncalhados ? 'Ocultar lista' : `Ver lista (${d.produtosEncalhados.lista.length} produtos)`}
          </button>
          {showEncalhados && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 pr-3 font-medium">Produto</th>
                    <th className="py-2 font-medium text-right">Última Venda</th>
                  </tr>
                </thead>
                <tbody>
                  {d.produtosEncalhados.lista.map(p => (
                    <tr key={p.id} className="border-b border-slate-800/50">
                      <td className="py-2 pr-3 text-white">{p.name}</td>
                      <td className="py-2 text-right text-slate-400">
                        {p.lastSaleAt
                          ? new Date(p.lastSaleAt).toLocaleDateString('pt-BR')
                          : 'Nunca vendeu'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Legenda items={[
        { term: 'Valor Estoque (Custo)', definition: 'Soma de (quantidade restante × custo unitário) de cada lote em estoque. Representa o capital parado em mercadoria.' },
        { term: 'Valor Potencial (Venda)', definition: 'Soma de (estoque atual × preço de venda) de cada produto ativo. Quanto R$ entraria se vendesse tudo.' },
        { term: 'Margem Potencial', definition: 'Valor Potencial de Venda - Valor de Estoque (Custo). Lucro "adormecido" nas prateleiras.' },
        { term: 'Dias de Cobertura', definition: 'Valor do Estoque / média de vendas diárias. Em quantos dias o estoque zera sem novas compras.' },
        { term: 'Giro de Estoque', definition: 'CMV / Valor do Estoque. Quantas vezes o estoque foi renovado no período. Quanto maior, melhor.' },
        { term: 'Produtos Encalhados', definition: 'Itens sem venda há mais de 30/60/90 dias. Capital parado que pode virar prejuízo.' },
      ]} />
    </div>
  );
}
