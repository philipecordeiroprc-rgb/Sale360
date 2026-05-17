'use client';

import { useState, useMemo } from 'react';
import { Plus, X, RefreshCw } from 'lucide-react';

const SIZE_OPTIONS = ['P', 'M', 'G', 'GG', 'XG', 'Único', '32', '34', '36', '38', '40', '42', '44', '46'];
const COLOR_OPTIONS = ['Vermelho', 'Azul', 'Verde', 'Preto', 'Branco', 'Amarelo', 'Rosa', 'Cinza', 'Marrom', 'Laranja', 'Roxo', 'Bege'];

export interface VariationData {
  id?: string;
  name: string;
  priceModifier: number;
  stockQty: number;
  lowStockAt?: number;
  sku?: string;
  barcode?: string;
}

interface VariationEditorProps {
  variations: VariationData[];
  onChange: (variations: VariationData[]) => void;
}

export function VariationEditor({ variations, onChange }: VariationEditorProps) {
  // Combination mode state
  const [dim1Selected, setDim1Selected] = useState<Set<string>>(new Set());
  const [dim2Selected, setDim2Selected] = useState<Set<string>>(new Set());
  const [dim2Enabled, setDim2Enabled] = useState(false);

  // Inline edit state
  const [editingStock, setEditingStock] = useState<Record<number, string>>({});
  const [editingLowStock, setEditingLowStock] = useState<Record<number, string>>({});
  const [editingPrice, setEditingPrice] = useState<Record<number, string>>({});

  const toggleDim1 = (val: string) => {
    setDim1Selected((prev) => {
      const next = new Set(prev);
      next.has(val) ? next.delete(val) : next.add(val);
      return next;
    });
  };

  const toggleDim2 = (val: string) => {
    setDim2Selected((prev) => {
      const next = new Set(prev);
      next.has(val) ? next.delete(val) : next.add(val);
      return next;
    });
  };

  const hasSelection = dim1Selected.size > 0;

  const handleGenerate = () => {
    if (!hasSelection) return;
    const dim1 = Array.from(dim1Selected);
    const dim2 = dim2Enabled ? Array.from(dim2Selected) : [];

    if (dim2.length === 0) {
      // Single dimension: just add each size/option as a variation
      const existingNames = new Set(variations.map((v) => v.name));
      const newVars = dim1
        .filter((d) => !existingNames.has(d))
        .map((name) => ({ name, priceModifier: 0, stockQty: 0 }));
      if (newVars.length > 0) {
        onChange([...variations, ...newVars]);
      }
    } else {
      // Two dimensions: generate all combinations
      const existingNames = new Set(variations.map((v) => v.name));
      const newVars: VariationData[] = [];
      for (const d1 of dim1) {
        for (const d2 of dim2) {
          const name = `${d1} / ${d2}`;
          if (!existingNames.has(name)) {
            newVars.push({ name, priceModifier: 0, stockQty: 0 });
          }
        }
      }
      if (newVars.length > 0) {
        onChange([...variations, ...newVars]);
      }
    }
  };

  const handleRemove = (index: number) => {
    onChange(variations.filter((_, i) => i !== index));
  };

  const updateVariation = (index: number, field: 'stockQty' | 'lowStockAt' | 'priceModifier', value: number) => {
    const updated = [...variations];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  // Bulk set stock for all variations
  const setAllStock = (qty: number) => {
    onChange(variations.map((v) => ({ ...v, stockQty: qty })));
  };

  // Bulk set price modifier for all variations
  const setAllPriceModifier = (mod: number) => {
    onChange(variations.map((v) => ({ ...v, priceModifier: mod })));
  };

  return (
    <div className="space-y-4">
      {/* Combination Generator */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <RefreshCw size={14} />
          Gerar Combinações
        </h4>
        <p className="text-xs text-slate-500">
          Selecione as opções abaixo e clique em Gerar para criar todas as combinações de variações.
        </p>

        {/* Dimension 1: Size */}
        <div>
          <label className="block text-slate-400 text-xs mb-1.5">Tamanhos / Opções *</label>
          <div className="flex gap-1 flex-wrap">
            {SIZE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => toggleDim1(opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  dim1Selected.has(opt)
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Dimension 2 toggle + Colors */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer mb-1.5">
            <input
              type="checkbox"
              checked={dim2Enabled}
              onChange={(e) => {
                setDim2Enabled(e.target.checked);
                if (!e.target.checked) setDim2Selected(new Set());
              }}
              className="rounded"
            />
            <span className="text-slate-400 text-xs">Adicionar segunda dimensão (ex: Cor)</span>
          </label>
          {dim2Enabled && (
            <div className="flex gap-1 flex-wrap mt-1.5">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleDim2(opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    dim2Selected.has(opt)
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Preview of combinations */}
        {hasSelection && (
          <div className="text-xs text-slate-400">
            {(() => {
              const d1 = Array.from(dim1Selected);
              const d2 = dim2Enabled ? Array.from(dim2Selected) : [];
              const total = d2.length > 0 ? d1.length * d2.length : d1.length;
              const existingNames = new Set(variations.map((v) => v.name));
              const newCount = d2.length > 0
                ? d1.reduce((acc, a) => acc + d2.filter((b) => !existingNames.has(`${a} / ${b}`)).length, 0)
                : d1.filter((a) => !existingNames.has(a)).length;
              return (
                <span>
                  {total} combinações possíveis ({newCount} novas)
                </span>
              );
            })()}
          </div>
        )}

        {/* Generate + Bulk actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!hasSelection}
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw size={14} />
            Gerar Combinações
          </button>
        </div>
      </div>

      {/* Variations list with inline edit */}
      {variations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-slate-400 text-xs">
              {variations.length} variações
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAllStock(0)}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Zerar estoque
              </button>
              <button
                type="button"
                onClick={() => {
                  const qty = parseInt(prompt('Estoque para todas as variações:') || '0') || 0;
                  setAllStock(qty);
                }}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Definir estoque...
              </button>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-slate-500 border-b border-slate-800 bg-slate-900/50">
              <div className="col-span-4">Nome</div>
              <div className="col-span-3">Estoque</div>
              <div className="col-span-3">Est. Mínimo</div>
              <div className="col-span-2"></div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
              {variations.map((v, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 items-center text-sm hover:bg-slate-900/30 transition-colors">
                  <div className="col-span-4 text-white truncate" title={v.name}>
                    {v.name}
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      min="0"
                      value={editingStock[i] ?? String(v.stockQty)}
                      onChange={(e) => setEditingStock({ ...editingStock, [i]: e.target.value })}
                      onBlur={() => {
                        updateVariation(i, 'stockQty', parseInt(editingStock[i]) || 0);
                        const next = { ...editingStock };
                        delete next[i];
                        setEditingStock(next);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      min="0"
                      value={editingLowStock[i] ?? (v.lowStockAt != null ? String(v.lowStockAt) : '')}
                      onChange={(e) => setEditingLowStock({ ...editingLowStock, [i]: e.target.value })}
                      onBlur={() => {
                        updateVariation(i, 'lowStockAt', parseFloat(editingLowStock[i]) || 0);
                        const next = { ...editingLowStock };
                        delete next[i];
                        setEditingLowStock(next);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      placeholder="0"
                      className="w-full bg-slate-900 border border-slate-800 rounded-md px-2 py-1.5 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemove(i)}
                      className="p-1.5 hover:bg-red-500/20 rounded-md text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual add (for edge cases) */}
      <details className="group">
        <summary className="text-xs text-slate-500 hover:text-slate-400 cursor-pointer transition-colors">
          Ou adicionar variação manualmente...
        </summary>
        <ManualAddForm
          onAdd={(v) => onChange([...variations, v])}
          existingNames={new Set(variations.map((x) => x.name))}
        />
      </details>
    </div>
  );
}

function ManualAddForm({
  onAdd,
  existingNames,
}: {
  onAdd: (v: VariationData) => void;
  existingNames: Set<string>;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('0');
  const [stock, setStock] = useState('0');

  const handleAdd = () => {
    if (!name.trim() || existingNames.has(name.trim())) return;
    onAdd({
      name: name.trim(),
      priceModifier: parseFloat(price) || 0,
      stockQty: parseInt(stock) || 0,
    });
    setName('');
    setPrice('0');
    setStock('0');
  };

  return (
    <div className="mt-2 flex gap-2 items-end">
      <div className="flex-1">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da variação"
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
      </div>
      <div className="w-20">
        <input
          type="number"
          min="0"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          placeholder="Qtd"
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>
      <div className="w-24">
        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="R$"
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={!name.trim()}
        className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
      >
        <Plus size={14} />
        Add
      </button>
    </div>
  );
}
