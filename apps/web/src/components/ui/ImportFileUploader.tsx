'use client';
import { useCallback, useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, FileText, X, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import type { ImportConfig, ParsedRow } from '@/lib/import-types';
import { validateImportRows } from '@/lib/import-validators';

interface Props {
  config: ImportConfig;
  onParsed: (rows: ParsedRow[], rawData: Record<string, string>[]) => void;
  onBack: () => void;
}

export function ImportFileUploader({ config, onParsed, onBack }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setError(null);
    setFileName(file.name);
    setParsing(true);

    // Validate extension
    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
      setError('Formato inválido. Selecione um arquivo CSV.');
      setParsing(false);
      return;
    }

    Papa.parse(file, {
      delimiter: ';',
      encoding: 'UTF-8',
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsing(false);

        if (results.errors.length > 0) {
          const err = results.errors[0];
          if (err.code === 'UndetectableDelimiter' || err.type === 'FieldMismatch') {
            // Try comma as delimiter
            Papa.parse(file, {
              delimiter: ',',
              encoding: 'UTF-8',
              header: true,
              skipEmptyLines: true,
              complete: (results2) => {
                if (results2.data.length === 0) {
                  setError('O arquivo CSV está vazio.');
                  return;
                }
                const raw = results2.data as Record<string, string>[];
                const parsed = validateImportRows(raw, config.type);
                onParsed(parsed, raw);
              },
              error: () => setError('Erro ao processar arquivo. Verifique o formato CSV.'),
            });
            return;
          }
          setError(`Erro ao ler CSV: ${err.message}`);
          return;
        }

        if (results.data.length === 0) {
          setError('O arquivo CSV está vazio.');
          return;
        }

        const raw = results.data as Record<string, string>[];
        const parsed = validateImportRows(raw, config.type);
        onParsed(parsed, raw);
      },
      error: (err: any) => {
        setParsing(false);
        setError(`Erro ao processar arquivo: ${err.message}`);
      },
    });
  }, [config.type, onParsed]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) processFile(files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) processFile(files[0]);
  };

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={14} />
        Voltar para o guia
      </button>

      {/* Drop zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
          dragActive
            ? 'border-indigo-500 bg-indigo-500/10'
            : 'border-slate-700 hover:border-slate-600 hover:bg-slate-900/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileChange}
          className="hidden"
        />

        {parsing ? (
          <div className="space-y-3">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-slate-400">Processando arquivo...</p>
            {fileName && <p className="text-xs text-slate-500">{fileName}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto transition-colors ${
              dragActive ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'
            }`}>
              <Upload size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {dragActive ? 'Solte o arquivo aqui' : 'Arraste um arquivo CSV ou clique para selecionar'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Formato: CSV com separador ponto-e-vírgula (;), encoding UTF-8
              </p>
            </div>
            {fileName && !parsing && (
              <div className="inline-flex items-center gap-1.5 bg-slate-800 rounded-lg px-3 py-1.5">
                <FileText size={14} className="text-indigo-400" />
                <span className="text-xs text-slate-300">{fileName}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setFileName(null); setError(null); }}
                  className="p-0.5 hover:bg-slate-700 rounded"
                >
                  <X size={12} className="text-slate-500" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-800/30 rounded-xl p-3">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Column expectations */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
        <h4 className="text-xs font-semibold text-slate-400 mb-2">Colunas esperadas no CSV:</h4>
        <div className="flex flex-wrap gap-1.5">
          {config.expectedColumns.map((col) => (
            <span key={col} className="px-2 py-0.5 bg-slate-800 rounded text-[11px] text-slate-300">
              {col}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
