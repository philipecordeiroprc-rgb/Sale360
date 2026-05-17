'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Package, ArrowUpDown, Layers, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import api from '@/lib/api';

const MOVEMENT_TYPES: Record<string, string> = {
  INITIAL_STOCK: 'Estoque Inicial',
  PURCHASE_IN: 'Entrada (Compra)',
  PURCHASE_CANCEL: 'Cancel. Compra',
  SALE_OUT: 'Saída (Venda)',
  SALE_CANCEL: 'Cancel. Venda',
  ADJUSTMENT_IN: 'Ajuste (+)',
  ADJUSTMENT_OUT: 'Ajuste (-)',
  TRANSFER: 'Transferência',
};

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const show = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

export default function InventoryPage() {
  const [tab, setTab] = useState<'batches' | 'movements'>('batches');
  const [batches, setBatches] = useState<any[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [movements, setMovements] = useState<any[]>([]);
  const [movTotal, setMovTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const { toast, show } = useToast();

  // Filters
  const [batchProductSearch, setBatchProductSearch] = useState('');
  const [batchProducts, setBatchProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [movTypeFilter, setMovTypeFilter] = useState('');

  // Adjust
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState('');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.inventory.batches({ productId: selectedProductId || undefined, page });
      setBatches(data.batches);
      setBatchTotal(data.total);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar lotes');
    } finally {
      setLoading(false);
    }
  }, [selectedProductId, page]);

  const loadMovements = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.inventory.movements({ productId: selectedProductId || undefined, type: movTypeFilter || undefined, page });
      setMovements(data.movements);
      setMovTotal(data.total);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar movimentações');
    } finally {
      setLoading(false);
    }
  }, [selectedProductId, movTypeFilter, page]);

  useEffect(() => {
    if (tab === 'batches') loadBatches();
    else loadMovements();
  }, [tab, selectedProductId, page, movTypeFilter]);

  const searchProducts = async (q: string) => {
    setBatchProductSearch(q);
    if (q.length < 1) { setBatchProducts([]); return; }
    try {
      const data = await api.products.list({ search: q });
      setBatchProducts(data.products || []);
    } catch { setBatchProducts([]); }
  };

  const selectProduct = (p: any) => {
    setSelectedProductId(p.id);
    setBatchProductSearch(p.name);
    setBatchProducts([]);
  };

  const clearProduct = () => {
    setSelectedProductId('');
    setBatchProductSearch('');
    setPage(1);
  };

  const handleAdjust = async () => {
    if (!adjustProductId || !adjustQty || Number(adjustQty) === 0) return;
    setSaving(true);
    try {
      await api.inventory.adjust({
        productId: adjustProductId,
        quantity: Number(adjustQty),
        notes: adjustNotes || undefined,
      });
      show(`Ajuste de ${Number(adjustQty) > 0 ? '+' : ''}${adjustQty} realizado!`);
      setAdjustOpen(false);
      loadBatches();
      loadMovements();
    } catch (err: any) {
      show(err.message || 'Erro no ajuste', 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (v: any) => `R$ ${Number(v || 0).toFixed(2)}`;

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Estoque</h1>
          <p className="text-slate-400 text-sm mt-1">Lotes PEPS e movimentações</p>
        </div>
        <button onClick={() => {
          setAdjustProductId(selectedProductId || '');
          setAdjustQty('');
          setAdjustNotes('');
          setAdjustOpen(true);
        }} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium text-sm transition-colors">
          <RefreshCw size={18} /> Ajuste Manual
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 mb-4 w-fit">
        <button onClick={() => { setTab('batches'); setPage(1); }}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === 'batches' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
          }`}>
          <Layers size={14} className="inline mr-1.5" /> Lotes ({batchTotal})
        </button>
        <button onClick={() => { setTab('movements'); setPage(1); }}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === 'movements' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
          }`}>
          <ArrowUpDown size={14} className="inline mr-1.5" /> Movimentações ({movTotal})
        </button>
      </div>

      {/* Product filter */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={batchProductSearch}
            onChange={(e) => searchProducts(e.target.value)}
            placeholder="Filtrar por produto..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-sm placeholder:text-slate-500 focus:border-indigo-500 outline-none" />
          {batchProducts.length > 0 && (
            <div className="absolute top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg max-h-40 overflow-y-auto z-10">
              {batchProducts.map((p: any) => (
                <button key={p.id} onClick={() => selectProduct(p)}
                  className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">
                  {p.name} — Estoque: {p.stockQty}
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedProductId && (
          <button onClick={clearProduct}
            className="text-xs text-indigo-400 hover:text-indigo-300">Limpar filtro</button>
        )}

        {tab === 'movements' && (
          <select value={movTypeFilter} onChange={(e) => { setMovTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-sm outline-none">
            <option value="">Todos os tipos</option>
            {Object.entries(MOVEMENT_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-2/3 mb-2" />
              <div className="h-3 bg-slate-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400 mb-3">{error}</p>
          <button onClick={() => tab === 'batches' ? loadBatches() : loadMovements()}
            className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm">Tentar novamente</button>
        </div>
      ) : tab === 'batches' ? (
        <>
          {batches.length === 0 ? (
            <div className="text-center py-12">
              <Package size={48} className="mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">{selectedProductId ? 'Produto sem lotes' : 'Nenhum lote de estoque'}</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-slate-800">
                    <th className="text-left px-4 py-3">Produto</th>
                    <th className="text-left px-4 py-3">Variação</th>
                    <th className="text-right px-4 py-3">Qtd Original</th>
                    <th className="text-right px-4 py-3">Qtd Restante</th>
                    <th className="text-right px-4 py-3">Custo Un.</th>
                    <th className="text-right px-4 py-3">Valor Restante</th>
                    <th className="text-right px-4 py-3">Recebido em</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b: any) => (
                    <tr key={b.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{b.product?.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{b.variation?.name || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{b.quantity}</td>
                      <td className="px-4 py-3 text-right text-white font-mono">{b.remainingQty}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{formatCurrency(b.unitCost)}</td>
                      <td className="px-4 py-3 text-right text-slate-400">
                        {formatCurrency(Number(b.remainingQty) * Number(b.unitCost))}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">
                        {new Date(b.receivedAt).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {batchTotal > 50 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 bg-slate-900 text-slate-400 rounded-lg text-sm disabled:opacity-40">Anterior</button>
              <span className="text-slate-400 text-sm">Página {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 50 >= batchTotal}
                className="px-3 py-1.5 bg-slate-900 text-slate-400 rounded-lg text-sm disabled:opacity-40">Próxima</button>
            </div>
          )}
        </>
      ) : (
        <>
          {movements.length === 0 ? (
            <div className="text-center py-12">
              <ArrowUpDown size={48} className="mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">Nenhuma movimentação encontrada</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-slate-800">
                    <th className="text-left px-4 py-3">Data</th>
                    <th className="text-left px-4 py-3">Tipo</th>
                    <th className="text-left px-4 py-3">Produto</th>
                    <th className="text-right px-4 py-3">Qtd</th>
                    <th className="text-right px-4 py-3">Custo Un.</th>
                    <th className="text-right px-4 py-3">Custo Total</th>
                    <th className="text-left px-4 py-3">Obs</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m: any) => {
                    const isOut = Number(m.quantity) < 0;
                    return (
                      <tr key={m.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            isOut ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {MOVEMENT_TYPES[m.type] || m.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white">{m.product?.name || '—'}</td>
                        <td className={`px-4 py-3 text-right font-mono ${isOut ? 'text-red-400' : 'text-emerald-400'}`}>
                          {isOut ? '' : '+'}{m.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">{m.unitCost ? formatCurrency(m.unitCost) : '—'}</td>
                        <td className="px-4 py-3 text-right text-slate-400">{m.totalCost ? formatCurrency(m.totalCost) : '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">{m.notes || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {movTotal > 50 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 bg-slate-900 text-slate-400 rounded-lg text-sm disabled:opacity-40">Anterior</button>
              <span className="text-slate-400 text-sm">Página {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 50 >= movTotal}
                className="px-3 py-1.5 bg-slate-900 text-slate-400 rounded-lg text-sm disabled:opacity-40">Próxima</button>
            </div>
          )}
        </>
      )}

      {/* Adjust Modal */}
      <Modal open={adjustOpen} onClose={() => setAdjustOpen(false)} title="Ajuste Manual de Estoque" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Produto</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={batchProductSearch}
                onChange={(e) => searchProducts(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
              {batchProducts.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-slate-700 border border-slate-600 rounded-lg max-h-32 overflow-y-auto z-10">
                  {batchProducts.map((p: any) => (
                    <button key={p.id} onClick={() => { setAdjustProductId(p.id); setBatchProductSearch(p.name); setBatchProducts([]); }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-600">
                      {p.name} — Estoque: {p.stockQty}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Quantidade <span className="text-xs text-slate-500">(+ para entrada, - para saída)</span>
            </label>
            <input type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)}
              step="any" placeholder="Ex: 10 ou -5"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Observação</label>
            <input value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)}
              placeholder="Motivo do ajuste..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setAdjustOpen(false)} className="px-4 py-2 text-slate-400 text-sm hover:text-white">Cancelar</button>
            <button onClick={handleAdjust}
              disabled={saving || !adjustProductId || !adjustQty || Number(adjustQty) === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${
                Number(adjustQty) > 0 ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'
              } text-white`}>
              {saving ? 'Ajustando...' : Number(adjustQty) > 0 ? `+${adjustQty}` : adjustQty}
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
