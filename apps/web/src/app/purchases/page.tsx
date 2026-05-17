'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Truck, Package, Check, X, ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import api from '@/lib/api';

const PURCHASE_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Rascunho', color: 'bg-slate-600' },
  CONFIRMED: { label: 'Confirmado', color: 'bg-blue-500' },
  RECEIVED: { label: 'Recebido', color: 'bg-emerald-500' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-500' },
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
  const [products, setProducts] = useState<any[]>([]);
  const [items, setItems] = useState<{ productId: string; productName: string; quantity: string; unitCost: string }[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);

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
    setItems([]);
    setNotes('');
    setProductSearch('');
    setProductResults([]);
    const sups = await loadSuppliers();
    setSuppliers(sups);
    setFormOpen(true);
  };

  const addItem = (p: any) => {
    if (items.find(i => i.productId === p.id)) return;
    setItems([...items, { productId: p.id, productName: p.name, quantity: '1', unitCost: String(p.costPrice || 0) }]);
    setProductSearch('');
    setProductResults([]);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: string, value: string) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    setItems(updated);
  };

  const itemsTotal = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0);

  const handleCreate = async () => {
    if (!selectedSupplier || items.length === 0) return;
    setSaving(true);
    try {
      await api.purchases.create({
        supplierId: selectedSupplier,
        items: items.map(i => ({
          productId: i.productId,
          productName: i.productName,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost),
          total: (Number(i.quantity) || 0) * (Number(i.unitCost) || 0),
        })),
        notes: notes || undefined,
      });
      show('Compra criada!');
      setFormOpen(false);
      loadPurchases();
    } catch (err: any) {
      show(err.message || 'Erro ao criar compra', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReceive = async (id: string) => {
    if (!confirm('Confirmar recebimento desta compra? Isso criará lotes de estoque (PEPS).')) return;
    try {
      await api.purchases.receive(id);
      show('Compra recebida! Lotes PEPS criados.');
      loadPurchases();
    } catch (err: any) {
      show(err.message || 'Erro ao receber', 'error');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancelar esta compra?')) return;
    try {
      await api.purchases.cancel(id);
      show('Compra cancelada!');
      loadPurchases();
    } catch (err: any) {
      show(err.message || 'Erro ao cancelar', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta compra?')) return;
    try {
      await api.purchases.delete(id);
      show('Compra excluída!');
      loadPurchases();
    } catch (err: any) {
      show(err.message || 'Erro ao excluir', 'error');
    }
  };

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
  };

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
                      </>
                    )}
                    {p.status === 'DRAFT' && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors" title="Excluir">
                        <X size={16} />
                      </button>
                    )}
                    {expanded === p.id ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                  </div>
                </div>

                {/* Expanded items */}
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

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => setPage(po => Math.max(1, po - 1))} disabled={page === 1}
                className="px-3 py-1.5 bg-slate-900 text-slate-400 rounded-lg text-sm disabled:opacity-40">Anterior</button>
              <span className="text-slate-400 text-sm">Página {page}</span>
              <button onClick={() => setPage(po => po + 1)} disabled={page * 20 >= total}
                className="px-3 py-1.5 bg-slate-900 text-slate-400 rounded-lg text-sm disabled:opacity-40">Próxima</button>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Nova Compra" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Fornecedor *</label>
            <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none">
              <option value="">Selecionar...</option>
              {suppliers.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Item search */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Adicionar Produtos</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={productSearch} onChange={(e) => searchProducts(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
            </div>
            {productResults.length > 0 && (
              <div className="mt-1 bg-slate-800 border border-slate-700 rounded-lg max-h-40 overflow-y-auto">
                {productResults.map((p: any) => (
                  <button key={p.id} onClick={() => addItem(p)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
                    {p.name} — R$ {Number(p.costPrice || p.price).toFixed(2)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Items list */}
          {items.length > 0 && (
            <div className="bg-slate-800 rounded-lg divide-y divide-slate-700">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2">
                  <span className="flex-1 text-sm text-white truncate">{item.productName}</span>
                  <input type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                    min="0.001" step="any" placeholder="Qtd"
                    className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm text-center" />
                  <input type="number" value={item.unitCost} onChange={(e) => updateItem(idx, 'unitCost', e.target.value)}
                    min="0" step="0.01" placeholder="Custo"
                    className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm text-center" />
                  <span className="text-sm text-slate-400 w-20 text-right">
                    R$ {((Number(item.quantity) || 0) * (Number(item.unitCost) || 0)).toFixed(2)}
                  </span>
                  <button onClick={() => removeItem(idx)} className="p-1 text-slate-500 hover:text-red-400">
                    <X size={14} />
                  </button>
                </div>
              ))}
              <div className="px-3 py-2 flex justify-between text-sm">
                <span className="text-slate-400">{items.length} itens</span>
                <span className="text-white font-semibold">Total: R$ {itemsTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-400 mb-1">Observações</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-slate-400 text-sm hover:text-white">Cancelar</button>
            <button onClick={handleCreate} disabled={saving || !selectedSupplier || items.length === 0}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
              {saving ? 'Criando...' : 'Criar Compra'}
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
