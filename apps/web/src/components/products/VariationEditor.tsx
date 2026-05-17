'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';

const SIZE_PRESETS = ['P', 'M', 'G', 'GG', 'XG', 'Único'];
const COLOR_PRESETS = ['Vermelho', 'Azul', 'Verde', 'Preto', 'Branco', 'Amarelo', 'Rosa', 'Cinza'];

export interface VariationData {
  id?: string; // existing: has id; new: no id
  name: string;
  priceModifier: number;
  stockQty: number;
  sku?: string;
  barcode?: string;
}

interface VariationEditorProps {
  variations: VariationData[];
  onChange: (variations: VariationData[]) => void;
}

export function VariationEditor({ variations, onChange }: VariationEditorProps) {
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('0');
  const [newStock, setNewStock] = useState('0');

  const handleAdd = () => {
    if (!newName.trim()) return;
    onChange([
      ...variations,
      {
        name: newName.trim(),
        priceModifier: parseFloat(newPrice) || 0,
        stockQty: parseInt(newStock) || 0,
      },
    ]);
    setNewName('');
    setNewPrice('0');
    setNewStock('0');
  };

  const handleRemove = (index: number) => {
    onChange(variations.filter((_, i) => i !== index));
  };

  const handlePreset = (name: string) => {
    if (variations.some((v) => v.name === name)) return; // avoid duplicate
    onChange([
      ...variations,
      { name, priceModifier: 0, stockQty: 0 },
    ]);
  };

  return (
    <div className="space-y-3">
      {/* Quick presets */}
      <div>
        <label className="block text-slate-400 text-xs mb-1.5">Tamanhos (clique para adicionar)</label>
        <div className="flex gap-1 flex-wrap">
          {SIZE_PRESETS.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => handlePreset(size)}
              disabled={variations.some((v) => v.name === size)}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-slate-400 text-xs mb-1.5">Cores (clique para adicionar)</label>
        <div className="flex gap-1 flex-wrap">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handlePreset(color)}
              disabled={variations.some((v) => v.name === color)}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {color}
            </button>
          ))}
        </div>
      </div>

      {/* Variation list */}
      {variations.length > 0 && (
        <div className="space-y-1.5">
          <label className="block text-slate-400 text-xs">Variações adicionadas</label>
          <div className="bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-800 overflow-hidden">
            {variations.map((v, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1 text-white truncate">{v.name}</span>
                {v.priceModifier > 0 && (
                  <span className="text-emerald-400 text-xs">+R$ {v.priceModifier.toFixed(2)}</span>
                )}
                {v.priceModifier < 0 && (
                  <span className="text-red-400 text-xs">-R$ {Math.abs(v.priceModifier).toFixed(2)}</span>
                )}
                <span className="text-slate-400 text-xs">Est: {v.stockQty}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  className="p-1 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add custom variation */}
      <div className="border-t border-slate-800 pt-3">
        <label className="block text-slate-400 text-xs mb-2">Adicionar variação personalizada</label>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: 500G, Azul Royal, GG"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="w-20">
            <input
              type="number"
              step="0.01"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="R$"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="w-16">
            <input
              type="number"
              min="0"
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              placeholder="Qtd"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="flex items-center gap-1 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
