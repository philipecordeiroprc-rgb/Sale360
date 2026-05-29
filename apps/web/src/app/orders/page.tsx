'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, X, ShoppingCart, Trash2, CreditCard, Banknote, User, Eye, WifiOff, Ticket, Scan, Link2, CheckCircle } from 'lucide-react';

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
import { Modal } from '@/components/ui/Modal';
import api from '@/lib/api';
import { addPendingOrder, getProducts, getCustomers, getPendingOrders, mergeCustomers, decrementLocalStock } from '@/lib/offline-db';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { ProductGrid } from '@/components/products/ProductGrid';
import dynamic from 'next/dynamic';
import { QuickAddSheet } from '@/components/products/QuickAddSheet';
import {
  PAYMENT_METHODS,
  CONFIRM_PAYMENT_METHODS,
  paymentLabel,
  isFiado,
  type PaymentLine,
} from '@/lib/payment-constants';
const BarcodeScanner = dynamic(() => import('@/components/products/BarcodeScanner').then(m => ({ default: m.BarcodeScanner })), { ssr: false });

function getWhatsAppMessage(order: any, pixInstructions?: string | null): string {
  const customerName = order.customer?.name || order.customerName || 'Cliente';
  const orderNumber = order.orderNumber;
  const total = Number(order.total).toFixed(2).replace('.', ',');
  const date = new Date(order.createdAt).toLocaleDateString('pt-BR');

  const items = (order.items || []) as any[];
  const maxProducts = 4;
  const itemLines = items.slice(0, maxProducts).map((item: any) =>
    `📦 ${item.quantity}x ${item.productName}`
  );
  if (items.length > maxProducts) {
    itemLines.push(`📦 ...e mais ${items.length - maxProducts} itens`);
  }
  const productsBlock = itemLines.join('\n');

  const pixBlock = pixInstructions ? [
    ``,
    `💳 *Pague via Pix:*`,
    pixInstructions,
  ] : [];

  const blocks = [
    `🤖 *Lembrete automático de pagamento*`,
    ``,
    `Olá ${customerName}! Sua compra #${orderNumber} está em *aberto*:`,
    ``,
    productsBlock,
    `💰 *Total:* R$ ${total}`,
    `📅 *Data:* ${date}`,
    ...pixBlock,
    ``,
    `Se já pagou, desconsidere esta mensagem 🙂`,
    ``,
    `_Mensagem automática. Dúvidas, fale conosco!_`,
  ];

  return blocks.join('\n');
}

function getWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  return `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
}

function orderHasFiado(order: any): boolean {
  return order.payments?.some((p: any) => p.paymentMethod === 'credit_store') || isFiado(order.paymentMethod);
}


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
  const [pixInstructions, setPixInstructions] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('status') || '';
    }
    return '';
  });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const dateFromRef = useRef(dateFrom);
  const dateToRef = useRef(dateTo);
  dateFromRef.current = dateFrom;
  dateToRef.current = dateTo;
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [pendingRevenue, setPendingRevenue] = useState(0);
  const { toast, show } = useToast();
  const searchTimer = useRef<NodeJS.Timeout>(undefined);
  const [search, setSearch] = useState('');
  const { isOnline } = useNetworkStatus();

  // Sale modal
  const [saleOpen, setSaleOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [walkInName, setWalkInName] = useState('');
  const [useWalkIn, setUseWalkIn] = useState(false);

  // Product grid + quick add
  const [productGridSearch, setProductGridSearch] = useState('');
  const [quickAddProduct, setQuickAddProduct] = useState<any>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState('0');
  const [couponCode, setCouponCode] = useState('');
  const [couponData, setCouponData] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Batch selection modal (products with expiry-dated batches)
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchModalMode, setBatchModalMode] = useState<'pdv' | 'online'>('pdv');
  const [batchItems, setBatchItems] = useState<any[]>([]); // cart items that need batch selection
  const [batchSelections, setBatchSelections] = useState<Record<string, string>>({}); // cartIdx → batchId
  const [onlineConfirmOrderItems, setOnlineConfirmOrderItems] = useState<any[]>([]); // order items for online confirm

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<any>(null);
  const [confirmPaymentOpen, setConfirmPaymentOpen] = useState(false);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [confirmingIsOnline, setConfirmingIsOnline] = useState(false);
  const [confirmTotal, setConfirmTotal] = useState(0);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = { page };
      if (statusFilter === 'FIADO') {
        params.paymentMethod = 'Fiado,credit_store';
      } else if (statusFilter) {
        params.status = statusFilter;
      }
      if (search) params.search = search;
      if (dateFrom) params.startDate = new Date(dateFrom + 'T00:00:00').toISOString();
      if (dateTo) params.endDate = new Date(dateTo + 'T23:59:59').toISOString();
      const data = await api.orders.list(params);
      setOrders(data.orders);
      setTotal(data.total);
    } catch (err: any) {
      // Offline fallback: show pending orders from IndexedDB
      try {
        const pending = await getPendingOrders();
        const offlineOrders = pending.map(po => ({
          ...po.data,
          id: po.localId,
          _offline: true,
          _localId: po.localId,
          status: 'PENDING',
          createdAt: new Date(po.createdAt).toISOString(),
        }));
        setOrders(offlineOrders);
        setTotal(offlineOrders.length);
        if (offlineOrders.length === 0) {
          setError('Voce esta offline. Nenhuma venda pendente.');
        }
      } catch {
        setError(err.message || 'Erro ao carregar vendas');
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, search, dateFrom, dateTo]);

  const loadTodayRevenue = async () => {
    try {
      const data = await api.orders.todaySummary();
      setTodayRevenue(Number(data.totalSales || 0));
      setPendingRevenue(Number(data.pendingAmount || 0));
    } catch { /* ignore */ }
  };

  const loadPixInstructions = async () => {
    try {
      const catalog = await api.catalogSettings.get();
      const pix = catalog?.paymentMethods?.find((pm: any) => pm.paymentMethod === 'pix');
      if (pix?.instructions) {
        setPixInstructions(pix.instructions);
      }
    } catch { /* silencioso — instruções Pix são opcionais */ }
  };

  useEffect(() => { loadOrders(); loadTodayRevenue(); loadPixInstructions(); }, [loadOrders]);

  const searchCustomers = async (q: string) => {
    setCustomerSearch(q);
    if (q.length < 1) { setCustomerResults([]); return; }
    // If clearly offline, skip API call entirely (avoids waiting for timeout)
    if (!navigator.onLine) {
      const cached = await getCustomers();
      const qLower = q.toLowerCase();
      setCustomerResults(cached.filter((c: any) =>
        c.name?.toLowerCase().includes(qLower) ||
        c.email?.toLowerCase().includes(qLower) ||
        c.phone?.toLowerCase().includes(qLower)
      ));
      return;
    }
    try {
      const data = await api.customers.list({ search: q });
      setCustomerResults(data.customers || []);
      // Merge into IndexedDB for offline use
      if (data.customers?.length > 0) {
        mergeCustomers(data.customers).catch(() => {});
      }
    } catch {
      try {
        const cached = await getCustomers();
        const qLower = q.toLowerCase();
        const results = cached.filter((c: any) =>
          c.name?.toLowerCase().includes(qLower) ||
          c.email?.toLowerCase().includes(qLower) ||
          c.phone?.toLowerCase().includes(qLower)
        );
        setCustomerResults(results);
      } catch {
        setCustomerResults([]);
      }
    }
  };

  const selectCustomer = (c: any) => {
    setSelectedCustomer(c);
    setCustomerSearch(c.name);
    setCustomerResults([]);
    setUseWalkIn(false);
  };

  const addToCart = (item: CartItem) => {
    // Check if already in cart and merge quantities
    const existingIdx = cart.findIndex(c =>
      c.productId === item.productId &&
      c.variationId === (item.variationId || undefined)
    );
    if (existingIdx >= 0) {
      const updated = [...cart];
      updated[existingIdx].quantity += item.quantity;
      updated[existingIdx].total = updated[existingIdx].quantity * item.unitPrice;
      setCart(updated);
    } else {
      setCart([...cart, item]);
    }
  };

  const removeFromCart = (idx: number) => setCart(cart.filter((_, i) => i !== idx));
  const subtotal = cart.reduce((sum, i) => sum + i.total, 0);
  const couponDiscount = couponData?.discountAmount || 0;
  const totalWithDiscount = subtotal - (parseFloat(discount) || 0) - couponDiscount;

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError('');
    setValidatingCoupon(true);
    try {
      const productIds = cart.map(item => item.productId).filter(Boolean) as string[];
      const categoryIds: string[] = [];
      // Try to get categoryIds from cached products
      try {
        const cached = await getProducts();
        for (const item of cart) {
          const prod = cached.find((p: any) => p.id === item.productId);
          if (prod?.categoryId) categoryIds.push(prod.categoryId);
        }
      } catch {}
      const data = await api.coupons.validate({
        code: couponCode.trim(),
        orderSubtotal: subtotal,
        productIds,
        categoryIds: [...new Set(categoryIds)],
      });
      if (data.valid) {
        setCouponData(data);
        setCouponError('');
      } else {
        setCouponError(data.error || 'Cupom inválido');
      }
    } catch (err: any) {
      setCouponError(err.message || 'Erro ao validar cupom');
      setCouponData(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const openSale = () => {
    setCustomerSearch('');
    setCustomerResults([]);
    setSelectedCustomer(null);
    setWalkInName('');
    setUseWalkIn(false);
    setProductGridSearch('');
    setQuickAddProduct(null);
    setQuickAddOpen(false);
    setScannerOpen(false);
    setCart([]);
    setDiscount('0');
    setCouponCode('');
    setCouponData(null);
    setCouponError('');
    setPaymentLines([]);
    setDueDate('');
    setSaleOpen(true);
  };

  const handleCreateSale = async () => {
    if (cart.length === 0) { show('Adicione produtos', 'error'); return; }
    // Validate payment lines
    const paidSum = paymentLines.reduce((s, pl) => s + pl.amount, 0);
    if (paymentLines.length === 0 || Math.abs(paidSum - totalWithDiscount) > 0.01) {
      show('Informe as formas de pagamento. A soma deve igualar o total.', 'error');
      return;
    }

    // Check for products that have batches with expiry dates
    const productsWithStock = cart.filter(c => c.productId);
    if (productsWithStock.length > 0 && isOnline) {
      try {
        const needsSelection: any[] = [];
        const preselect: Record<string, string> = {};

        for (let i = 0; i < cart.length; i++) {
          const item = cart[i];
          if (!item.productId) continue;

          const batches = await api.inventory.batches({
            productId: item.productId,
            variationId: item.variationId || undefined,
          });

          // Filter to batches that have expiryDate
          const withExpiry = batches.batches.filter((b: any) => b.expiryDate);
          if (withExpiry.length > 1) {
            // Sort by expiryDate ascending (nearest expiry first)
            withExpiry.sort((a: any, b: any) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
            needsSelection.push({
              cartIndex: i,
              cartItem: item,
              batches: withExpiry,
            });
            // Pre-select the nearest expiry batch
            preselect[String(i)] = withExpiry[0].id;
          }
        }

        if (needsSelection.length > 0) {
          setBatchItems(needsSelection);
          setBatchSelections(preselect);
          setBatchModalMode('pdv');
          setBatchModalOpen(true);
          return; // wait for user to confirm in modal
        }
      } catch {
        // If batch check fails (e.g., offline), proceed normally
      }
    }

    // No batch selection needed, proceed directly
    executeSale({});
  };

  const executeSale = async (itemBatchIds: Record<string, string>) => {
    setSaving(true);

    const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const orderData = {
      customerId: selectedCustomer?.id || undefined,
      customerName: useWalkIn && walkInName.trim() ? walkInName.trim() : undefined,
      items: cart.map((item, idx) => ({
        productId: item.productId,
        variationId: item.variationId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        batchId: itemBatchIds[String(idx)] || undefined,
      })),
      subtotal,
      discount: (parseFloat(discount) || 0) + (couponDiscount),
      total: totalWithDiscount,
      couponId: couponData?.couponId || undefined,
      couponDiscount: couponDiscount || undefined,
      payments: paymentLines.map(pl => ({
        paymentMethod: pl.methodId,
        amount: pl.amount,
      })),
      paymentStatus: paymentLines.some(pl => isFiado(pl.methodId)) ? 'PENDING' : 'PAID',
      dueDate: paymentLines.some(pl => isFiado(pl.methodId)) && dueDate ? dueDate : undefined,
      localId,
    };

    try {
      await api.orders.create(orderData);

      show('Venda realizada!');
      setSaleOpen(false);
      setBatchModalOpen(false);
      loadOrders();
      loadTodayRevenue();
    } catch (err: any) {
      // Network error — save offline
      if (!navigator.onLine || err.message === 'Failed to fetch' || err.name === 'TypeError') {
        try {
          await addPendingOrder({
            localId,
            data: orderData,
            status: 'pending',
            createdAt: Date.now(),
            lastAttempt: 0,
            error: null,
          });
          // Decrement local stock for each item
          for (const item of cart) {
            if (item.productId) {
              decrementLocalStock(item.productId, item.variationId, item.quantity).catch(() => {});
            }
          }
          show('Venda salva offline. Sera sincronizada quando houver conexao.', 'success');
          setSaleOpen(false);
          setBatchModalOpen(false);
          loadOrders();
        } catch {
          show('Erro ao salvar venda offline', 'error');
        }
      } else {
        show(err.message || 'Erro ao criar venda', 'error');
      }
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
    setConfirmingOrderId(id);
    setConfirmingIsOnline(false);
    setPaymentLines([]);
    try {
      const order = await api.orders.get(id);
      setConfirmTotal(Number(order.total) || 0);
    } catch { /* ignore */ }
    setConfirmPaymentOpen(true);
  };

  const handlePayExecute = async () => {
    const id = confirmingOrderId;
    if (!id) return;
    try {
      const body: any = {};
      if (paymentLines.length > 0) {
        body.payments = paymentLines.map(pl => ({ paymentMethod: pl.methodId, amount: pl.amount }));
      }
      const result = await api.orders.pay(id, body);
      show(result.message || 'Pagamento recebido!');
      setConfirmPaymentOpen(false);
      setConfirmingOrderId(null);
      loadOrders();
      loadTodayRevenue();
      if (detailOpen && detailOrder?.id === id) setDetailOpen(false);
    } catch (err: any) {
      show(err.message || 'Erro ao receber pagamento', 'error');
    }
  };

  const handleConfirmOnline = async (id: string) => {
    setConfirmingOrderId(id);
    setConfirmingIsOnline(true);
    setPaymentLines([]);
    try {
      const order = await api.orders.get(id);
      setConfirmTotal(Number(order.total) || 0);
    } catch { /* ignore */ }
    setConfirmPaymentOpen(true);
  };

  const handleConfirmOnlineExecute = async (itemBatchIds?: Record<string, string>) => {
    const id = confirmingOrderId;
    if (!id) return;
    try {
      const body: any = {};
      if (paymentLines.length > 0) {
        body.payments = paymentLines.map(pl => ({ paymentMethod: pl.methodId, amount: pl.amount }));
      }
      if (itemBatchIds && Object.keys(itemBatchIds).length > 0) {
        body.itemBatchIds = itemBatchIds;
      }
      const result = await api.orders.confirm(id, body);
      show(result.message || 'Pedido confirmado!');
      setConfirmPaymentOpen(false);
      setBatchModalOpen(false);
      setConfirmingOrderId(null);
      loadOrders();
      loadTodayRevenue();
      if (detailOpen && detailOrder?.id === id) setDetailOpen(false);
    } catch (err: any) {
      show(err.message || 'Erro ao confirmar pedido', 'error');
    }
  };

  const handleCheckBatchesAndConfirm = async () => {
    const id = confirmingOrderId;
    if (!id) return;

    // Fetch the order with items to check for batches
    try {
      const order = await api.orders.get(id);
      const items = order.items || [];
      const needsSelection: any[] = [];
      const preselect: Record<string, string> = {};

      for (const item of items) {
        if (!item.productId) continue;

        const batchesResp = await api.inventory.batches({
          productId: item.productId,
          variationId: item.variationId || undefined,
        });

        const withExpiry = batchesResp.batches.filter((b: any) => b.expiryDate);
        if (withExpiry.length > 1) {
          withExpiry.sort((a: any, b: any) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
          needsSelection.push({
            orderItemId: item.id,
            productName: item.productName,
            batches: withExpiry,
          });
          preselect[item.id] = withExpiry[0].id;
        }
      }

      if (needsSelection.length > 0) {
        setOnlineConfirmOrderItems(needsSelection);
        setBatchItems(needsSelection);
        setBatchSelections(preselect);
        setBatchModalMode('online');
        setConfirmPaymentOpen(false); // hide confirm modal, show batch modal
        setBatchModalOpen(true);
        return;
      }
    } catch {
      // If check fails, proceed normally
    }

    // No batch selection needed
    await handleConfirmOnlineExecute();
  };

  const openDetail = async (id: string) => {
    try {
      const order = await api.orders.get(id);
      if (order) { setDetailOrder(order); setDetailOpen(true); }
    } catch { show('Erro ao carregar detalhes', 'error'); }
  };

  const paidSum = paymentLines.reduce((s, pl) => s + pl.amount, 0);
  const paymentValid = paymentLines.length > 0 && Math.abs(paidSum - totalWithDiscount) <= 0.01;

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
            { id: 'FIADO', label: 'Fiado' },
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
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-32 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-white text-xs focus:border-indigo-500 outline-none"
          />
          <span className="text-slate-500 text-xs">até</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-32 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-white text-xs focus:border-indigo-500 outline-none"
          />
          {(dateFrom || dateTo) && (
            <>
              <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
                className="text-slate-400 hover:text-white p-1" title="Limpar datas">
                <X size={14} />
              </button>
              <button onClick={() => { setPage(1); }}
                className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-medium transition-colors">
                Filtrar
              </button>
            </>
          )}
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
                      <div className="flex items-center justify-center gap-1">
                        {o.payments && o.payments.length > 0 ? (
                          o.payments.map((p: any, idx: number) => (
                            <span key={idx} className="flex items-center gap-0.5">
                              {idx > 0 && <span className="text-slate-600 text-[10px]">+</span>}
                              <span className="text-xs bg-slate-800 rounded-md px-2 py-1 text-white">{paymentLabel(p.paymentMethod)}</span>
                            </span>
                          ))
                        ) : o.paidWithMethod ? (
                          <>
                            <span className="text-xs bg-slate-800 rounded-md px-2 py-1 text-white">{paymentLabel(o.paidWithMethod)}</span>
                            <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-medium">Fiado</span>
                          </>
                        ) : isFiado(o.paymentMethod) ? (
                          <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-medium">Fiado</span>
                        ) : (
                          <span className="text-xs bg-slate-800 rounded-md px-2 py-1 text-white">{paymentLabel(o.paymentMethod)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
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
                        {o.source === 'ONLINE' && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-1 rounded-full flex items-center gap-0.5">
                            <Link2 size={10} />
                            Link
                          </span>
                        )}
                      </div>
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
                        {orderHasFiado(o) && o.paymentStatus !== 'PAID' && o.status !== 'CANCELLED' && o.customer?.phone && (
                          <a href={getWhatsAppUrl(o.customer.phone, getWhatsAppMessage(o, pixInstructions))}
                            target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors"
                            title="Cobrar via WhatsApp">
                            <WhatsAppIcon size={16} />
                          </a>
                        )}
                        {o.source === 'ONLINE' && o.status !== 'COMPLETED' && o.status !== 'CANCELLED' && (
                          <button onClick={() => handleConfirmOnline(o.id)}
                            className="p-1.5 text-blue-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Confirmar pedido online (baixar estoque)">
                            <CheckCircle size={16} />
                          </button>
                        )}
                        {o.paymentStatus === 'PENDING' && o.status !== 'CANCELLED' && (o.source !== 'ONLINE' || orderHasFiado(o)) && (
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
      <Modal open={saleOpen} onClose={() => setSaleOpen(false)} title="Nova Venda" size="lg" closeOnOverlayClick={false}>
        <div className="space-y-3">
          {/* Offline banner */}
          {!isOnline && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
              <WifiOff size={15} className="text-amber-400 shrink-0" />
              <p className="text-xs text-amber-300">
                Modo offline. A venda sera salva localmente e enviada quando houver conexao.
              </p>
            </div>
          )}

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

          {/* ── Produtos ── */}
          <div className="bg-slate-800/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-white flex-1">Produtos</h3>
              <button
                onClick={() => setScannerOpen(true)}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors"
                title="Escanear código de barras"
              >
                <Scan size={16} />
              </button>
            </div>

            {scannerOpen ? (
              <BarcodeScanner
                isOpen={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onDetected={(product) => {
                  setScannerOpen(false);
                  setQuickAddProduct(product);
                  setQuickAddOpen(true);
                }}
                onError={(msg) => show(msg, 'error')}
              />
            ) : (
              <ProductGrid
                onProductClick={(product) => {
                  setQuickAddProduct(product);
                  setQuickAddOpen(true);
                }}
                cart={cart}
                isOnline={isOnline}
                productSearch={productGridSearch}
                onProductSearchChange={setProductGridSearch}
              />
            )}
          </div>

          <QuickAddSheet
            open={quickAddOpen}
            product={quickAddProduct}
            onClose={() => { setQuickAddOpen(false); setQuickAddProduct(null); }}
            onAdd={(item) => {
              addToCart(item);
              setQuickAddOpen(false);
              setQuickAddProduct(null);
            }}
            cartItems={cart}
          />

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
                {/* Coupon code */}
                <div className="space-y-1.5 border-t border-slate-700 pt-2">
                  <span className="text-slate-400 text-xs">Cupom de desconto</span>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Ticket size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        value={couponCode}
                        onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                        placeholder="Código do cupom..."
                        disabled={!!couponData}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-xs placeholder:text-slate-500 focus:border-indigo-500 outline-none disabled:opacity-50"
                      />
                    </div>
                    {couponData ? (
                      <button
                        onClick={() => { setCouponData(null); setCouponCode(''); setCouponError(''); }}
                        className="px-2 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                      >
                        <X size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={applyCoupon}
                        disabled={!couponCode.trim() || validatingCoupon}
                        className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white rounded text-xs font-medium transition-colors"
                      >
                        {validatingCoupon ? '...' : 'Aplicar'}
                      </button>
                    )}
                  </div>
                  {couponData && (
                    <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <Ticket size={10} />
                      Cupom {couponData.code}: {couponData.discountType === 'PERCENTAGE' ? `${couponData.discountValue}%` : `R$ ${couponData.discountValue.toFixed(2)}`} = -R$ {couponData.discountAmount.toFixed(2)}
                    </p>
                  )}
                  {couponError && (
                    <p className="text-[10px] text-red-400">{couponError}</p>
                  )}
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
              <h3 className="text-sm font-semibold text-white mb-1">Pagamento</h3>
              {(() => {
                const paidSoFar = paymentLines.reduce((s, pl) => s + pl.amount, 0);
                const remaining = totalWithDiscount - paidSoFar;
                return (
                  <p className="text-xs text-slate-400 mb-3">
                    Total: <span className="text-emerald-400 font-semibold">R$ {totalWithDiscount.toFixed(2)}</span>
                    {paymentLines.length > 0 && (
                      <> &middot; Faltam: <span className={remaining > 0.01 ? 'text-amber-400' : 'text-emerald-400'}>{remaining > 0.01 ? `R$ ${remaining.toFixed(2)}` : 'R$ 0,00'}</span></>
                    )}
                  </p>
                );
              })()}
              <div className="grid grid-cols-5 gap-2">
                {PAYMENT_METHODS.map((pm) => {
                  const Icon = pm.icon;
                  const handleClick = () => {
                    const remaining = totalWithDiscount - paymentLines.reduce((s, pl) => s + pl.amount, 0);
                    if (remaining <= 0.01) return; // already fully paid
                    // Add as new line with full remaining amount
                    setPaymentLines(prev => [...prev, { methodId: pm.id, amount: remaining }]);
                  };
                  return (
                    <button key={pm.id} onClick={handleClick}
                      className="flex flex-col items-center gap-1 p-3 rounded-xl text-center transition-all bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white">
                      <Icon size={20} />
                      <span className="text-xs font-medium">{pm.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Payment lines */}
              {paymentLines.length > 0 && (
                <div className="mt-3 space-y-2">
                  {paymentLines.map((pl, idx) => {
                    const method = PAYMENT_METHODS.find(m => m.id === pl.methodId);
                    const isFiadoLine = isFiado(pl.methodId);
                    return (
                      <div key={idx} className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2">
                        <span className={`w-2 h-2 rounded-full ${method?.color || 'bg-slate-500'}`} />
                        <span className="text-sm text-white flex-1">{method?.label || pl.methodId}</span>
                        <input
                          type="number"
                          value={pl.amount || ''}
                          onChange={(e) => {
                            setPaymentLines(prev => prev.map((l, i) => i === idx ? { ...l, amount: parseFloat(e.target.value) || 0 } : l));
                          }}
                          className="w-24 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm text-right focus:border-indigo-500 outline-none"
                          placeholder="0,00"
                          step="0.01"
                        />
                        <button
                          onClick={() => setPaymentLines(prev => prev.filter((_, i) => i !== idx))}
                          className="text-slate-500 hover:text-red-400 p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {paymentLines.some(pl => isFiado(pl.methodId)) && (
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
              disabled={saving || cart.length === 0 || !paymentValid}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Finalizando...' : `Finalizar Venda (R$ ${totalWithDiscount.toFixed(2)})`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => { setDetailOpen(false); setDetailOrder(null); }} title="Detalhes da Venda" size="md" closeOnOverlayClick={false}>
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
                <div className="text-white text-sm">
                  {detailOrder.payments && detailOrder.payments.length > 0 ? (
                    <div className="space-y-1">
                      {detailOrder.payments.map((p: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs bg-slate-800 rounded-md px-2 py-1">{paymentLabel(p.paymentMethod)}</span>
                          <span className="text-xs text-slate-400">R$ {Number(p.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ) : detailOrder.paidWithMethod ? (
                    <p className="flex items-center gap-1.5">
                      {paymentLabel(detailOrder.paidWithMethod)}
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-medium">Fiado</span>
                    </p>
                  ) : isFiado(detailOrder.paymentMethod) ? (
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-medium">Fiado</span>
                  ) : (
                    <p>{paymentLabel(detailOrder.paymentMethod)}</p>
                  )}
                  {detailOrder.source === 'ONLINE' && (
                    <p className="mt-1">
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 w-fit">
                        <Link2 size={10} /> Link
                      </span>
                    </p>
                  )}
                </div>
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
                {Number(detailOrder.couponDiscount) > 0 && (
                  <tr className="text-sm">
                    <td colSpan={3} className="py-1 text-right text-indigo-400">
                      <Ticket size={12} className="inline mr-1" />
                      Cupom {detailOrder.coupon?.code || ''}
                    </td>
                    <td className="py-1 text-right text-indigo-400">- R$ {Number(detailOrder.couponDiscount).toFixed(2)}</td>
                  </tr>
                )}
                <tr className="text-sm font-semibold">
                  <td colSpan={3} className="py-2 text-right text-white">Total</td>
                  <td className="py-2 text-right text-emerald-400">R$ {Number(detailOrder.total).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

            {detailOrder.source === 'ONLINE' && detailOrder.paymentStatus === 'PENDING' && detailOrder.status !== 'CANCELLED' && !orderHasFiado(detailOrder) && (
              <button
                onClick={() => { handleConfirmOnline(detailOrder.id); }}
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <CheckCircle size={16} />
                Confirmar Pedido Online (Baixar Estoque)
              </button>
            )}
            {detailOrder.paymentStatus === 'PENDING' && detailOrder.status !== 'CANCELLED' && (detailOrder.source !== 'ONLINE' || orderHasFiado(detailOrder)) && (
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

      {/* Confirm Payment Sub-Modal (split payment for Fiado receipt / online confirm) */}
      <Modal open={confirmPaymentOpen} onClose={() => { setConfirmPaymentOpen(false); setConfirmingOrderId(null); }} title={confirmingIsOnline ? 'Confirmar Pedido Online' : 'Receber Pagamento'} size="md" closeOnOverlayClick={false}>
        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-1">Pagamento</h3>
            {(() => {
              const paidSoFar = paymentLines.reduce((s, pl) => s + pl.amount, 0);
              const remaining = confirmTotal - paidSoFar;
              return (
                <p className="text-xs text-slate-400 mb-3">
                  Total: <span className="text-emerald-400 font-semibold">R$ {confirmTotal.toFixed(2)}</span>
                  {paymentLines.length > 0 && (
                    <> &middot; Faltam: <span className={remaining > 0.01 ? 'text-amber-400' : 'text-emerald-400'}>{remaining > 0.01 ? `R$ ${remaining.toFixed(2)}` : 'R$ 0,00'}</span></>
                  )}
                </p>
              );
            })()}
            <div className="grid grid-cols-4 gap-2">
              {CONFIRM_PAYMENT_METHODS.map((pm) => {
                const Icon = pm.icon;
                const handleClick = () => {
                  const remaining = confirmTotal - paymentLines.reduce((s, pl) => s + pl.amount, 0);
                  if (remaining <= 0.01) return;
                  setPaymentLines(prev => [...prev, { methodId: pm.id, amount: remaining }]);
                };
                return (
                  <button key={pm.id} onClick={handleClick}
                    className="flex flex-col items-center gap-1 p-3 rounded-xl text-center transition-all bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white">
                    <Icon size={20} />
                    <span className="text-xs font-medium">{pm.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Payment lines */}
            {paymentLines.length > 0 && (
              <div className="mt-3 space-y-2">
                {paymentLines.map((pl, idx) => {
                  const method = CONFIRM_PAYMENT_METHODS.find(m => m.id === pl.methodId as any);
                  return (
                    <div key={idx} className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2">
                      <span className={`w-2 h-2 rounded-full ${(method as any)?.color || 'bg-slate-500'}`} />
                      <span className="text-sm text-white flex-1">{(method as any)?.label || pl.methodId}</span>
                      <input
                        type="number"
                        value={pl.amount || ''}
                        onChange={(e) => {
                          setPaymentLines(prev => prev.map((l, i) => i === idx ? { ...l, amount: parseFloat(e.target.value) || 0 } : l));
                        }}
                        className="w-24 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm text-right focus:border-indigo-500 outline-none"
                        placeholder="0,00"
                        step="0.01"
                      />
                      <button
                        onClick={() => setPaymentLines(prev => prev.filter((_, i) => i !== idx))}
                        className="text-slate-500 hover:text-red-400 p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
            <button onClick={() => { setConfirmPaymentOpen(false); setConfirmingOrderId(null); }} className="px-4 py-2 text-slate-400 text-sm hover:text-white">Cancelar</button>
            <button
              onClick={() => { if (confirmingIsOnline) handleCheckBatchesAndConfirm(); else handlePayExecute(); }}
              disabled={(() => {
                const paidSoFar = paymentLines.reduce((s, pl) => s + pl.amount, 0);
                return paymentLines.length === 0 || Math.abs(paidSoFar - confirmTotal) > 0.01;
              })()}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {confirmingIsOnline ? 'Confirmar Pedido' : 'Receber Pagamento'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Batch Selection Modal (expiry dates) — used for both PDV sale and online order confirm */}
      <Modal
        open={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        title="Escolha do Lote"
        size="md"
        closeOnOverlayClick={false}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Os produtos abaixo têm lotes com datas de validade diferentes. O lote com vencimento mais próximo já está selecionado.
          </p>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {batchItems.map((entry) => {
              const key = batchModalMode === 'online' ? entry.orderItemId : entry.cartIndex;
              const productName = batchModalMode === 'online' ? entry.productName : entry.cartItem?.productName;
              const batches = entry.batches;
              return (
                <div key={key} className="bg-slate-800 rounded-lg p-3">
                  <p className="text-sm text-white font-medium mb-2">{productName}</p>
                  <div className="flex flex-wrap gap-2">
                    {batches.map((b: any) => {
                      const isSelected = batchSelections[String(key)] === b.id;
                      const expiryDate = new Date(b.expiryDate);
                      const isExpired = expiryDate < new Date();
                      return (
                        <button
                          key={b.id}
                          onClick={() => setBatchSelections(prev => ({ ...prev, [String(key)]: b.id }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            isSelected
                              ? 'bg-indigo-500 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          <span className="font-mono text-[10px] mr-1.5">#{b.id.slice(0, 5)}</span>
                          {isExpired ? 'Vencido ' : 'Vence '}
                          {expiryDate.toLocaleDateString('pt-BR')}
                          <span className="ml-1 text-[10px] opacity-60">({b.remainingQty} un.)</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
            <button onClick={() => setBatchModalOpen(false)} className="px-4 py-2 text-slate-400 text-sm hover:text-white">
              Cancelar
            </button>
            <button
              onClick={() => {
                if (batchModalMode === 'online') {
                  handleConfirmOnlineExecute(batchSelections);
                } else {
                  executeSale(batchSelections);
                }
              }}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {batchModalMode === 'online' ? 'Confirmar Pedido' : 'Confirmar Venda'}
            </button>
          </div>
        </div>
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
