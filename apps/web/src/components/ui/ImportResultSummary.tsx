'use client';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { ImportResult } from '@/lib/import-types';

interface Props {
  result: ImportResult | null;
  onClose: () => void;
}

export function ImportResultSummary({ result, onClose }: Props) {
  if (!result) return null;

  const totalErrors = result.errors.length;
  const totalWarnings = result.warnings.length;
  const isSuccess = result.imported > 0 && totalErrors === 0;
  const isPartial = result.imported > 0 && totalErrors > 0;
  const isFailure = result.imported === 0;

  return (
    <div className="space-y-6 py-2">
      {/* Big status */}
      <div className="text-center">
        {isSuccess ? (
          <>
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Importação Concluída!</h3>
            <p className="text-sm text-slate-400 mt-1">
              {result.imported} {result.imported === 1 ? 'registro criado' : 'registros criados'} com sucesso
            </p>
          </>
        ) : isPartial ? (
          <>
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={32} className="text-amber-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Importação Parcial</h3>
            <p className="text-sm text-slate-400 mt-1">
              {result.imported} criados, {totalErrors} erro(s), {totalWarnings} aviso(s)
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <XCircle size={32} className="text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Erro na Importação</h3>
            <p className="text-sm text-slate-400 mt-1">Nenhum registro foi criado.</p>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">{result.imported}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Criados</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <div className={`text-2xl font-bold ${totalErrors > 0 ? 'text-red-400' : 'text-slate-500'}`}>{totalErrors}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Erros</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <div className={`text-2xl font-bold ${totalWarnings > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{totalWarnings}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Avisos</div>
        </div>
      </div>

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="bg-red-950/20 border border-red-800/30 rounded-xl p-4 max-h-48 overflow-y-auto">
          <h4 className="text-xs font-semibold text-red-400 mb-2">Erros:</h4>
          <div className="space-y-1">
            {result.errors.slice(0, 20).map((err, i) => (
              <p key={i} className="text-xs text-red-300">
                {err.row >= 0 ? <span className="text-red-500">Linha {err.row + 1}:</span> : ''}{' '}
                {err.message}
              </p>
            ))}
            {result.errors.length > 20 && (
              <p className="text-xs text-slate-500">...e mais {result.errors.length - 20} erro(s)</p>
            )}
          </div>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-4 max-h-32 overflow-y-auto">
          <h4 className="text-xs font-semibold text-amber-400 mb-2">Avisos:</h4>
          <div className="space-y-1">
            {result.warnings.slice(0, 10).map((w, i) => (
              <p key={i} className="text-xs text-amber-300">{w}</p>
            ))}
            {result.warnings.length > 10 && (
              <p className="text-xs text-slate-500">...e mais {result.warnings.length - 10} aviso(s)</p>
            )}
          </div>
        </div>
      )}

      {/* Close */}
      <button
        onClick={onClose}
        className="w-full px-4 py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-semibold text-sm transition-colors"
      >
        Fechar
      </button>
    </div>
  );
}
