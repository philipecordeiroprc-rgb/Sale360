'use client';
import { CheckCircle2, XCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import type { ParsedRow, ImportConfig } from '@/lib/import-types';

interface Props {
  rows: ParsedRow[];
  config: ImportConfig;
  onConfirm: () => void;
  onBack: () => void;
  importing: boolean;
}

export function ImportPreviewTable({ rows, config, onConfirm, onBack, importing }: Props) {
  const validCount = rows.filter(r => r.valid).length;
  const errorCount = rows.filter(r => !r.valid).length;
  const columns = Object.keys(rows[0]?.data || {}).filter(k => k && k.trim() !== '');
  // Use expected column order if available
  const orderedColumns = config.expectedColumns.filter(c => columns.includes(c));
  // Add any extra columns found
  const extraCols = columns.filter(c => !orderedColumns.includes(c));
  const displayColumns = [...orderedColumns, ...extraCols];

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={14} />
        Selecionar outro arquivo
      </button>

      {/* Summary stats */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <span className="text-sm text-slate-400">
            <span className="font-semibold text-white">{rows.length}</span> linhas
          </span>
          <span className="text-sm text-emerald-400">
            <span className="font-semibold">{validCount}</span> válidas
          </span>
          {errorCount > 0 && (
            <span className="text-sm text-red-400">
              <span className="font-semibold">{errorCount}</span> com erros
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500">
          {config.title}
        </span>
      </div>

      {/* Scrollable table */}
      <div className="max-h-80 overflow-auto border border-slate-800 rounded-xl">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-900 z-10">
            <tr className="border-b border-slate-800">
              <th className="px-3 py-2 text-left text-[11px] text-slate-500 w-10">#</th>
              {displayColumns.slice(0, 8).map(col => (
                <th key={col} className="px-3 py-2 text-left text-[11px] text-slate-500 whitespace-nowrap max-w-[180px]">
                  {col}
                </th>
              ))}
              {displayColumns.length > 8 && (
                <th className="px-3 py-2 text-left text-[11px] text-slate-500">
                  +{displayColumns.length - 8} colunas
                </th>
              )}
              <th className="px-3 py-2 text-left text-[11px] text-slate-500 w-16">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {rows.map((row) => (
              <tr
                key={row.index}
                className={`${
                  row.valid ? 'hover:bg-slate-900/50' : 'bg-red-950/20 hover:bg-red-950/30'
                } transition-colors`}
              >
                <td className="px-3 py-2 text-slate-500">{row.index + 1}</td>
                {displayColumns.slice(0, 8).map(col => (
                  <td key={col} className="px-3 py-2 text-white max-w-[200px] truncate" title={row.data[col]}>
                    {row.data[col] || <span className="text-slate-600 italic">vazio</span>}
                  </td>
                ))}
                {displayColumns.length > 8 && (
                  <td className="px-3 py-2 text-slate-500">+{displayColumns.length - 8}</td>
                )}
                <td className="px-3 py-2">
                  {row.valid ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : (
                    <div className="relative group inline-block">
                      <XCircle size={16} className="text-red-400 cursor-help" />
                      <div className="absolute left-0 bottom-6 bg-slate-800 border border-slate-700 rounded-lg p-2 text-[11px] text-red-300 whitespace-nowrap hidden group-hover:block z-20 shadow-xl">
                        {row.errors.map((e, i) => (
                          <div key={i} className="mb-0.5 last:mb-0">
                            <span className="text-slate-400">{e.column}:</span> {e.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Warning if errors */}
      {errorCount > 0 && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-800/30 rounded-xl p-3">
          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">
            {errorCount} linha(s) com erro serão ignoradas. Apenas as {validCount} linha(s) válidas serão importadas.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          disabled={importing}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
        >
          Voltar
        </button>
        <button
          onClick={onConfirm}
          disabled={importing || validCount === 0}
          className="flex-1 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-semibold text-sm transition-colors disabled:cursor-not-allowed"
        >
          {importing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Importando...
            </span>
          ) : (
            `Importar ${validCount} ${validCount === 1 ? 'registro' : 'registros'}`
          )}
        </button>
      </div>
    </div>
  );
}
