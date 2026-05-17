'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Check, X, ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { VariationEditor, type VariationData } from '@/components/products/VariationEditor';
import api, { type VariationTemplate } from '@/lib/api';

const PURCHASE_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Rascunho', color: 'bg-slate-600' },
  CONFIRMED: { label: 'Confirmado', color: 'bg-blue-500' },
  RECEIVED: { label: 'Recebido', color: 'bg-emerald-500' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-500' },
};

interface PurchaseItemData {
  productId: string;
  productName: string;
  costPrice: number;
  operationalCost: number;
  taxRate: number;
  desiredMargin: number;
  salePrice: number;
  quantity: number;
  hasVariations: boolean;
  variations: VariationData[];
}

const emptyItem: PurchaseItemData = {
  productId: '',
  productName: '',
  costPrice: 0,
  operationalCost: 0,
  taxRate: 0,
  desiredMargin: 0,
  salePrice: 0,
  quantity: 1,
  hasVariations: false,
  variations: [],
};

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const show = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { toast, show } = useToast();

  // Create form
  const [formOpen, setFormOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [useOutroSupplier, setUseOutroSupplier] = useState(false);
  const [outroSupplierName, setOutroSupplierName] = useState('');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState('0');
  const [saving, setSaving] = useState(false);

  // Product
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemData[]>([]);
  const [currentItem, setCurrentItem] = useState<PurchaseItemData>({ ...emptyItem });
  const [currentTemplate, setCurrentTemplate] = useState<VariationTemplate | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);

  // Customer (optional)
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedCustomerName, setSelectedCustomerName] = useState('');

  const loadPurchases = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.purchases.list({ status: statusFilter || undefined, page });
      setPurchases(data.purchases);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar compras');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  const loadSuppliers = async (search?: string) => {
    try {
      const data = await api.suppliers.list({ search, active: true });
      return data.suppliers || [];
    } catch { return []; }
  };

  const searchProducts = async (q: string) => {
    setProductSearch(q);
    if (q.length < 1) { setProductResults([]); return; }
    try {
      const data = await api.products.list({ search: q });
      setProductResults(data.products || []);
    } catch { setProductResults([]); }
  };

  useEffect(() => { loadPurchases(); }, [loadPurchases]);

  const openCreate = async () => {
    setSelectedSupplier('');
    setUseOutroSupplier(false);
    setOutroSupplierName('');
    setPurchaseItems([]);
    setCurrentItem({ ...emptyItem });
    setCurrentTemplate(null);
    setNotes('');
    setDiscount('0');
    setProductSearch('');
    setProductResults([]);
    const sups = await loadSuppliers();
    setSuppliers(sups);
    setFormOpen(true);
  };

  const selectProduct = async (p: any) => {
    setCurrentItem({
      productId: p.id,
      productName: p.name,
      costPrice: Number(p.costPrice || 0),
      operationalCost: Number(p.operationalCost || 0),
      taxRate: Number(p.taxRate || 0),
      desiredMargin: 0,
      salePrice: Number(p.price || 0),
      quantity: 1,
      hasVariations: p.hasVariations || (p.variations?.length > 0),
      variations: [], // start blank — admin generates combinations
    });
    if (p.categoryId) {
      try {
        const cat = await api.categories.get(p.categoryId);
        setCurrentTemplate(cat.variationTemplate || null);
      } catch { setCurrentTemplate(null); }
    } else {
      setCurrentTemplate(null);
    }
    setProductSearch('');
    setProductResults([]);
  };

  // Bidirectional pricing: cost/ops/tax/margin → salePrice
  const calcSuggested = (item: PurchaseItemData) => {
    const cost = item.costPrice || 0;
    const ops = item.operationalCost || 0;
    const tax = item.taxRate || 0;
    const margin = item.desiredMargin || 0;
    const denom = 1 - tax / 100 - margin / 100;
    if (cost <= 0 || margin <= 0 || denom <= 0) return null;
    return Math.round((cost + ops) / denom * 100) / 100;
  };

  // Bidirectional: salePrice → margin
  const calcMarginFromPrice = (item: PurchaseItemData) => {
    const cost = item.costPrice || 0;
    const ops = item.operationalCost || 0;
    const tax = item.taxRate || 0;
    const price = item.salePrice || 0;
    if (cost <= 0 || price <= 0) return null;
    const margin = (1 - tax / 100 - (cost + ops) / price) * 100;
    return Math.round(margin * 100) / 100;
  };

  const /** total quantity from variations or direct input */
  effectiveQty = currentItem.hasVariations
    ? currentItem.variations.reduce((sum, v) => sum + (v.stockQty || 0), 0)
    : currentItem.quantity;

  const addCurrentItem = () => {
    if (!currentItem.productId) { show('Selecione um produto', 'error'); return; }
    if (effectiveQty <= 0) { show('Quantidade deve ser maior que zero', 'error'); return; }
    setPurchaseItems([...purchaseItems, {
      ...currentItem,
      quantity: effectiveQty,
    }]);
    setCurrentItem({ ...emptyItem });
    setCurrentTemplate(null);
    setProductSearch('');
    setProductResults([]);
  };

  const removeItem = (idx: number) => setPurchaseItems(purchaseItems.filter((_, i) => i !== idx));

  const itemsSubtotal = purchaseItems.reduce((sum, i) => sum + i.costPrice * i.quantity, 0);
  const itemsTotal = itemsSubtotal - (Number(discount) || 0);

  const handleCreate = async () => {
    if (purchaseItems.length === 0) return;
    if (!selectedSupplier && !(useOutroSupplier && outroSupplierName.trim())) {
      show('Selecione ou informe o fornecedor', 'error'); return;
    }
    setSaving(true);
    try {
      // Resolve supplier ID
      let supplierId = selectedSupplier;
      if (useOutroSupplier && outroSupplierName.trim()) {
        const newSup = await api.suppliers.create({ name: outroSupplierName.trim() });
        supplierId = newSup.id;
      }

      // Update products + create variations if needed
      for (const item of purchaseItems) {
        await api.products.update(item.productId, {
          costPrice: item.costPrice,
          operationalCost: item.operationalCost,
          taxRate: item.taxRate,
          price: item.salePrice || calcSuggested(item) || 0,
          hasVariations: item.hasVariations,
        });
        // Create/update variations
        if (item.hasVariations && item.variations.length > 0) {
          for (const v of item.variations) {
            if (v.id) {
              // update existing variation stock
              // (not needed for purchase context — stock added on receive)
            } else {
              await api.products.addVariation(item.productId, {
                name: v.name,
                priceModifier: v.priceModifier || 0,
                stockQty: 0,
                sku: v.sku,
                barcode: v.barcode,
              });
            }
          }
        }
      }

      // Create purchase
      await api.purchases.create({
        supplierId,
        discount: Number(discount) || 0,
        notes: notes || undefined,
        items: purchaseItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitCost: item.costPrice,
          total: item.costPrice * item.quantity,
        })),
      });

      show('Compra criada! Ao receber, o estoque será atualizado.');
      setFormOpen(false);
      loadPurchases();
    } catch (err: any) {
      show(err.message || 'Erro ao criar compra', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReceive = async (id: string) => {
    if (!confirm('Confirmar recebimento? Os lotes PEPS serão criados e o estoque atualizado.')) return;
    try {
      await api.purchases.receive(id);
      show('Compra recebida! Lotes PEPS criados e estoque atualizado.');
      loadPurchases();
    } catch (err: any) {
      show(err.message || 'Erro ao receber', 'error');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancelar esta compra?')) return;
    try { await api.purchases.cancel(id); show('Compra cancelada!'); loadPurchases(); }
    catch (err: any) { show(err.message || 'Erro ao cancelar', 'error'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta compra?')) return;
    try { await api.purchases.delete(id); show('Compra excluída!'); loadPurchases(); }
    catch (err: any) { show(err.message || 'Erro ao excluir', 'error'); }
  };

  const toggleExpand = (id: string) => setExpanded(expanded === id ? null : id);

  const currentItemTotal = currentItem.costPrice * effectiveQty;

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Compras</h1>
          <p className="text-slate-400 text-sm mt-1">{total} compras registradas</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium text-sm transition-colors">
          <Plus size={18} /> Nova Compra
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {['', 'DRAFT', 'RECEIVED', 'CANCELLED'].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === s ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
              }`}>
              {s ? PURCHASE_STATUS[s].label : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-slate-800 rounded w-1/3 mb-3" />
              <div className="h-4 bg-slate-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400 mb-3">{error}</p>
          <button onClick={loadPurchases} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm">Tentar novamente</button>
        </div>
      ) : purchases.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingBag size={48} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 mb-3">Nenhuma compra encontrada</p>
          <button onClick={openCreate} className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm">Criar primeira compra</button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {purchases.map((p: any) => (
              <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => toggleExpand(p.id)}>
                  <div className={`w-2 h-2 rounded-full ${PURCHASE_STATUS[p.status]?.color || 'bg-slate-600'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-semibold">#{p.orderNumber}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${PURCHASE_STATUS[p.status]?.color || 'bg-slate-600'} text-white`}>
                        {PURCHASE_STATUS[p.status]?.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">{p.supplier?.name || '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-white font-semibold">R$ {Number(p.total).toFixed(2)}</p>
                    <p className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {p.status === 'DRAFT' && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); handleReceive(p.id); }}
                          className="p-1.5 text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors" title="Receber">
                          <Check size={18} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleCancel(p.id); }}
                          className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Cancelar">
                          <X size={18} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors" title="Excluir">
                          <X size={16} />
                        </button>
                      </>
                    )}
                    {expanded === p.id ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                  </div>
                </div>

                {expanded === p.id && p.items && (
                  <div className="border-t border-slate-800 px-4 py-3 bg-slate-950/50">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-500 text-xs">
                          <th className="text-left py-1">Produto</th>
                          <th className="text-right py-1">Qtd</th>
                          <th className="text-right py-1">Custo Un.</th>
                          <th className="text-right py-1">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.items.map((item: any) => (
                          <tr key={item.id} className="border-t border-slate-800/50">
                            <td className="py-1.5 text-white">{item.productName}</td>
                            <td className="py-1.5 text-right text-slate-400">{item.quantity}</td>
                            <td className="py-1.5 text-right text-slate-400">R$ {Number(item.unitCost).toFixed(2)}</td>
                            <td className="py-1.5 text-right text-white">R$ {Number(item.total).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-700">
                          <td colSpan={3} className="py-2 text-right text-slate-400">Total</td>
                          <td className="py-2 text-right text-white font-semibold">R$ {Number(p.total).toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                    {p.notes && <p className="text-xs text-slate-500 mt-2">Obs: {p.notes}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {total > 20 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 bg-slate-900 text-slate-400 rounded-lg text-sm disabled:opacity-40">Anterior</button>
              <span className="text-slate-400 text-sm">Pagina {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}
                className="px-3 py-1.5 bg-slate-900 text-slate-400 rounded-lg text-sm disabled:opacity-40">Proxima</button>
            </div>
          )}
        </>
      )}

      {/* ========== CREATE MODAL (simplified) ========== */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Nova Compra" size="lg">
        <div className="space-y-5">
          {/* ── 1. Supplier ── */}
          <div className="bg-slate-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <ShoppingBag size={16} className="text-indigo-400" /> Fornecedor
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {!useOutroSupplier ? (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Fornecedor *</label>
                  <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none">
                    <option value="">Selecionar...</option>
                    {suppliers.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nome do Fornecedor *</label>
                  <input value={outroSupplierName} onChange={(e) => setOutroSupplierName(e.target.value)}
                    placeholder="Digite o nome..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
                </div>
              )}
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input type="checkbox" checked={useOutroSupplier}
                    onChange={(e) => { setUseOutroSupplier(e.target.checked); setSelectedSupplier(''); }}
                    className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0" />
                  <span className="text-sm text-slate-400">Outros</span>
                </label>
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">Desconto (R$)</label>
                  <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)}
                    min="0" step="0.01"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
                </div>
              </div>
            </div>
          </div>

          {/* ── 2. Product ── */}
          <div className="bg-slate-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Produto</h3>

            {/* Product search (existing only) */}
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={productSearch}
                onChange={(e) => searchProducts(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
              {productResults.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-slate-700 border border-slate-600 rounded-lg max-h-40 overflow-y-auto z-20">
                  {productResults.map((p: any) => (
                    <button key={p.id} onClick={() => selectProduct(p)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-600 flex items-center justify-between">
                      <span>{p.name}</span>
                      <span className="text-xs text-slate-500">R$ {Number(p.price).toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected product name */}
            {currentItem.productId ? (
              <p className="text-white text-sm font-medium mb-3">✓ {currentItem.productName}</p>
            ) : (
              <p className="text-slate-600 text-sm mb-3">Nenhum produto selecionado</p>
            )}

            {/* ── 3. Pricing ── */}
            <div className="bg-slate-900 rounded-lg p-3 mb-3">
              <p className="text-xs text-slate-500 mb-2">Precificacao</p>
              <div className="grid grid-cols-5 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Custo Unit. (R$)</label>
                  <input type="number" value={currentItem.costPrice || ''} onChange={(e) => {
                    const updated = { ...currentItem, costPrice: Number(e.target.value) };
                    const sug = calcSuggested(updated);
                    if (sug) updated.salePrice = sug;
                    setCurrentItem(updated);
                  }}
                    min="0" step="0.01" placeholder="0,00"
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm text-center focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Custo Oper. (R$)</label>
                  <input type="number" value={currentItem.operationalCost || ''} onChange={(e) => {
                    const updated = { ...currentItem, operationalCost: Number(e.target.value) };
                    const sug = calcSuggested(updated);
                    if (sug) updated.salePrice = sug;
                    setCurrentItem(updated);
                  }}
                    min="0" step="0.01" placeholder="0,00"
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm text-center focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Imposto (%)</label>
                  <input type="number" value={currentItem.taxRate || ''} onChange={(e) => {
                    const updated = { ...currentItem, taxRate: Number(e.target.value) };
                    const sug = calcSuggested(updated);
                    if (sug) updated.salePrice = sug;
                    setCurrentItem(updated);
                  }}
                    min="0" max="100" step="0.01" placeholder="0"
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm text-center focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Margem Desej. (%)</label>
                  <input type="number" value={currentItem.desiredMargin || ''} onChange={(e) => {
                    const updated = { ...currentItem, desiredMargin: Number(e.target.value) };
                    const sug = calcSuggested(updated);
                    if (sug) updated.salePrice = sug;
                    setCurrentItem(updated);
                  }}
                    min="0" max="100" step="0.1" placeholder="0"
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm text-center focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Preco Sugerido (R$)</label>
                  <input type="number" value={currentItem.salePrice || ''} onChange={(e) => {
                    const updated = { ...currentItem, salePrice: Number(e.target.value) };
                    const margin = calcMarginFromPrice(updated);
                    if (margin !== null && margin >= 0) updated.desiredMargin = margin;
                    setCurrentItem(updated);
                  }}
                    min="0" step="0.01" placeholder="0,00"
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm text-center focus:border-indigo-500 outline-none" />
                </div>
              </div>
            </div>

            {/* ── 4. Variations ── */}
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={currentItem.hasVariations}
                  onChange={(e) => setCurrentItem({ ...currentItem, hasVariations: e.target.checked, variations: [] })}
                  className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0" />
                <span className="text-sm text-slate-400">Possui variacoes (tamanho, cor, etc.)</span>
              </label>
            </div>

            {currentItem.hasVariations ? (
              <div className="mb-3 bg-slate-900 rounded-lg p-3">
                <VariationEditor
                  template={currentTemplate}
                  variations={currentItem.variations}
                  onChange={(vars) => setCurrentItem({ ...currentItem, variations: vars })}
                  purchaseMode
                />
                <div className="mt-2 pt-2 border-t border-slate-700 flex justify-between items-center">
                  <span className="text-xs text-slate-400">
                    Qtd total comprada: <span className="text-white font-semibold">{effectiveQty}</span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="mb-3">
                <label className="block text-xs text-slate-400 mb-1">Qtd Comprada</label>
                <input type="number" value={currentItem.quantity || ''} onChange={(e) => setCurrentItem({ ...currentItem, quantity: Number(e.target.value) })}
                  min="0.001" step="any" placeholder="1"
                  className="w-32 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm text-center focus:border-indigo-500 outline-none" />
              </div>
            )}

            {/* Add item button */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-700">
              <span className="text-xs text-slate-500">
                Total deste item: <span className="text-white font-semibold">R$ {currentItemTotal.toFixed(2)}</span>
                {currentItem.salePrice > 0 && (
                  <span className="ml-2 text-emerald-400">| Venda: R$ {currentItem.salePrice.toFixed(2)}</span>
                )}
              </span>
              <button onClick={addCurrentItem}
                disabled={!currentItem.productId || effectiveQty <= 0}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                <Plus size={14} className="inline mr-1" /> Adicionar a Compra
              </button>
            </div>
          </div>

          {/* ── 5. Items list ── */}
          {purchaseItems.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Produtos na Compra ({purchaseItems.length})</h3>
              <div className="bg-slate-800 rounded-lg divide-y divide-slate-700 max-h-48 overflow-y-auto">
                {purchaseItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.productName}</p>
                      <p className="text-xs text-slate-500">
                        Custo R$ {item.costPrice.toFixed(2)}
                        {item.hasVariations && (
                          <span className="ml-2 text-indigo-400">{item.variations.length} variacoes</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm text-white">{item.quantity}</p>
                      <p className="text-xs text-slate-500">R$ {(item.costPrice * item.quantity).toFixed(2)}</p>
                    </div>
                    <button onClick={() => removeItem(idx)} className="p-1 text-slate-500 hover:text-red-400 ml-1">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-3 text-sm">
                <span className="text-slate-400">Subtotal</span>
                <span className="text-slate-400">R$ {itemsSubtotal.toFixed(2)}</span>
              </div>
              {Number(discount) > 0 && (
                <div className="flex justify-between mt-1 text-sm">
                  <span className="text-slate-400">Desconto</span>
                  <span className="text-red-400">- R$ {Number(discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between mt-1 text-sm font-semibold">
                <span className="text-white">Total</span>
                <span className="text-white">R$ {itemsTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* ── 6. Notes ── */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Observacoes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Notas sobre esta compra..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none resize-none" />
          </div>

          {/* ── Actions ── */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
            <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-slate-400 text-sm hover:text-white">Cancelar</button>
            <button onClick={handleCreate}
              disabled={saving || (!selectedSupplier && !(useOutroSupplier && outroSupplierName.trim())) || purchaseItems.length === 0}
              className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Criando...' : `Criar Compra (R$ ${itemsTotal.toFixed(2)})`}
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
