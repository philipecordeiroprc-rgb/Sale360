'use client';
import { useState, useCallback } from 'react';
import { Modal } from './Modal';
import { ImportSequenceGuide } from './ImportSequenceGuide';
import { ImportFileUploader } from './ImportFileUploader';
import { ImportPreviewTable } from './ImportPreviewTable';
import { ImportResultSummary } from './ImportResultSummary';
import type { ImportConfig, ParsedRow, ImportResult } from '@/lib/import-types';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  config: ImportConfig;
}

type Step = 'guide' | 'upload' | 'preview' | 'confirming' | 'result';

const STEP_LABELS: Record<Step, string> = {
  guide: 'Guia de Importação',
  upload: 'Selecionar Arquivo',
  preview: 'Pré-visualização',
  confirming: 'Importando...',
  result: 'Resultado',
};

export function ImportModal({ open, onClose, onImported, config }: ImportModalProps) {
  const [step, setStep] = useState<Step>('guide');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFileParsed = useCallback((parsedRows: ParsedRow[], rawRows: Record<string, string>[]) => {
    setRows(parsedRows);
    setRawData(rawRows);
    setStep('preview');
  }, []);

  const handleConfirmImport = useCallback(async () => {
    setImporting(true);
    setStep('confirming');

    try {
      // Send only valid rows (use cleaned data from validators, not raw Papa Parse output)
      const validRows = rows.filter(r => r.valid).map(r => r.data);

      // Build the request body
      const body: any = { rows: validRows };

      // Detect simple vs variations mode for products
      if (config.type === 'products' || config.type === 'productsVariations') {
        const firstRow = validRows[0];
        if (firstRow) {
          if ('Nome do Produto' in firstRow && 'Qtd' in firstRow) {
            // Variations mode - detect dimension column names from data
            body.mode = 'variations';
            // Find which columns are the dimension values (not fixed columns)
            const fixedCols = ['Nome do Produto', 'Categoria', 'Preço Base', 'Qtd', 'Preço Extra', 'SKU', 'Código de Barras', 'Estoque Mínimo'];
            const dimCols = Object.keys(firstRow).filter(k => k && k.trim() && !fixedCols.includes(k));
            body.dim1Label = dimCols[0] || 'Tamanho';
            body.dim2Label = dimCols[1] || undefined;
          } else {
            body.mode = 'simple';
          }
        }
      }

      // Get token from cookie
      const token = document.cookie.split('; ').find(row => row.startsWith('sale360_token='))?.split('=')[1];
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

      const res = await fetch(`${apiUrl}/api/${config.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Erro ${res.status}`);
      }

      setResult({
        imported: data.imported || 0,
        errors: data.errors || [],
        warnings: data.warnings || [],
      });
      setStep('result');
      if (data.imported > 0) onImported();
    } catch (err: any) {
      setResult({
        imported: 0,
        errors: [{ row: -1, message: err.message || 'Erro desconhecido' }],
        warnings: [],
      });
      setStep('result');
    } finally {
      setImporting(false);
    }
  }, [rows, config, onImported]);

  const resetAndClose = useCallback(() => {
    setStep('guide');
    setRows([]);
    setRawData([]);
    setResult(null);
    setImporting(false);
    onClose();
  }, [onClose]);

  const stepOrder: Step[] = ['guide', 'upload', 'preview', 'result'];

  return (
    <Modal open={open} onClose={resetAndClose} title={STEP_LABELS[step]} size="xl">
      {/* Step dots */}
      <div className="flex items-center justify-center gap-1.5 mb-6">
        {stepOrder.map((s, i) => {
          const isActive = s === step;
          const isDone = stepOrder.indexOf(step) > i || (s === 'preview' && step === 'confirming') || (s !== 'result' && step === 'result');
          const isResult = s === 'result';

          return (
            <div key={s} className="flex items-center gap-1.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                  isActive
                    ? 'bg-indigo-500 text-white'
                    : isDone && !isResult
                    ? 'bg-emerald-500 text-white'
                    : isResult && step === 'result'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {(isDone && !isResult && !isActive) ? '✓' : i + 1}
              </div>
              {i < stepOrder.length - 1 && (
                <div className={`w-8 h-0.5 rounded ${
                  stepOrder.indexOf(step) > i ? 'bg-emerald-500' : 'bg-slate-800'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {step === 'guide' && (
        <ImportSequenceGuide
          currentType={config.type}
          onProceed={() => setStep('upload')}
        />
      )}

      {step === 'upload' && (
        <ImportFileUploader
          config={config}
          onParsed={handleFileParsed}
          onBack={() => setStep('guide')}
        />
      )}

      {step === 'preview' && (
        <ImportPreviewTable
          rows={rows}
          config={config}
          onConfirm={handleConfirmImport}
          onBack={() => setStep('upload')}
          importing={importing}
        />
      )}

      {step === 'confirming' && (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Importando dados...</p>
          <p className="text-xs text-slate-500 mt-1">Isso pode levar alguns segundos</p>
        </div>
      )}

      {step === 'result' && (
        <ImportResultSummary
          result={result}
          onClose={resetAndClose}
        />
      )}
    </Modal>
  );
}
