'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, X, ShoppingCart, Trash2, CreditCard, Banknote, User, Eye } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import api from '@/lib/api';

const PAYMENT_METHODS = [
  { id: 'Dinheiro', label: 'Dinheiro', icon: Banknote, color: 'bg-emerald-500' },
  { id: 'Pix', label: 'Pix', icon: CreditCard, color: 'bg-cyan-500' },
  { id: 'Debito', label: 'Débito', icon: CreditCard, color: 'bg-blue-500' },
  { id: 'Credito', label: 'Crédito', icon: CreditCard, color: 'bg-purple-500' },
  { id: 'Fiado', label: 'Fiado', icon: User, color: 'bg-amber-500', paymentStatus: 'PENDING' },
];

interface CartItem {
  productId?: string;
  variationId?: string;
  variationName?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const show = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [pendingRevenue, setPendingRevenue] = useState(0);
  const { toast, show } = useToast();
  const searchTimer = useRef<NodeJS.Timeout>(undefined);
  const [search, setSearch] = useState('');

  // Sale modal
  const [saleOpen, setSaleOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [walkInName, setWalkInName] = useState('');
  const [useWalkIn, setUseWalkIn] = useState(false);

  // Product search
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedVariation, setSelectedVariation] = useState<any>(null);
  const [quantity, setQuantity] = useState('1');
  const [showVariationPicker, setShowVariationPicker] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState('0');
  const [selectedPayment, setSelectedPayment] = useState(PAYMENT_METHODS[0]);
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<any>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = { page };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const data = await api.orders.list(params);
      setOrders(data.orders);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar vendas');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, search]);

  const loadTodayRevenue = async () => {
    try {
      const data = await api.orders.todaySummary();
      setTodayRevenue(Number(data.totalSales || 0));
      setPendingRevenue(Number(data.pendingAmount || 0));
    } catch { /* ignore */ }
  };

  useEffect(() => { loadOrders(); loadTodayRevenue(); }, [loadOrders]);

  const searchCustomers = async (q: string) => {
    setCustomerSearch(q);
    if (q.length < 1) { setCustomerResults([]); return; }
    try {
      const data = await api.customers.list({ search: q });
      setCustomerResults(data.customers || []);
    } catch { setCustomerResults([]); }
  };

  const selectCustomer = (c: any) => {
    setSelectedCustomer(c);
    setCustomerSearch(c.name);
    setCustomerResults([]);
    setUseWalkIn(false);
  };

  const searchProducts = async (q: string) => {
    setProductSearch(q);
    if (q.length < 1) { setProductResults([]); return; }
    try {
      const data = await api.products.list({ search: q, active: true });
      setProductResults(data.products || []);
    } catch { setProductResults([]); }
  };

  const selectProduct = (p: any) => {
    setSelectedProduct(p);
    setSelectedVariation(null);
    setProductSearch(p.name);
    setProductResults([]);
    setQuantity('1');
    if (p.variations?.length > 0) {
      setShowVariationPicker(true);
    }
  };

  // Available stock for currently selected product/variation
  const getAvailableStock = (): number => {
    if (!selectedProduct) return 0;
    if (selectedProduct.variations?.length > 0 && selectedVariation) {
      return Number(selectedVariation.stockQty || 0);
    }
    return Number(selectedProduct.stockQty || 0);
  };

  // How many of this product/variation are already in the cart
  const getCartQty = (): number => {
    return cart
      .filter(c =>
        c.productId === selectedProduct?.id &&
        c.variationId === (selectedVariation?.id || undefined)
      )
      .reduce((sum, c) => sum + c.quantity, 0);
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    const qty = parseFloat(quantity);
    if (qty <= 0) { show('Quantidade inválida', 'error'); return; }

    // Validate stock
    const available = getAvailableStock();
    const alreadyInCart = getCartQty();
    if (qty + alreadyInCart > available) {
      show(`Estoque insuficiente. Disponível: ${available - alreadyInCart}`, 'error');
      return;
    }

    const price = Number(selectedProduct.price || 0);
    const itemName = selectedVariation
      ? `${selectedProduct.name} - ${selectedVariation.name}`
      : selectedProduct.name;

    // Check if already in cart
    const existingIdx = cart.findIndex(c =>
      c.productId === selectedProduct.id &&
      c.variationId === (selectedVariation?.id || undefined)
    );
    if (existingIdx >= 0) {
      const updated = [...cart];
      updated[existingIdx].quantity += qty;
      updated[existingIdx].total = updated[existingIdx].quantity * price;
      setCart(updated);
    } else {
      setCart([...cart, {
        productId: selectedProduct.id,
        variationId: selectedVariation?.id || undefined,
        variationName: selectedVariation?.name,
        productName: itemName,
        quantity: qty,
        unitPrice: price,
        total: qty * price,
      }]);
    }
    // Reset selection
    setSelectedProduct(null);
    setSelectedVariation(null);
    setProductSearch('');
    setQuantity('1');
    setShowVariationPicker(false);
  };

  const removeFromCart = (idx: number) => setCart(cart.filter((_, i) => i !== idx));
  const subtotal = cart.reduce((sum, i) => sum + i.total, 0);
  const totalWithDiscount = subtotal - (parseFloat(discount) || 0);

  const openSale = () => {
    setCustomerSearch('');
    setCustomerResults([]);
    setSelectedCustomer(null);
    setWalkInName('');
    setUseWalkIn(false);
    setProductSearch('');
    setProductResults([]);
    setSelectedProduct(null);
    setSelectedVariation(null);
    setQuantity('1');
    setShowVariationPicker(false);
    setCart([]);
    setDiscount('0');
    setSelectedPayment(PAYMENT_METHODS[0]);
    setDueDate('');
    setSaleOpen(true);
  };

  const handleCreateSale = async () => {
    if (cart.length === 0) { show('Adicione produtos', 'error'); return; }
    if (!selectedCustomer?.id && !(useWalkIn && walkInName.trim())) {
      show('Selecione ou informe o cliente', 'error'); return;
    }
    setSaving(true);
    try {
      await api.orders.create({
        customerId: selectedCustomer?.id || undefined,
        customerName: useWalkIn && walkInName.trim() ? walkInName.trim() : undefined,
        items: cart.map(item => ({
          productId: item.productId,
          variationId: item.variationId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        subtotal,
        discount: parseFloat(discount) || 0,
        total: totalWithDiscount,
        paymentMethod: selectedPayment.id,
        paymentStatus: selectedPayment.paymentStatus || 'PAID',
        dueDate: selectedPayment.paymentStatus === 'PENDING' && dueDate ? dueDate : undefined,
      });

      show('Venda realizada!');
      setSaleOpen(false);
      loadOrders();
      loadTodayRevenue();
    } catch (err: any) {
      show(err.message || 'Erro ao criar venda', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancelar esta venda? O estoque será estornado.')) return;
    try {
      await api.orders.cancel(id);
      show('Venda cancelada!');
      loadOrders();
      loadTodayRevenue();
    } catch (err: any) {
      show(err.message || 'Erro ao cancelar', 'error');
    }
  };

  const handlePay = async (id: string) => {
    if (!confirm('Confirmar recebimento do pagamento?')) return;
    try {
      const result = await api.orders.pay(id);
      show(result.message || 'Pagamento recebido!');
      loadOrders();
      loadTodayRevenue();
      if (detailOpen && detailOrder?.id === id) setDetailOpen(false);
    } catch (err: any) {
      show(err.message || 'Erro ao receber pagamento', 'error');
    }
  };

  const openDetail = async (id: string) => {
    try {
      const data = await api.orders.list({ search: id });
      const order = data.orders?.[0] || null;
      if (order) { setDetailOrder(order); setDetailOpen(true); }
    } catch { show('Erro ao carregar detalhes', 'error'); }
  };

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Vendas</h1>
          <p className="text-slate-400 text-sm mt-0.5">{total} vendas registradas</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingRevenue > 0 && (
            <div className="bg-slate-900 border border-amber-500/30 rounded-lg px-3 py-2 text-right">
              <p className="text-[10px] text-amber-400">Fiado Pendente</p>
              <p className="text-lg font-bold text-amber-400">R$ {pendingRevenue.toFixed(2)}</p>
            </div>
          )}
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-right">
            <p className="text-[10px] text-slate-400">Faturamento Hoje</p>
            <p className="text-lg font-bold text-emerald-400">R$ {todayRevenue.toFixed(2)}</p>
          </div>
          <button onClick={openSale}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium text-sm transition-colors">
            <Plus size={16} /> Nova Venda
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 self-start">
          {[
            { id: '', label: 'Todos' },
            { id: 'PAID', label: 'Pagos' },
            { id: 'PENDING', label: 'Pendentes' },
            { id: 'CANCELLED', label: 'Cancelados' },
          ].map(s => (
            <button key={s.id} onClick={() => { setStatusFilter(s.id); setPage(1); }}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === s.id ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); clearTimeout(searchTimer.current); searchTimer.current = setTimeout(() => { setPage(1); }, 300); }}
            placeholder="Buscar venda..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-sm placeholder:text-slate-500 focus:border-indigo-500 outline-none" />
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="space-y-2">
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
          <button onClick={loadOrders} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm">Tentar novamente</button>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart size={48} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 mb-3">Nenhuma venda encontrada</p>
          <button onClick={openSale} className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm">Criar primeira venda</button>
        </div>
      ) : (
        <>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full min-w-[700px] text-xs">
              <thead>
                <tr className="text-slate-500 text-[11px] border-b border-slate-800">
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Cliente</th>
                  <th className="text-center px-3 py-2 hidden md:table-cell">Itens</th>
                  <th className="text-right px-3 py-2 hidden sm:table-cell">Subtotal</th>
                  <th className="text-right px-3 py-2 hidden sm:table-cell">Desc.</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-center px-3 py-2 hidden md:table-cell">Pagamento</th>
                  <th className="text-center px-3 py-2">Status</th>
                  <th className="text-center px-3 py-2 hidden lg:table-cell">Vencimento</th>
                  <th className="text-right px-3 py-2 hidden lg:table-cell">Data</th>
                  <th className="text-center px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o: any) => (
                  <tr key={o.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-3 py-2 text-indigo-400 font-mono text-sm font-semibold">#{o.orderNumber}</td>
                    <td className="px-3 py-2 text-white text-sm">
                        {o.customer?.name || o.customerName ? (
                          <span>
                            {o.customer?.name || o.customerName}
                            {!o.customer?.id && o.customerName && (
                              <span className="ml-1.5 text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">Avulso</span>
                            )}
                          </span>
                        ) : '—'}
                      </td>
                    <td className="px-3 py-2 text-center text-slate-400 text-sm hidden md:table-cell">{o.items?.length || 0}</td>
                    <td className="px-3 py-2 text-right text-slate-400 hidden sm:table-cell">R$ {Number(o.subtotal).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-red-400 hidden sm:table-cell">{Number(o.discount) > 0 ? `R$ ${Number(o.discount).toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2 text-right text-white font-semibold">R$ {Number(o.total).toFixed(2)}</td>
                    <td className="px-3 py-2 text-center hidden md:table-cell">
                      <span className="text-xs bg-slate-800 rounded-md px-2 py-1 text-white">{o.paymentMethod}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        o.paymentStatus === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' :
                        o.paymentStatus === 'PENDING' ? (o.dueDate && new Date(o.dueDate) < new Date() ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400') :
                        o.paymentStatus === 'PARTIAL' ? 'bg-blue-500/20 text-blue-400' :
                        o.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {o.paymentStatus === 'PAID' ? 'Pago' :
                         o.paymentStatus === 'PENDING' ? (o.dueDate && new Date(o.dueDate) < new Date() ? 'Vencido' : 'Pendente') :
                         o.paymentStatus === 'PARTIAL' ? 'Parcial' :
                         o.status === 'CANCELLED' ? 'Cancelado' : o.paymentStatus || o.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-xs hidden lg:table-cell">
                      {o.dueDate ? (
                        <span className={new Date(o.dueDate) < new Date() ? 'text-red-400' : 'text-amber-400'}>
                          {new Date(o.dueDate).toLocaleDateString('pt-BR')}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-slate-500 hidden lg:table-cell">
                      {new Date(o.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-end gap-1">
                        {o.paymentStatus === 'PENDING' && o.status !== 'CANCELLED' && (
                          <button onClick={() => handlePay(o.id)}
                            className="p-1.5 text-amber-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Receber pagamento">
                            <Banknote size={16} />
                          </button>
                        )}
                        <button onClick={() => openDetail(o.id)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors" title="Ver">
                          <Eye size={16} />
                        </button>
                        {o.status !== 'CANCELLED' && (
                          <button onClick={() => handleCancel(o.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors" title="Cancelar">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > 20 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 bg-slate-900 text-slate-400 rounded-lg text-sm disabled:opacity-40">Anterior</button>
              <span className="text-slate-400 text-sm">Página {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}
                className="px-3 py-1.5 bg-slate-900 text-slate-400 rounded-lg text-sm disabled:opacity-40">Próxima</button>
            </div>
          )}
        </>
      )}

      {/* ========== SALE MODAL ========== */}
      <Modal open={saleOpen} onClose={() => setSaleOpen(false)} title="Nova Venda" size="lg">
        <div className="space-y-3">
          {/* ── Customer ── */}
          <div className="bg-slate-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Cliente</h3>
            {useWalkIn ? (
              <div className="flex items-center gap-2">
                <input value={walkInName} onChange={(e) => setWalkInName(e.target.value)}
                  placeholder="Nome do cliente..."
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
                <button onClick={() => setUseWalkIn(false)}
                  className="text-xs text-indigo-400 hover:text-indigo-300">Usar cadastrado</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={customerSearch} onChange={(e) => searchCustomers(e.target.value)}
                    placeholder="Buscar cliente cadastrado..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
                  {customerResults.length > 0 && (
                    <div className="absolute top-full mt-1 w-full bg-slate-700 border border-slate-600 rounded-lg max-h-40 overflow-y-auto z-20">
                      {customerResults.map((c: any) => (
                        <button key={c.id} onClick={() => selectCustomer(c)}
                          className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-600 flex justify-between">
                          <span>{c.name}</span>
                          <span className="text-xs text-slate-500">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => { setUseWalkIn(true); setSelectedCustomer(null); }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 whitespace-nowrap">Nome avulso</button>
              </div>
            )}
            {selectedCustomer && !useWalkIn && (
              <p className="text-xs text-emerald-400 mt-1">✓ {selectedCustomer.name}</p>
            )}
          </div>

          {/* ── Product ── */}
          <div className="bg-slate-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Produto</h3>
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={productSearch} onChange={(e) => searchProducts(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
              {productResults.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-slate-700 border border-slate-600 rounded-lg max-h-48 overflow-y-auto z-20">
                  {productResults.map((p: any) => (
                    <button key={p.id} onClick={() => selectProduct(p)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-600 flex justify-between">
                      <span>{p.name}</span>
                      <span className="text-xs text-slate-500">R$ {Number(p.price).toFixed(2)} — Est: {Number(p.stockQty)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected product */}
            {selectedProduct && (
              <div className="bg-slate-900 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white text-sm font-medium">{selectedProduct.name}</p>
                  <p className="text-emerald-400 text-sm font-semibold">R$ {Number(selectedProduct.price).toFixed(2)}</p>
                </div>

                {/* Variation picker */}
                {selectedProduct.variations?.length > 0 && (
                  <div className="mb-2">
                    <label className="block text-xs text-slate-400 mb-1">Variação</label>
                    <div className="flex flex-wrap gap-1">
                      {selectedProduct.variations.map((v: any) => {
                        const vStock = Number(v.stockQty || 0);
                        const outOfStock = vStock <= 0;
                        return (
                          <button key={v.id}
                            onClick={() => !outOfStock && setSelectedVariation(v)}
                            disabled={outOfStock}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                              selectedVariation?.id === v.id
                                ? 'bg-indigo-500 text-white'
                                : outOfStock
                                  ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed line-through'
                                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                            }`}>
                            {v.name}{v.priceModifier > 0 ? ` (+R$${Number(v.priceModifier).toFixed(2)})` : ''} — Est: {vStock}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div className="flex items-center gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Qtd</label>
                    <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                      min="0.001" step="any"
                      className="w-24 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm text-center focus:border-indigo-500 outline-none" />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Disp: {getAvailableStock() - getCartQty()}
                    </p>
                  </div>
                  <button onClick={addToCart}
                    disabled={getAvailableStock() <= 0}
                    className="mt-4 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
                    <Plus size={14} className="inline mr-1" /> Adicionar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Cart ── */}
          {cart.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Carrinho ({cart.length})</h3>
              <div className="bg-slate-800 rounded-lg divide-y divide-slate-700 max-h-52 overflow-y-auto">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{item.productName}</p>
                      <p className="text-xs text-slate-500">R$ {item.unitPrice.toFixed(2)} x {item.quantity}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm text-white font-medium">R$ {item.total.toFixed(2)}</p>
                    </div>
                    <button onClick={() => removeFromCart(idx)} className="p-1 text-slate-500 hover:text-red-400">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 mt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Subtotal</span>
                  <span className="text-slate-400">R$ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Desconto</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">R$</span>
                    <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)}
                      min="0" step="0.01"
                      className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm text-right focus:border-indigo-500 outline-none" />
                  </div>
                </div>
                <div className="flex justify-between font-semibold pt-1 border-t border-slate-700">
                  <span className="text-white">Total</span>
                  <span className="text-emerald-400 text-lg">R$ {totalWithDiscount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Payment ── */}
          {cart.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Pagamento</h3>
              <div className="grid grid-cols-5 gap-2">
                {PAYMENT_METHODS.map((pm) => {
                  const Icon = pm.icon;
                  const isSelected = selectedPayment.id === pm.id;
                  return (
                    <button key={pm.id} onClick={() => setSelectedPayment(pm)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl text-center transition-all ${
                        isSelected
                          ? 'bg-indigo-500 text-white ring-2 ring-indigo-400'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}>
                      <Icon size={20} />
                      <span className="text-xs font-medium">{pm.label}</span>
                    </button>
                  );
                })}
              </div>
              {selectedPayment.paymentStatus === 'PENDING' && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">Data de Vencimento</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 outline-none"
                    />
                  </div>
                  <p className="text-xs text-amber-400">
                    ⚠ Venda pendente — será registrada como fiado do cliente.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
            <button onClick={() => setSaleOpen(false)} className="px-4 py-2 text-slate-400 text-sm hover:text-white">Cancelar</button>
            <button onClick={handleCreateSale}
              disabled={saving || cart.length === 0 || (!selectedCustomer?.id && !(useWalkIn && walkInName.trim()))}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Finalizando...' : `Finalizar Venda (R$ ${totalWithDiscount.toFixed(2)})`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => { setDetailOpen(false); setDetailOrder(null); }} title="Detalhes da Venda" size="md">
        {detailOrder ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase">Cliente</p>
                <p className="text-white text-sm">
                  {detailOrder.customer?.name || detailOrder.customerName ? (
                    <span>
                      {detailOrder.customer?.name || detailOrder.customerName}
                      {!detailOrder.customer?.id && detailOrder.customerName && (
                        <span className="ml-1.5 text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">Avulso</span>
                      )}
                    </span>
                  ) : '—'}
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase">Pagamento</p>
                <p className="text-white text-sm">{detailOrder.paymentMethod}</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase">Data</p>
                <p className="text-white text-sm">{new Date(detailOrder.createdAt).toLocaleString('pt-BR')}</p>
              </div>
              {detailOrder.dueDate && (
                <div className={`rounded-lg p-3 ${new Date(detailOrder.dueDate) < new Date() ? 'bg-red-500/10 border border-red-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                  <p className="text-[10px] uppercase text-slate-500">Vencimento</p>
                  <p className={`text-sm ${new Date(detailOrder.dueDate) < new Date() ? 'text-red-400' : 'text-amber-400'}`}>
                    {new Date(detailOrder.dueDate).toLocaleDateString('pt-BR')}
                    {new Date(detailOrder.dueDate) < new Date() && ' (Vencido)'}
                  </p>
                </div>
              )}
            </div>

            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 text-[11px] border-b border-slate-800">
                  <th className="text-left py-2">Produto</th>
                  <th className="text-right py-2">Qtd</th>
                  <th className="text-right py-2">Preço</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {detailOrder.items?.map((item: any) => (
                  <tr key={item.id} className="border-b border-slate-800/50">
                    <td className="py-1.5 text-white">{item.productName}</td>
                    <td className="py-1.5 text-right text-slate-400">{item.quantity}</td>
                    <td className="py-1.5 text-right text-slate-400">R$ {Number(item.unitPrice).toFixed(2)}</td>
                    <td className="py-1.5 text-right text-white">R$ {Number(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-sm">
                  <td colSpan={3} className="py-2 text-right text-slate-400">Subtotal</td>
                  <td className="py-2 text-right text-white">R$ {Number(detailOrder.subtotal).toFixed(2)}</td>
                </tr>
                {Number(detailOrder.discount) > 0 && (
                  <tr className="text-sm">
                    <td colSpan={3} className="py-1 text-right text-slate-400">Desconto</td>
                    <td className="py-1 text-right text-red-400">- R$ {Number(detailOrder.discount).toFixed(2)}</td>
                  </tr>
                )}
                <tr className="text-sm font-semibold">
                  <td colSpan={3} className="py-2 text-right text-white">Total</td>
                  <td className="py-2 text-right text-emerald-400">R$ {Number(detailOrder.total).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

            {detailOrder.paymentStatus === 'PENDING' && detailOrder.status !== 'CANCELLED' && (
              <button
                onClick={() => handlePay(detailOrder.id)}
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Banknote size={16} />
                Receber Pagamento (R$ {Number(detailOrder.total).toFixed(2)})
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">Carregando...</div>
        )}
      </Modal>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-3 py-2 rounded-xl text-sm font-medium ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
