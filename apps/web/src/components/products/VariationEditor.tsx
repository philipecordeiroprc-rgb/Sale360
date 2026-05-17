'use client';

import { useState } from 'react';
import { Plus, X, RefreshCw } from 'lucide-react';
import type { VariationTemplate, VariationDimension, DimensionType } from '@/lib/api';

// Presets de opções por tipo de dimensão (usados como sugestão além do template)
const TYPE_PRESETS: Record<DimensionType, string[]> = {
  TAMANHO_LETRA: ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG', 'Único'],
  TAMANHO_NUMERO: ['2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22', '24', '26', '28', '30', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
  COR: ['Vermelho', 'Azul', 'Verde', 'Preto', 'Branco', 'Amarelo', 'Rosa', 'Cinza', 'Marrom', 'Laranja', 'Roxo', 'Bege', 'Bordô', 'Turquesa', 'Dourado', 'Prateado'],
  VOLUME: ['50ml', '100ml', '200ml', '250ml', '300ml', '350ml', '500ml', '600ml', '750ml', '1L', '1.5L', '2L', '5L', '10L', '20L'],
  PESO: ['50g', '100g', '200g', '250g', '500g', '750g', '1kg', '2kg', '5kg', '10kg', '20kg', '50kg'],
  PERSONALIZADO: [],
};

const TYPE_LABEL: Record<DimensionType, string> = {
  TAMANHO_LETRA: 'Tam. Letra',
  TAMANHO_NUMERO: 'Tam. Número',
  COR: 'Cor',
  VOLUME: 'Volume',
  PESO: 'Peso',
  PERSONALIZADO: 'Livre',
};

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
  template: VariationTemplate | null;
  variations: VariationData[];
  onChange: (variations: VariationData[]) => void;
  purchaseMode?: boolean; // hides lowStock column, renames "Estoque" → "Qtd Comprada"
}

export function VariationEditor({ template, variations, onChange, purchaseMode }: VariationEditorProps) {
  // Per-dimension selected options: Map<dimensionIndex, Set<selectedOption>>
  const [selected, setSelected] = useState<Record<number, Set<string>>>({});
  // Custom option input per dimension
  const [customInput, setCustomInput] = useState<Record<number, string>>({});

  const dimensions = template?.dimensions || [];

  const toggleOption = (dimIndex: number, option: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      const current = new Set(next[dimIndex] || []);
      current.has(option) ? current.delete(option) : current.add(option);
      next[dimIndex] = current;
      return next;
    });
  };

  const addCustomOption = (dimIndex: number) => {
    const val = (customInput[dimIndex] || '').trim();
    if (!val || !dimensions[dimIndex]) return;
    toggleOption(dimIndex, val);
    setCustomInput((prev) => ({ ...prev, [dimIndex]: '' }));
  };

  const hasSelection = dimensions.some((_, i) => (selected[i]?.size || 0) > 0);

  const handleGenerate = () => {
    if (!hasSelection) return;

    // Collect selected options per dimension
    const dimOptions: string[][] = [];
    for (let i = 0; i < dimensions.length; i++) {
      const opts = Array.from(selected[i] || []);
      if (opts.length > 0) dimOptions.push(opts);
    }

    if (dimOptions.length === 0) return;

    // Generate cross-product
    const combinations = cartesianProduct(dimOptions);
    const names = combinations.map((combo) => combo.join(' / '));

    const existingNames = new Set(variations.map((v) => v.name));
    const newVars = names
      .filter((name) => !existingNames.has(name))
      .map((name) => ({ name, priceModifier: 0, stockQty: 0 }));

    if (newVars.length > 0) {
      onChange([...variations, ...newVars]);
    }
  };

  // Get combined options for a dimension (template options + presets for this type)
  const getOptions = (dim: VariationDimension): string[] => {
    const templateOptions = dim.options || [];
    const presetOptions = TYPE_PRESETS[dim.type] || [];
    // Merge deduped: template first, then presets
    const merged = [...templateOptions];
    for (const opt of presetOptions) {
      if (!merged.includes(opt)) merged.push(opt);
    }
    return merged;
  };

  const handleRemove = (index: number) => {
    onChange(variations.filter((_, i) => i !== index));
  };

  const updateVariation = (index: number, field: 'stockQty' | 'lowStockAt' | 'priceModifier', value: number) => {
    const updated = [...variations];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const setAllStock = (qty: number) => {
    onChange(variations.map((v) => ({ ...v, stockQty: qty })));
  };

  // Count new combinations
  const countNew = (): number => {
    if (!hasSelection) return 0;
    const dimOptions: string[][] = [];
    for (let i = 0; i < dimensions.length; i++) {
      const opts = Array.from(selected[i] || []);
      if (opts.length > 0) dimOptions.push(opts);
    }
    if (dimOptions.length === 0) return 0;
    const combinations = cartesianProduct(dimOptions);
    const names = new Set(variations.map((v) => v.name));
    return combinations.filter((combo) => !names.has(combo.join(' / '))).length;
  };

  const totalCombos = (() => {
    let total = 1;
    for (let i = 0; i < dimensions.length; i++) {
      const n = selected[i]?.size || 0;
      if (n > 0) total *= n;
    }
    return dimensions.some((_, i) => (selected[i]?.size || 0) > 0) ? total : 0;
  })();

  // Inline edit state
  const [editingStock, setEditingStock] = useState<Record<number, string>>({});
  const [editingLowStock, setEditingLowStock] = useState<Record<number, string>>({});

  return (
    <div className="space-y-4">
      {/* Dimension Selector */}
      {dimensions.length > 0 ? (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
          <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <RefreshCw size={14} />
            Gerar Combinações
          </h4>

          {dimensions.map((dim, dimIndex) => {
            const options = getOptions(dim);
            const typeLabel = TYPE_LABEL[dim.type] || dim.type;
            const sel = selected[dimIndex] || new Set<string>();

            return (
              <div key={dim.id || dimIndex}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-slate-400 text-xs font-medium">{dim.label}</span>
                  <span className="text-[10px] text-slate-500 bg-slate-800 rounded px-1.5 py-0.5 uppercase tracking-wider">
                    {typeLabel}
                  </span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleOption(dimIndex, opt)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        sel.has(opt)
                          ? 'bg-indigo-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                  {/* Custom option input */}
                  <div className="flex gap-1 items-center">
                    <input
                      type="text"
                      value={customInput[dimIndex] || ''}
                      onChange={(e) => setCustomInput({ ...customInput, [dimIndex]: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') addCustomOption(dimIndex); }}
                      placeholder="+"
                      className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => addCustomOption(dimIndex)}
                      disabled={!customInput[dimIndex]?.trim()}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-md text-slate-400 hover:text-white transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Preview */}
          {hasSelection && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {totalCombos} combinações ({countNew()} novas)
              </span>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={countNew() === 0}
                className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <RefreshCw size={14} />
                Gerar Combinações
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 text-center">
            {template === null
              ? 'Selecione uma categoria para carregar as dimensões de variação.'
              : 'O template desta categoria não possui dimensões configuradas.'}
          </p>
        </div>
      )}

      {/* Variations list */}
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
            <div className={`grid gap-2 px-3 py-2 text-xs text-slate-500 border-b border-slate-800 bg-slate-900/50 ${
              purchaseMode ? 'grid-cols-10' : 'grid-cols-12'
            }`}>
              <div className={purchaseMode ? 'col-span-6' : 'col-span-4'}>Nome</div>
              <div className="col-span-3">{purchaseMode ? 'Qtd Comprada' : 'Estoque'}</div>
              {!purchaseMode && <div className="col-span-3">Est. Mínimo</div>}
              <div className="col-span-2"></div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
              {variations.map((v, i) => (
                <div key={i} className={`grid gap-2 px-3 py-2 items-center text-sm hover:bg-slate-900/30 transition-colors ${
                  purchaseMode ? 'grid-cols-10' : 'grid-cols-12'
                }`}>
                  <div className={purchaseMode ? 'col-span-6 truncate' : 'col-span-4 truncate'} title={v.name}>
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
                  {!purchaseMode && (
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
                  )}
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

      {/* Manual add */}
      {dimensions.length === 0 && (
        <details className="group">
          <summary className="text-xs text-slate-500 hover:text-slate-400 cursor-pointer transition-colors">
            Ou adicionar variação manualmente...
          </summary>
          <ManualAddForm
            onAdd={(v) => onChange([...variations, v])}
            existingNames={new Set(variations.map((x) => x.name))}
          />
        </details>
      )}
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function cartesianProduct(arrays: string[][]): string[][] {
  if (arrays.length === 0) return [];
  return arrays.reduce<string[][]>(
    (acc, curr) => acc.flatMap((a) => curr.map((b) => [...a, b])),
    [[]],
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
  const [stock, setStock] = useState('0');
  const [price, setPrice] = useState('0');

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
