'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Package, ArrowUpDown, Layers, RefreshCw, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import React from 'react';
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

const REASON_OPTIONS = [
  'Perda / Avariado',
  'Vencimento',
  'Erro de inventário',
  'Amostra / Brinde',
  'Devolução fornecedor',
  'Correção de estoque',
  'Outro',
];

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const show = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

interface BatchGroup {
  key: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  stockQty: number;
  lowStockAt: number;
  variationId: string | null;
  variationName: string | null;
  batches: any[];
  totalRemaining: number;
  expiredCount: number;
  expiringSoonCount: number;
}

function ExpiryBadge({ date }: { date: string | Date }) {
  const d = new Date(date);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isExpired = daysUntilExpiry < 0;
  const isSoon = !isExpired && daysUntilExpiry <= 7;

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
      isExpired
        ? 'bg-red-500/20 text-red-400'
        : isSoon
          ? 'bg-amber-500/20 text-amber-400'
          : 'bg-slate-700 text-slate-400'
    }`}>
      {isExpired ? `Vencido ${d.toLocaleDateString('pt-BR')}` : isSoon ? `Vence ${d.toLocaleDateString('pt-BR')}` : `Val. ${d.toLocaleDateString('pt-BR')}`}
    </span>
  );
}

export default function InventoryPage() {
  const [tab, setTab] = useState<'batches' | 'movements'>('batches');
  const [batches, setBatches] = useState<any[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [zeroStockProducts, setZeroStockProducts] = useState<any[]>([]);
  const [zeroStockVariations, setZeroStockVariations] = useState<any[]>([]);
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

  // Expandable batch groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Adjust
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState('');
  const [adjustProduct, setAdjustProduct] = useState<any>(null);
  const [adjustVariations, setAdjustVariations] = useState<any[]>([]);
  const [adjustVariationId, setAdjustVariationId] = useState('');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustReasonCustom, setAdjustReasonCustom] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Low stock alerts
  const [stockAlerts, setStockAlerts] = useState<{
    lowStockProducts: { id: string; name: string; stockQty: number; lowStockAt: number }[];
    lowStockVariations: { id: string; name: string; productId: string; productName: string; stockQty: number; lowStockAt: number }[];
  } | null>(null);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await api.inventory.alerts();
      setStockAlerts(data);
    } catch {
      setStockAlerts(null);
    }
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

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

  const selectProductForAdjust = (p: any) => {
    setAdjustProductId(p.id);
    setAdjustProduct(p);
    setBatchProductSearch(p.name);
    setBatchProducts([]);
    setAdjustVariationId('');
    // Sort variations: color alphabetically, then size numerically
    // "2 azul", "4 azul", "6 azul", "2 caramelo", "4 caramelo"...
    const sorted = [...(p.variations || [])].sort((a: any, b: any) => {
      const aName: string = a.name || '';
      const bName: string = b.name || '';
      const aNum = parseInt(aName.match(/^(\d+)/)?.[1] || '0', 10);
      const bNum = parseInt(bName.match(/^(\d+)/)?.[1] || '0', 10);
      const aText = aName.replace(/^\d+\s*/, '').trim().toLowerCase();
      const bText = bName.replace(/^\d+\s*/, '').trim().toLowerCase();
      // First by text (color) alphabetically, then by number (size)
      if (aText !== bText) return aText.localeCompare(bText, 'pt-BR');
      return aNum - bNum;
    });
    setAdjustVariations(sorted);
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

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAdjust = async () => {
    if (!adjustProductId || !adjustQty || Number(adjustQty) === 0) return;
    const finalReason = adjustReason === 'Outro' ? adjustReasonCustom : adjustReason;
    setSaving(true);
    try {
      await api.inventory.adjust({
        productId: adjustProductId,
        variationId: adjustVariationId || undefined,
        quantity: Number(adjustQty),
        reason: finalReason || undefined,
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

  // Stock level coloring
  const stockColor = (stock: number, min: number | null): string => {
    if (!min || min <= 0 || stock > min) return 'text-white';
    if (stock < min) return 'text-red-400';
    return 'text-amber-400'; // stock == min
  };


  const stockBadge = (stock: number, min: number | null) => {
    if (!min || min <= 0 || stock > min) return null;
    if (stock < min) {
      return <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">Baixo</span>;
    }
    return <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">Mínimo</span>;
  };

  // Group batches by product+variation
  const groupBatches = (): BatchGroup[] => {
    const map = new Map<string, BatchGroup>();
    const now = new Date();
    for (const b of batches) {
      const key = `${b.productId}__${b.variationId || 'none'}`;
      if (!map.has(key)) {
        // Use variation stock values when available, otherwise product-level
        const hasVariation = !!b.variationId;
        const stockQty = hasVariation
          ? Number(b.variation?.stockQty || 0)
          : Number(b.product?.stockQty || 0);
        const lowStockAt = hasVariation
          ? Number(b.variation?.lowStockAt || b.product?.lowStockAt || 0)
          : Number(b.product?.lowStockAt || 0);
        map.set(key, {
          key,
          productId: b.productId,
          productName: b.product?.name || '—',
          sku: b.product?.sku || '',
          unit: b.product?.unit || '',
          stockQty,
          lowStockAt,
          variationId: b.variationId || null,
          variationName: b.variation?.name || null,
          batches: [],
          totalRemaining: 0,
          expiredCount: 0,
          expiringSoonCount: 0,
        });
      }
      const group = map.get(key)!;
      group.batches.push(b);
      group.totalRemaining += Number(b.remainingQty || 0);
      // Compute expiry status for summary row
      if (b.expiryDate) {
        const daysUntilExpiry = Math.ceil((new Date(b.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry < 0) group.expiredCount++;
        else if (daysUntilExpiry <= 7) group.expiringSoonCount++;
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const nameCmp = a.productName.localeCompare(b.productName, 'pt-BR');
      if (nameCmp !== 0) return nameCmp;
      return (a.variationName || '').localeCompare(b.variationName || '', 'pt-BR');
    });
  };

  // Short batch ID for display
  const shortId = (id: string) => '#' + id.substring(0, 6).toUpperCase();

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
          setAdjustProduct(null);
          setAdjustVariations([]);
          setAdjustVariationId('');
          setAdjustQty('');
          setAdjustReason('');
          setAdjustReasonCustom('');
          setAdjustNotes('');
          setBatchProductSearch('');
          setAdjustOpen(true);
        }} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium text-sm transition-colors">
          <RefreshCw size={18} /> Ajuste Manual
        </button>
      </div>

      {/* Low stock alerts — only critical (stock < min) */}
      {stockAlerts && stockAlerts.lowStockProducts.length > 0 && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-2xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <AlertTriangle size={18} className="text-red-400 shrink-0" />
            <h4 className="text-sm font-semibold text-red-300">
              Abaixo do Mínimo ({stockAlerts.lowStockProducts.length})
            </h4>
          </div>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-red-500/20 text-red-400/60">
                  <th className="py-1.5 pr-2 font-medium">Produto</th>
                  <th className="py-1.5 pr-2 font-medium text-right w-16">Estoque</th>
                  <th className="py-1.5 font-medium text-right w-12">Mín</th>
                </tr>
              </thead>
              <tbody>
                {stockAlerts.lowStockProducts.map(p => {
                  const ratio = p.lowStockAt > 0 ? p.stockQty / p.lowStockAt : 0;
                  return (
                    <tr key={p.id} className="border-b border-red-500/10">
                      <td className="py-1.5 pr-2 text-white truncate max-w-[180px] sm:max-w-none">{p.name}</td>
                      <td className={`py-1.5 pr-2 text-right font-semibold w-16 ${ratio === 0 ? 'text-red-400' : 'text-red-300'}`}>
                        {p.stockQty}
                      </td>
                      <td className="py-1.5 text-right text-red-400/50 w-12">{p.lowStockAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-slate-800">
                    <th className="text-left px-3 py-3 w-8"></th>
                    <th className="text-left px-3 py-3">Produto</th>
                    <th className="text-left px-3 py-3">Variação</th>
                    <th className="text-right px-3 py-3">Estoque Total</th>
                    <th className="text-right px-3 py-3 hidden sm:table-cell">Est. Mínimo</th>
                    <th className="text-right px-3 py-3 hidden sm:table-cell">Lotes</th>
                  </tr>
                </thead>
                <tbody>
                  {groupBatches().map((group) => {
                    const expanded = expandedGroups.has(group.key);
                    const stockColorClass = stockColor(group.stockQty, group.lowStockAt);
                    const badge = stockBadge(group.stockQty, group.lowStockAt);
                    const productLabel = [
                      group.productName,
                      group.sku ? group.sku : null,
                      group.unit && group.unit !== 'UN' ? group.unit : null,
                    ].filter(Boolean).join(' · ');
                    const hasExpired = group.expiredCount > 0;
                    const hasExpiringSoon = group.expiringSoonCount > 0;
                    const hasLowStock = group.lowStockAt > 0 && group.stockQty < group.lowStockAt;
                    const hasMinStock = group.lowStockAt > 0 && group.stockQty === group.lowStockAt;

                    return (
                      <React.Fragment key={group.key}>
                        {/* Summary row */}
                        <tr
                          onClick={() => toggleGroup(group.key)}
                          className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer">
                          <td className="px-3 py-3">
                            {expanded
                              ? <ChevronDown size={16} className="text-slate-400" />
                              : <ChevronRight size={16} className="text-slate-500" />}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              {/* Expiry warning dot */}
                              {hasExpired && (
                                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title={`${group.expiredCount} lote(s) vencido(s)`} />
                              )}
                              {!hasExpired && hasExpiringSoon && (
                                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" title={`${group.expiringSoonCount} lote(s) vence(m) em até 7 dias`} />
                              )}
                              <span className="font-medium text-sm text-white">
                                {productLabel}
                              </span>
                              {badge}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-slate-400 text-sm">
                            {group.variationName || '—'}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-semibold text-sm">
                            {/* Stock level dot */}
                            {hasLowStock && (
                              <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5 align-middle" title="Estoque abaixo do mínimo" />
                            )}
                            {hasMinStock && (
                              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5 align-middle" title="Estoque no mínimo" />
                            )}
                            <span className={stockColorClass}>{group.stockQty}</span>
                          </td>
                          <td className="px-3 py-3 text-right text-slate-500 text-sm hidden sm:table-cell">
                            {group.lowStockAt > 0 ? group.lowStockAt : '—'}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-400 text-sm hidden sm:table-cell">
                            <span>{group.batches.length}</span>
                            {hasExpired && (
                              <span className="text-red-400 ml-1">({group.expiredCount} venc.)</span>
                            )}
                            {!hasExpired && hasExpiringSoon && (
                              <span className="text-amber-400 ml-1">({group.expiringSoonCount} vence)</span>
                            )}
                          </td>
                        </tr>

                        {/* Expanded: individual batches */}
                        {expanded && group.batches.map((b: any) => (
                          <tr key={b.id} className="border-b border-slate-800/30 bg-slate-950/50 hover:bg-slate-800/20 transition-colors">
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2" colSpan={2}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                                  {shortId(b.id)}
                                </span>
                                <span className="text-xs text-slate-500">
                                  Recebido {new Date(b.receivedAt).toLocaleDateString('pt-BR')}
                                </span>
                                {b.expiryDate && (
                                  <ExpiryBadge date={b.expiryDate} />
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-xs text-slate-300 font-mono">{b.remainingQty} / {b.quantity}</span>
                                <span className="text-[10px] text-slate-500">
                                  {formatCurrency(b.unitCost)} un.
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-slate-500 hidden sm:table-cell">
                              {formatCurrency(Number(b.remainingQty) * Number(b.unitCost))}
                            </td>
                            <td className="px-3 py-2"></td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {batchTotal > 50 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 bg-slate-900 text-slate-400 rounded-lg text-sm disabled:opacity-40">Anterior</button>
              <span className="text-slate-400 text-sm">Página {page} de {Math.ceil(batchTotal / 50)}</span>
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
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-slate-800">
                    <th className="text-left px-4 py-3">Data</th>
                    <th className="text-left px-4 py-3">Tipo</th>
                    <th className="text-left px-4 py-3">Produto</th>
                    <th className="text-right px-4 py-3">Qtd</th>
                    <th className="text-right px-4 py-3">Custo Un.</th>
                    <th className="text-right px-4 py-3">Custo Total</th>
                    <th className="text-left px-4 py-3">Motivo</th>
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
                        <td className="px-4 py-3 text-white">
                          {m.product?.name || '—'}
                          {m.variation?.name ? <span className="text-slate-500 text-xs ml-1">({m.variation.name})</span> : null}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono ${isOut ? 'text-red-400' : 'text-emerald-400'}`}>
                          {isOut ? '' : '+'}{m.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">{m.unitCost ? formatCurrency(m.unitCost) : '—'}</td>
                        <td className="px-4 py-3 text-right text-slate-400">{m.totalCost ? formatCurrency(m.totalCost) : '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-300 max-w-[150px] truncate">{m.reason || '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[150px] truncate">{m.notes || '—'}</td>
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
              <span className="text-slate-400 text-sm">Página {page} de {Math.ceil(movTotal / 50)}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 50 >= movTotal}
                className="px-3 py-1.5 bg-slate-900 text-slate-400 rounded-lg text-sm disabled:opacity-40">Próxima</button>
            </div>
          )}
        </>
      )}

      {/* Adjust Modal */}
      <Modal open={adjustOpen} onClose={() => setAdjustOpen(false)} title="Ajuste Manual de Estoque" size="sm" closeOnOverlayClick={false}>
        <div className="space-y-4">
          {/* Product search */}
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
                    <button key={p.id} onClick={() => selectProductForAdjust(p)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-600">
                      {p.name} — Estoque: {p.stockQty} {p.hasVariations ? `(${p.variations?.length || 0} variações)` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {adjustProduct && (
              <p className="text-xs text-emerald-400 mt-1">
                Produto selecionado: <strong>{adjustProduct.name}</strong> — Estoque atual: {adjustProduct.stockQty}
              </p>
            )}
          </div>

          {/* Variation selector — only if product has variations */}
          {adjustVariations.length > 0 && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Variação <span className="text-xs text-slate-500">(opcional)</span></label>
              <select
                value={adjustVariationId}
                onChange={(e) => setAdjustVariationId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
              >
                <option value="">Todas as variações</option>
                {adjustVariations.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — Estoque: {v.stockQty}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quantity */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Quantidade <span className="text-xs text-slate-500">(+ para entrada, - para saída)</span>
            </label>
            <input type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)}
              step="any" placeholder="Ex: 10 ou -5"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Motivo *</label>
            <select
              value={adjustReason}
              onChange={(e) => { setAdjustReason(e.target.value); if (e.target.value !== 'Outro') setAdjustReasonCustom(''); }}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
            >
              <option value="">Selecione o motivo...</option>
              {REASON_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {adjustReason === 'Outro' && (
              <input
                value={adjustReasonCustom}
                onChange={(e) => setAdjustReasonCustom(e.target.value)}
                placeholder="Descreva o motivo..."
                className="mt-2 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
              />
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Observação adicional</label>
            <input value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)}
              placeholder="Detalhes extras (opcional)..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setAdjustOpen(false)} className="px-4 py-2 text-slate-400 text-sm hover:text-white">Cancelar</button>
            <button onClick={handleAdjust}
              disabled={saving || !adjustProductId || !adjustQty || Number(adjustQty) === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 text-white ${
                !adjustQty || Number(adjustQty) === 0
                  ? 'bg-indigo-500 hover:bg-indigo-600'
                  : Number(adjustQty) > 0
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-red-500 hover:bg-red-600'
              }`}>
              {saving ? 'Salvando...' : 'Salvar'}
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
