'use client';
import { Download, ArrowRight, ArrowDown, CheckCircle2, Circle, BookOpen, ExternalLink } from 'lucide-react';
import type { ImportType } from '@/lib/import-types';
import { IMPORT_CONFIGS } from '@/lib/import-configs';

interface Props {
  currentType: ImportType;
  onProceed: () => void;
}

const SEQUENCE = [
  { type: 'variationTemplates' as ImportType, label: 'Templates de Variação', detail: 'Opcional — só para lojas com produtos que variam (roupas, calçados, bebidas)' },
  { type: 'categories' as ImportType, label: 'Categorias', detail: 'Organize seus produtos no catálogo' },
  { type: 'suppliers' as ImportType, label: 'Fornecedores', detail: 'Necessário para registrar compras e lotes' },
  { type: 'products' as ImportType, label: 'Produtos', detail: 'Produtos simples ou com variações' },
  { type: 'purchases' as ImportType, label: '⭐ Compras', detail: 'Gera lotes de estoque (PEPS) e atualiza quantidades' },
];

export function ImportSequenceGuide({ currentType, onProceed }: Props) {
  const currentStep = IMPORT_CONFIGS[currentType]?.sequenceNumber || 1;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-1">Sequência Correta de Importação</h3>
        <p className="text-xs text-slate-400 mb-4">
          Siga a ordem abaixo para evitar erros de dependência. Cada etapa depende das anteriores.
        </p>

        {/* Desktop: horizontal flow */}
        <div className="hidden sm:flex items-start gap-1 justify-between">
          {SEQUENCE.map((s, i) => {
            const config = IMPORT_CONFIGS[s.type];
            const isCurrent = s.type === currentType || (currentType === 'productsVariations' && s.type === 'products');
            const isPast = config.sequenceNumber < currentStep && s.type !== 'purchases';
            const isPurchase = s.type === 'purchases';

            return (
              <div key={s.type} className="flex items-start gap-1 flex-1">
                <div className={`flex flex-col items-center rounded-lg p-2.5 text-center flex-1 transition-colors ${
                  isCurrent
                    ? 'bg-indigo-500/20 border border-indigo-500/40 ring-1 ring-indigo-500/30'
                    : 'bg-slate-800/50 border border-slate-800'
                }`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 ${
                    isCurrent ? 'bg-indigo-500 text-white' :
                    isPast ? 'bg-emerald-500 text-white' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {isPast ? <CheckCircle2 size={14} /> : config.sequenceNumber}
                  </div>
                  <span className={`text-xs font-medium leading-tight ${isCurrent ? 'text-white' : 'text-slate-300'}`}>
                    {s.label}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 leading-tight hidden lg:block">
                    {s.detail}
                  </span>
                  {isPurchase && (
                    <span className="text-[10px] text-amber-400 mt-0.5">Depende de Fornecedores + Produtos</span>
                  )}
                  <a
                    href={`/templates/${config.templateFilename}`}
                    download
                    className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <Download size={10} />
                    Baixar template
                  </a>
                </div>
                {i < SEQUENCE.length - 1 && (
                  <div className="flex items-center pt-4 flex-shrink-0">
                    <ArrowRight size={14} className="text-slate-600" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile: vertical flow */}
        <div className="sm:hidden space-y-2">
          {SEQUENCE.map((s, i) => {
            const config = IMPORT_CONFIGS[s.type];
            const isCurrent = s.type === currentType || (currentType === 'productsVariations' && s.type === 'products');
            const isPast = config.sequenceNumber < currentStep && s.type !== 'purchases';

            return (
              <div key={s.type}>
                <div className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                  isCurrent
                    ? 'bg-indigo-500/20 border border-indigo-500/40'
                    : 'bg-slate-800/50 border border-slate-800'
                }`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isCurrent ? 'bg-indigo-500 text-white' :
                    isPast ? 'bg-emerald-500 text-white' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {isPast ? <CheckCircle2 size={14} /> : config.sequenceNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${isCurrent ? 'text-white' : 'text-slate-300'}`}>
                      {s.label}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">{s.detail}</p>
                  </div>
                  <a
                    href={`/templates/${config.templateFilename}`}
                    download
                    className="flex-shrink-0 p-1.5 text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <Download size={16} />
                  </a>
                </div>
                {i < SEQUENCE.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown size={14} className="text-slate-600" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current step info */}
      <div className="bg-slate-900 border border-indigo-800/30 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-white mb-2">
          {IMPORT_CONFIGS[currentType]?.title || 'Importar'}
        </h4>
        <p className="text-xs text-slate-400 mb-3">
          {IMPORT_CONFIGS[currentType]?.longDescription}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <a
            href={`/templates/${IMPORT_CONFIGS[currentType]?.templateFilename}`}
            download
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-lg text-xs font-medium transition-colors"
          >
            <Download size={13} />
            {IMPORT_CONFIGS[currentType]?.templateLabel || 'Baixar Template'}
          </a>
          <a
            href="/guia-importacao"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-400 hover:text-indigo-300 rounded-lg text-xs font-medium transition-all"
          >
            <BookOpen size={13} />
            Guia Completo de Importação
            <ExternalLink size={10} />
          </a>
        </div>
      </div>

      {/* Proceed button */}
      <button
        onClick={onProceed}
        className="w-full px-4 py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-semibold text-sm transition-colors"
      >
        Entendi, selecionar arquivo
      </button>
    </div>
  );
}
