'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import api, { type Product } from '@/lib/api';

interface Props {
  product: Product;
  onClose: () => void;
  onUpdated: () => void;
}

export function StockDetailModal({ product, onClose, onUpdated }: Props) {
  const [saving, setSaving] = useState<string | null>(null); // variation id being saved
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const handleSaveLowStock = async (variationId: string) => {
    const raw = editValues[variationId];
    if (raw === undefined) return;
    const val = raw === '' ? null : parseFloat(raw);
    if (raw !== '' && isNaN(val as number)) return;

    try {
      setSaving(variationId);
      setError('');
      await api.products.updateVariation(product.id, variationId, {
        lowStockAt: val as any,
      });
      // Clear edit state for this variation
      const next = { ...editValues };
      delete next[variationId];
      setEditValues(next);
      onUpdated();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar');
    } finally {
      setSaving(null);
    }
  };

  const getEditValue = (v: any): string => {
    if (v.id && editValues[v.id] !== undefined) return editValues[v.id];
    return v.lowStockAt != null ? String(v.lowStockAt) : '';
  };

  return (
    <Modal
      open={!!product}
      onClose={onClose}
      title={`Estoque - ${product.name}`}
      size="sm"
      closeOnOverlayClick={false}
    >
      <div className="space-y-3">
        {error && (
          <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-3 py-2 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Product-level low stock (default for all variations) */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
          <span className="text-xs text-slate-400">Est. Mínimo padrão:</span>
          <span className="text-sm text-white font-medium">
            {product.lowStockAt != null ? `${product.lowStockAt} un` : '—'}
          </span>
          <span className="text-[10px] text-slate-500">(usado para variações sem mínimo próprio)</span>
        </div>

        {product.hasVariations && product.variations?.length > 0 ? (
          <>
            <div className="bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-800 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs text-slate-500 bg-slate-900/50">
                <span className="col-span-4">Variação</span>
                <span className="col-span-2 text-center">Estoque</span>
                <span className="col-span-4 text-center">Est. Mínimo</span>
                <span className="col-span-2"></span>
              </div>
              {product.variations.map((v: any) => {
                const vStock = Number(v.stockQty);
                const effectiveLow = v.lowStockAt != null
                  ? Number(v.lowStockAt)
                  : product.lowStockAt != null ? Number(product.lowStockAt) : null;
                const low = effectiveLow != null && vStock <= effectiveLow;
                const isEditing = v.id && editValues[v.id] !== undefined;
                const editVal = getEditValue(v);

                return (
                  <div key={v.id || v.name} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-sm">
                    <span className="col-span-4 text-white truncate">{v.name}</span>
                    <span className={`col-span-2 text-center font-medium ${
                      vStock <= 0 ? 'text-red-400' : low ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {vStock}
                    </span>
                    <span className="col-span-4 text-center">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editVal}
                        onChange={(e) => {
                          if (v.id) setEditValues({ ...editValues, [v.id]: e.target.value });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && v.id) handleSaveLowStock(v.id);
                        }}
                        placeholder={product.lowStockAt != null ? String(product.lowStockAt) : '0'}
                        className={`w-20 bg-slate-900 border rounded-md px-2 py-1.5 text-white text-xs text-center placeholder:text-slate-600 focus:outline-none transition-colors ${
                          isEditing ? 'border-indigo-500' : 'border-slate-700'
                        }`}
                      />
                    </span>
                    <span className="col-span-2 flex justify-end">
                      {isEditing && v.id && (
                        <button
                          onClick={() => handleSaveLowStock(v.id)}
                          disabled={saving === v.id}
                          className="text-xs bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white px-2 py-1 rounded-md font-medium transition-colors"
                        >
                          {saving === v.id ? '...' : 'Salvar'}
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between px-1 text-sm">
              <span className="text-slate-400">Total</span>
              <span className="text-white font-semibold">
                {product.variations.reduce((sum: number, v: any) => sum + Number(v.stockQty), 0)} un
              </span>
            </div>
          </>
        ) : (
          <div className="text-center text-slate-400 py-4 bg-slate-950 border border-slate-800 rounded-xl">
            Produto sem variações. Estoque: {Number(product.stockQty)} un
            {product.lowStockAt != null && (
              <span className={Number(product.stockQty) <= Number(product.lowStockAt) ? ' text-amber-400' : ' text-emerald-400'}>
                {' '}(mín: {Number(product.lowStockAt)})
              </span>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
