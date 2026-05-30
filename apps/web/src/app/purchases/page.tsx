'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Check, X, ShoppingBag, ChevronDown, ChevronUp, Info, Scan, Pencil, Upload, RefreshCw, Sparkles } from 'lucide-react';
import { ImportModal } from '@/components/ui/ImportModal';
import { IMPORT_CONFIGS } from '@/lib/import-configs';
import { Modal } from '@/components/ui/Modal';
import { NewProductPurchaseWizard } from '@/components/purchases/NewProductPurchaseWizard';
import dynamic from 'next/dynamic';
import { type VariationData } from '@/components/products/VariationEditor';
const BarcodeScanner = dynamic(() => import('@/components/products/BarcodeScanner').then(m => ({ default: m.BarcodeScanner })), { ssr: false });
import api from '@/lib/api';
import { getProducts } from '@/lib/offline-db';

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
  taxRatePct: number;
  marginPct: number;
  salePrice: number;
  quantity: number;
  hasVariations: boolean;
  variations: VariationData[];
  expiryDates: Record<string, string>; // variation name → date
  simpleExpiryDate: string;            // for simple products without variations
}

const emptyItem: PurchaseItemData = {
  productId: '',
  productName: '',
  costPrice: 0,
  operationalCost: 0,
  taxRatePct: 0,
  marginPct: 0,
  salePrice: 0,
  quantity: 1,
  hasVariations: false,
  variations: [],
  expiryDates: {},
  simpleExpiryDate: '',
};

// Custo total (unitário + operacional, sem taxa)
const totalCost = (item: PurchaseItemData): number => item.costPrice + item.operationalCost;

// Custo total com taxa (unitário + operacional + taxa estimada)
const costWithTax = (item: PurchaseItemData): number => {
  const taxAmount = item.salePrice > 0 ? item.salePrice * (item.taxRatePct / 100) : 0;
  return item.costPrice + item.operationalCost + taxAmount;
};

// Calcula preço de venda: (custo total) / (1 - taxa% - margem%)
const calcSalePrice = (item: PurchaseItemData): number => {
  const cost = totalCost(item);
  if (cost <= 0) return item.salePrice;
  const divisor = 1 - (item.taxRatePct / 100) - (item.marginPct / 100);
  if (divisor <= 0) return 0;
  return Math.round((cost / divisor) * 100) / 100;
};

// Calcula margem a partir do preço de venda: 1 - taxa% - (custo total / preço)
const calcMarginFromSale = (item: PurchaseItemData): number => {
  const cost = totalCost(item);
  if (cost <= 0 || item.salePrice <= 0) return item.marginPct;
  const margin = (1 - (item.taxRatePct / 100) - (cost / item.salePrice)) * 100;
  return Math.round(margin * 10) / 10;
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
  const [tab, setTab] = useState<'restock' | 'new-product'>('restock');
  const [wizardOpen, setWizardOpen] = useState(false);
  const { toast, show } = useToast();

  // Create form
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // Receive modal with expiry dates
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receivingPurchase, setReceivingPurchase] = useState<any>(null);
  const [receivingExpiryDates, setReceivingExpiryDates] = useState<Record<string, string>>({});
  // Template-based variation row builder
  const [templateDims, setTemplateDims] = useState<any[]>([]); // dimensions from category template
  const [rowDims, setRowDims] = useState<Record<string, string>>({});
  const [rowCustom, setRowCustom] = useState<Record<string, string>>({});
  const [rowQty, setRowQty] = useState<number>(0);
  // Expiry date for new variation row
  const [rowExpiryDate, setRowExpiryDate] = useState('');
  // Manual variation input (when no template)
  const [newVarName, setNewVarName] = useState('');
  const [newVarQty, setNewVarQty] = useState<number>(0);
  const [newVarExpiryDate, setNewVarExpiryDate] = useState('');

  const loadPurchases = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.purchases.list({ status: statusFilter || undefined, page });
      setPurchases(data.purchases);
      setTotal(data.total);
    } catch (err: any) {
      if (!navigator.onLine) {
        setError('Voce esta offline. As compras nao estao disponiveis sem conexao.');
      } else {
        setError(err.message || 'Erro ao carregar compras');
      }
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
    } catch {
      // Offline fallback: search from IndexedDB cache
      try {
        const cached = await getProducts();
        const qLower = q.toLowerCase();
        setProductResults(cached.filter((p: any) =>
          p.name?.toLowerCase().includes(qLower) ||
          p.sku?.toLowerCase().includes(qLower) ||
          p.barcode?.toString().toLowerCase().includes(qLower)
        ));
      } catch { setProductResults([]); }
    }
  };

  useEffect(() => { loadPurchases(); }, [loadPurchases]);

  const openForm = async () => {
    setEditingId(null);
    setSelectedSupplier('');
    setUseOutroSupplier(false);
    setOutroSupplierName('');
    setPurchaseItems([]);
    setCurrentItem({ ...emptyItem });
    setTemplateDims([]);
    setRowDims({});
    setRowCustom({});
    setRowQty(0);
    setRowExpiryDate('');
    setNewVarName('');
    setNewVarQty(0);
    setNewVarExpiryDate('');
    setNotes('');
    setDiscount('0');
    setProductSearch('');
    setProductResults([]);
    setScannerOpen(false);
    const sups = await loadSuppliers();
    setSuppliers(sups);
    setFormOpen(true);
  };

  const openEdit = async (purchase: any) => {
    setEditingId(purchase.id);
    setSelectedSupplier(purchase.supplierId || '');
    setUseOutroSupplier(false);
    setOutroSupplierName('');
    setNotes(purchase.notes || '');
    setDiscount(String(purchase.discount || '0'));
    setProductSearch('');
    setProductResults([]);
    setScannerOpen(false);
    setCurrentItem({ ...emptyItem });
    setTemplateDims([]);
    setRowDims({});
    setRowCustom({});
    setRowQty(0);
    setRowExpiryDate('');
    setNewVarName('');
    setNewVarQty(0);
    setNewVarExpiryDate('');

    // Map purchase items to PurchaseItemData
    const items: PurchaseItemData[] = (purchase.items || []).map((item: any) => {
      const hasVar = !!item.variationId;
      // Extract variation name from productName ("Produto - Variacao" → "Variacao")
      const varName = hasVar && item.productName.includes(' - ')
        ? item.productName.split(' - ').slice(1).join(' - ')
        : '';
      // Extract base product name (without variation suffix) to avoid duplication on re-save
      const baseName = hasVar && item.productName.includes(' - ')
        ? item.productName.split(' - ')[0]
        : item.productName;
      return {
        productId: item.productId || '',
        productName: baseName,
        costPrice: Number(item.unitCost || 0),
        operationalCost: Number(item.operationalCost || 0),
        taxRatePct: Number(item.taxRatePct || 0),
        marginPct: Number(item.marginPct || 0),
        salePrice: Number(item.salePrice || 0),
        quantity: Number(item.quantity),
        hasVariations: hasVar,
        variations: hasVar ? [{
          id: item.variationId,
          name: varName,
          priceModifier: 0,
          stockQty: Number(item.quantity),
          lowStockAt: undefined,
        }] : [],
        expiryDates: {},
        simpleExpiryDate: '',
      };
    });
    setPurchaseItems(items);

    const sups = await loadSuppliers();
    setSuppliers(sups);
    setFormOpen(true);
  };

  // Generate cartesian product of dimension options
  const generateCombos = (dimensions: any[]): string[] => {
    if (dimensions.length === 0) return [];
    const parseOptions = (opts: any): string[] =>
      Array.isArray(opts) ? opts : (typeof opts === 'string' ? JSON.parse(opts) : []);
    let combos = parseOptions(dimensions[0].options).map((o: string) => [o]);
    for (let i = 1; i < dimensions.length; i++) {
      const next: string[][] = [];
      for (const combo of combos) {
        for (const opt of parseOptions(dimensions[i].options)) {
          next.push([...combo, opt]);
        }
      }
      combos = next;
    }
    return combos.map((parts: string[]) => parts.join(' / '));
  };

  const selectProduct = (p: any) => {
    const hasExistingVars = p.hasVariations || (p.variations?.length > 0);
    const template = p.category?.variationTemplate;
    const hasTemplate = template?.dimensions?.length > 0;
    setNewVarName('');
    setNewVarQty(0);

    if (hasExistingVars) {
      // Load existing variations + keep template so user can add NEW variations
      if (hasTemplate) {
        const dims = template.dimensions.map((d: any) => ({
          ...d,
          options: Array.isArray(d.options) ? d.options : (typeof d.options === 'string' ? JSON.parse(d.options) : []),
        }));
        setTemplateDims(dims);
      } else {
        setTemplateDims([]);
      }
      setRowDims({});
      setRowCustom({});
      setRowQty(0);
      setRowExpiryDate('');
      setNewVarName('');
      setNewVarQty(0);
      setNewVarExpiryDate('');
      setCurrentItem({
        productId: p.id,
        productName: p.name,
        costPrice: 0,
        operationalCost: Number(p.operationalCost || 0),
        taxRatePct: Number(p.taxRate || 0),
        marginPct: 0,
        salePrice: Number(p.price || 0),
        quantity: 0,
        hasVariations: true,
        variations: (p.variations || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          priceModifier: Number(v.priceModifier || 0),
          stockQty: 0,
          lowStockAt: undefined,
        })),
        expiryDates: {},
        simpleExpiryDate: '',
      });
    } else if (hasTemplate) {
      // Template-based: user builds variation rows manually with dropdowns
      const dims = template.dimensions.map((d: any) => ({
        ...d,
        options: Array.isArray(d.options) ? d.options : (typeof d.options === 'string' ? JSON.parse(d.options) : []),
      }));
      setTemplateDims(dims);
      setRowDims({});
      setRowCustom({});
      setRowQty(0);
      setRowExpiryDate('');
      setNewVarName('');
      setNewVarQty(0);
      setNewVarExpiryDate('');
      setCurrentItem({
        productId: p.id,
        productName: p.name,
        costPrice: 0,
        operationalCost: Number(p.operationalCost || 0),
        taxRatePct: Number(p.taxRate || 0),
        marginPct: 0,
        salePrice: Number(p.price || 0),
        quantity: 0,
        hasVariations: true,
        variations: [], // starts empty, rows added manually
        expiryDates: {},
        simpleExpiryDate: '',
      });
    } else {
      // Simple product, no variations
      setTemplateDims([]);
      setRowExpiryDate('');
      setNewVarName('');
      setNewVarQty(0);
      setNewVarExpiryDate('');
      setCurrentItem({
        productId: p.id,
        productName: p.name,
        costPrice: 0,
        operationalCost: Number(p.operationalCost || 0),
        taxRatePct: Number(p.taxRate || 0),
        marginPct: 0,
        salePrice: Number(p.price || 0),
        quantity: 1,
        hasVariations: false,
        variations: [],
        expiryDates: {},
        simpleExpiryDate: '',
      });
    }
    setProductSearch('');
    setProductResults([]);
  };

  const /** total quantity from variations or direct input */
  effectiveQty = currentItem.hasVariations
    ? currentItem.variations.reduce((sum, v) => sum + (v.stockQty || 0), 0)
    : currentItem.quantity;

  const addCurrentItem = () => {
    if (!currentItem.productId) { show('Selecione um produto', 'error'); return; }
    if (effectiveQty <= 0) { show('Quantidade deve ser maior que zero', 'error'); return; }
    setPurchaseItems([...purchaseItems, { ...currentItem, quantity: effectiveQty }]);
    setCurrentItem({ ...emptyItem });
    setTemplateDims([]);
    setRowDims({});
    setRowCustom({});
    setRowQty(0);
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

      // Build purchase items
      const purchaseItemsData: {
        productId: string;
        variationId?: string;
        productName: string;
        quantity: number;
        unitCost: number;
        total: number;
        salePrice?: number;
        operationalCost?: number;
        taxRatePct?: number;
        marginPct?: number;
      }[] = [];

      for (const item of purchaseItems) {
        if (item.hasVariations && item.variations.length > 0) {
          for (const v of item.variations) {
            const varQty = v.stockQty || 0;
            if (varQty <= 0) continue;

            purchaseItemsData.push({
              productId: item.productId,
              variationId: v.id,
              productName: `${item.productName} - ${v.name}`,
              quantity: varQty,
              unitCost: item.costPrice,
              total: item.costPrice * varQty,
              salePrice: item.salePrice || undefined,
              operationalCost: item.operationalCost || undefined,
              taxRatePct: item.taxRatePct || undefined,
              marginPct: item.marginPct || undefined,
            });
          }
        } else {
          purchaseItemsData.push({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitCost: item.costPrice,
            total: item.costPrice * item.quantity,
            salePrice: item.salePrice || undefined,
            operationalCost: item.operationalCost || undefined,
            taxRatePct: item.taxRatePct || undefined,
            marginPct: item.marginPct || undefined,
          });
        }
      }

      if (purchaseItemsData.length === 0) {
        show('Adicione pelo menos um item com quantidade > 0', 'error');
        setSaving(false);
        return;
      }

      const payload = {
        supplierId,
        discount: Number(discount) || 0,
        notes: notes || undefined,
        items: purchaseItemsData,
      };

      if (editingId) {
        await api.purchases.update(editingId, payload);
        show('Compra atualizada!');
      } else {
        const createdPurchase = await api.purchases.create(payload);

        // Auto-receive: collect expiry dates from purchase items
        const itemExpiryDates: Record<string, string> = {};
        for (const item of purchaseItems) {
          if (item.hasVariations && item.variations.length > 0) {
            for (const v of item.variations) {
              const varQty = v.stockQty || 0;
              if (varQty <= 0) continue;
              const expiryDate = item.expiryDates[v.name];
              if (expiryDate) {
                const varProductName = `${item.productName} - ${v.name}`;
                const matchingItem = createdPurchase.items?.find((pi: any) =>
                  pi.productName === varProductName
                );
                if (matchingItem) {
                  itemExpiryDates[matchingItem.id] = expiryDate;
                }
              }
            }
          } else if (item.simpleExpiryDate) {
            const matchingItem = createdPurchase.items?.find((pi: any) =>
              pi.productName === item.productName
            );
            if (matchingItem) {
              itemExpiryDates[matchingItem.id] = item.simpleExpiryDate;
            }
          }
        }

        const receivePayload: any = {};
        if (Object.keys(itemExpiryDates).length > 0) {
          receivePayload.itemExpiryDates = itemExpiryDates;
        }

        try {
          await api.purchases.receive(createdPurchase.id, receivePayload);
          show('Compra criada e recebida! Estoque atualizado.');
        } catch {
          // Non-critical: purchase created, user can receive manually
          show('Compra criada! Use o botão Receber para atualizar o estoque.');
        }
      }
      setFormOpen(false);
      setEditingId(null);
      loadPurchases();
    } catch (err: any) {
      console.error('handleCreate error:', err);
      const msg = err?.message || err?.error || 'Erro ao criar compra';
      show(msg, 'error');
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

  const handleOpenReceive = (purchase: any) => {
    setReceivingPurchase(purchase);
    setReceivingExpiryDates({});
    setReceiveOpen(true);
  };

  const handleConfirmReceive = async () => {
    if (!receivingPurchase) return;
    const body: any = {};
    const dates = Object.entries(receivingExpiryDates).filter(([, v]) => v);
    if (dates.length > 0) {
      body.itemExpiryDates = Object.fromEntries(dates);
    }
    try {
      await api.purchases.receive(receivingPurchase.id, body);
      show('Compra recebida! Lotes PEPS criados e estoque atualizado.');
      setReceiveOpen(false);
      setReceivingPurchase(null);
      setReceivingExpiryDates({});
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

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Abastecimento</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">{total} compras registradas</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white rounded-xl font-medium text-xs sm:text-sm transition-colors"
          >
            <Upload size={14} className="sm:w-4 sm:h-4" /> Importar
          </button>
          {tab === 'restock' ? (
            <button onClick={openForm}
              className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium text-xs sm:text-sm transition-colors shrink-0">
              <Plus size={14} className="sm:w-[18px] sm:h-[18px]" /> Nova Compra
            </button>
          ) : (
            <button onClick={() => setWizardOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium text-xs sm:text-sm transition-colors shrink-0">
              <Sparkles size={14} className="sm:w-[18px] sm:h-[18px]" /> Novo Produto + Compra
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('restock')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all
            ${tab === 'restock'
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'}`}>
          <RefreshCw size={16} /> Reposição de Estoque
        </button>
        <button
          onClick={() => setTab('new-product')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all
            ${tab === 'new-product'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'}`}>
          <Sparkles size={16} /> Novo Produto + Compra
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

      {/* Content — Tab: Reposição de Estoque */}
      {tab === 'restock' && (
        <>
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
              <button onClick={openForm} className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm">Criar primeira compra</button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {purchases.map((p: any) => (
              <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-3 sm:p-4 flex flex-wrap items-center gap-2 sm:gap-4 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => toggleExpand(p.id)}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PURCHASE_STATUS[p.status]?.color || 'bg-slate-600'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-semibold text-sm">#{p.orderNumber}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${PURCHASE_STATUS[p.status]?.color || 'bg-slate-600'} text-white`}>
                        {PURCHASE_STATUS[p.status]?.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">{p.supplier?.name || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-semibold text-sm">R$ {Number(p.total).toFixed(2)}</p>
                    <p className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    {p.status === 'DRAFT' && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                          className="p-1 sm:p-1.5 text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors" title="Editar">
                          <Pencil size={15} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleOpenReceive(p); }}
                          className="p-1 sm:p-1.5 text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors" title="Receber">
                          <Check size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleCancel(p.id); }}
                          className="p-1 sm:p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Cancelar">
                          <X size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                          className="p-1 sm:p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors" title="Excluir">
                          <X size={15} />
                        </button>
                      </>
                    )}
                    {expanded === p.id ? <ChevronUp size={18} className="text-slate-500 flex-shrink-0" /> : <ChevronDown size={18} className="text-slate-500 flex-shrink-0" />}
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
        </>
      )}

      {/* Content — Tab: Novo Produto + Compra */}
      {tab === 'new-product' && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6">
            <Sparkles size={36} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Novo Produto + Compra</h2>
          <p className="text-slate-400 max-w-md mb-8">
            Cadastre um produto que ainda não existe no sistema e já dê entrada no estoque com a compra.
            Tudo em um único fluxo: fornecedor, produto, custos e variações.
          </p>
          <button
            onClick={() => setWizardOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20"
          >
            <Sparkles size={18} /> Iniciar Cadastro
          </button>
          <p className="text-xs text-slate-600 mt-4">
            Se o produto já existe no sistema, use a aba <strong className="text-indigo-400">Reposição de Estoque</strong>.
          </p>
        </div>
      )}

      {/* ========== CREATE MODAL (simplified) ========== */}
      <Modal open={formOpen} onClose={() => { setFormOpen(false); setEditingId(null); }} title={editingId ? 'Editar Compra' : 'Nova Compra'} size="lg" closeOnOverlayClick={false}>
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

            {/* Product search / scanner toggle */}
            {scannerOpen ? (
              <div className="mb-3">
                <BarcodeScanner
                  isOpen={scannerOpen}
                  onClose={() => setScannerOpen(false)}
                  onDetected={(product) => {
                    setScannerOpen(false);
                    selectProduct(product);
                  }}
                  onCodeScanned={(code: string) => {
                    setScannerOpen(false);
                    setProductSearch(code);
                    show(`Código ${code} não cadastrado. Use "Novo Produto + Compra" para cadastrar.`, 'error');
                  }}
                  onError={(msg) => show(msg, 'error')}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={productSearch}
                    onChange={(e) => searchProducts(e.target.value)}
                    placeholder="Buscar produto por nome, SKU..."
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
                <button
                  onClick={() => setScannerOpen(true)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors shrink-0"
                  title="Escanear código de barras"
                >
                  <Scan size={18} />
                </button>
              </div>
            )}

            {/* Selected product info */}
            {currentItem.productId ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white text-sm font-medium">✓ {currentItem.productName}</p>
                  {currentItem.hasVariations && (
                    <span className="text-[11px] text-indigo-400">{currentItem.variations.length} variacoes</span>
                  )}
                </div>

                {/* Precificacao: 5 campos — custo un, custo oper, taxa, margem, preco venda */}
                <div className="bg-slate-900 rounded-lg p-3 mb-3">
                  <div className="grid grid-cols-5 gap-2">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Custo Un. (R$)</label>
                      <input type="number"
                        value={currentItem.costPrice || ''}
                        onChange={(e) => {
                          const cost = Number(e.target.value);
                          const updated = { ...currentItem, costPrice: cost };
                          setCurrentItem({ ...updated, salePrice: calcSalePrice(updated) });
                        }}
                        min="0" step="0.01" placeholder="0,00"
                        className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm text-center focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Custo Oper. (R$)</label>
                      <input type="number"
                        value={currentItem.operationalCost || ''}
                        onChange={(e) => {
                          const op = Number(e.target.value);
                          const updated = { ...currentItem, operationalCost: op };
                          setCurrentItem({ ...updated, salePrice: calcSalePrice(updated) });
                        }}
                        min="0" step="0.01" placeholder="0,00"
                        className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm text-center focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Taxa %</label>
                      <input type="number"
                        value={currentItem.taxRatePct || ''}
                        onChange={(e) => {
                          const tax = Number(e.target.value);
                          const updated = { ...currentItem, taxRatePct: tax };
                          setCurrentItem({ ...updated, salePrice: calcSalePrice(updated) });
                        }}
                        min="0" max="100" step="0.1" placeholder="0"
                        className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm text-center focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Margem %</label>
                      <input type="number"
                        value={currentItem.marginPct || ''}
                        onChange={(e) => {
                          const margin = Number(e.target.value);
                          const updated = { ...currentItem, marginPct: margin };
                          setCurrentItem({ ...updated, salePrice: calcSalePrice(updated) });
                        }}
                        min="0" max="100" step="0.1" placeholder="0"
                        className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm text-center focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Pr. Venda (R$)</label>
                      <input type="number"
                        value={currentItem.salePrice || ''}
                        onChange={(e) => {
                          const price = Number(e.target.value);
                          // Quando edita preço, recalcula a margem
                          const updated = { ...currentItem, salePrice: price };
                          setCurrentItem({ ...updated, marginPct: calcMarginFromSale(updated) });
                        }}
                        min="0" step="0.01" placeholder="Auto"
                        className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm text-center focus:border-indigo-500 outline-none" />
                    </div>
                  </div>
                  {/* Linha de resumo */}
                  {totalCost(currentItem) > 0 && currentItem.salePrice > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="text-xs text-slate-400 text-center">
                        <span className="text-slate-500">Margem</span>{' '}
                        <span className="text-emerald-400 font-semibold">{(((currentItem.salePrice - costWithTax(currentItem)) / currentItem.salePrice) * 100).toFixed(1)}%</span>
                        <span className="mx-2 text-slate-700">|</span>
                        <span className="text-slate-500">Markup</span>{' '}
                        <span className="text-indigo-400 font-semibold">{((currentItem.salePrice / totalCost(currentItem) - 1) * 100).toFixed(1)}%</span>
                        <span className="mx-2 text-slate-700">|</span>
                        <span className="text-slate-500">Custo total</span>{' '}
                        <span className="text-white font-medium">R$ {costWithTax(currentItem).toFixed(2)}</span>
                        <span className="mx-2 text-slate-700">|</span>
                        <span className="text-slate-500">Lucro est.</span>{' '}
                        <span className="text-emerald-400 font-semibold">R$ {(currentItem.salePrice - costWithTax(currentItem)).toFixed(2)}</span>
                      </div>
                      {/* Legenda */}
                      <div className="flex items-center justify-center gap-1 text-[10px] text-slate-600">
                        <Info size={10} />
                        <span><strong>Margem</strong> = % do preço que é lucro (já com taxa).</span>
                        <span className="mx-1 text-slate-700">|</span>
                        <span><strong>Markup</strong> = % que o preço está acima do custo base (sem taxa).</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Variations */}
                {currentItem.hasVariations && templateDims.length > 0 ? (
                  /* ── Template-based: row builder with dropdowns ── */
                  <div className="mb-3 bg-slate-900 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-2">Variações da compra</p>

                    {/* Tabela de linhas já adicionadas */}
                    {currentItem.variations.length > 0 && (
                      <div className="mb-3 bg-slate-800 rounded-lg divide-y divide-slate-700 max-h-40 overflow-y-auto">
                        <div className="grid gap-2 px-3 py-1.5 text-xs text-slate-500 bg-slate-800/50"
                          style={{ gridTemplateColumns: `repeat(${templateDims.length}, 1fr) 44px 128px 36px` }}>
                          {templateDims.map((d: any) => (
                            <span key={d.id || d.label}>{d.label}</span>
                          ))}
                          <span className="text-center">Qtd</span>
                          <span className="text-center">Validade</span>
                          <span />
                        </div>
                        {currentItem.variations.map((v, vi) => {
                          const parts = v.name.includes(' / ') ? v.name.split(' / ') : v.name.split(' ');
                          return (
                            <div key={vi}
                              className="grid gap-2 px-3 py-1.5 items-center text-sm"
                              style={{ gridTemplateColumns: `repeat(${templateDims.length}, 1fr) 44px 128px 36px` }}>
                              {parts.map((part: string, pi: number) => (
                                <span key={pi} className="text-white truncate">{part}</span>
                              ))}
                              <input type="number" value={v.stockQty || ''} onChange={(e) => {
                                const updated = [...currentItem.variations];
                                updated[vi] = { ...updated[vi], stockQty: Number(e.target.value) };
                                setCurrentItem({ ...currentItem, variations: updated });
                              }}
                                min="0" step="1" placeholder="0"
                                className="w-full px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-white text-xs text-center focus:border-indigo-500 outline-none" />
                              <input type="date" value={currentItem.expiryDates[v.name] || ''} onChange={(e) => {
                                setCurrentItem({ ...currentItem, expiryDates: { ...currentItem.expiryDates, [v.name]: e.target.value } });
                              }}
                                className="w-full px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-white text-[10px] focus:border-indigo-500 outline-none" />
                              <button
                                onClick={() => {
                                  const updated = currentItem.variations.filter((_, i) => i !== vi);
                                  setCurrentItem({ ...currentItem, variations: updated });
                                }}
                                className="text-slate-500 hover:text-red-400 justify-self-center">
                                <X size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Linha para adicionar nova variação */}
                    <div className="bg-slate-800 rounded-lg p-2">
                      <div className="grid gap-2 items-end"
                        style={{ gridTemplateColumns: `repeat(${templateDims.length}, 1fr) 48px 128px 36px` }}>
                        {templateDims.map((d: any) => {
                          const isCustom = rowDims[d.label] === '__custom__';
                          return (
                            <div key={d.id || d.label}>
                              <label className="block text-[10px] text-slate-500 mb-0.5">{d.label}</label>
                              <select
                                value={isCustom ? '__custom__' : (rowDims[d.label] || '')}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setRowDims({ ...rowDims, [d.label]: val });
                                  if (val !== '__custom__') {
                                    const next = { ...rowCustom };
                                    delete next[d.label];
                                    setRowCustom(next);
                                  }
                                }}
                                className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-xs focus:border-indigo-500 outline-none">
                                <option value="">—</option>
                                {d.options.map((opt: string) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                                <option value="__custom__">Outro...</option>
                              </select>
                              {isCustom && (
                                <input
                                  type="text"
                                  value={rowCustom[d.label] || ''}
                                  onChange={(e) => setRowCustom({ ...rowCustom, [d.label]: e.target.value })}
                                  placeholder="Digite..."
                                  className="mt-1 w-full px-2 py-1.5 bg-slate-700 border border-slate-500 rounded text-white text-xs focus:border-indigo-500 outline-none"
                                />
                              )}
                            </div>
                          );
                        })}
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Qtd</label>
                          <input type="number" value={rowQty || ''}
                            onChange={(e) => setRowQty(Number(e.target.value))}
                            min="0" step="1" placeholder="0"
                            className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-xs text-center focus:border-indigo-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Validade</label>
                          <input type="date" value={rowExpiryDate}
                            onChange={(e) => setRowExpiryDate(e.target.value)}
                            className="w-full px-1 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-[10px] focus:border-indigo-500 outline-none" />
                        </div>
                        <button
                          onClick={() => {
                            const hasAtLeastOne = templateDims.some((d: any) => {
                              const val = rowDims[d.label];
                              if (!val) return false;
                              if (val === '__custom__') return (rowCustom[d.label] || '').trim().length > 0;
                              return true;
                            });
                            if (!hasAtLeastOne || rowQty <= 0) return;
                            const name = templateDims.map((d: any) => {
                              const val = rowDims[d.label];
                              if (!val) return '';
                              return val === '__custom__' ? rowCustom[d.label].trim() : val;
                            }).filter(Boolean).join(' / ');
                            setCurrentItem({
                              ...currentItem,
                              variations: [
                                ...currentItem.variations,
                                { id: undefined, name, priceModifier: 0, stockQty: rowQty, lowStockAt: undefined },
                              ],
                              expiryDates: rowExpiryDate
                                ? { ...currentItem.expiryDates, [name]: rowExpiryDate }
                                : currentItem.expiryDates,
                            });
                            setRowDims({});
                            setRowCustom({});
                            setRowQty(0);
                            setRowExpiryDate('');
                          }}
                          disabled={!templateDims.some((d: any) => {
                            const val = rowDims[d.label];
                            if (!val) return false;
                            if (val === '__custom__') return (rowCustom[d.label] || '').trim().length > 0;
                            return true;
                          }) || rowQty <= 0}
                          className="self-end px-2 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white rounded text-sm font-bold transition-colors"
                          title="Adicionar variação">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-700 flex justify-between items-center">
                      <span className="text-xs text-slate-400">
                        Variações: <span className="text-white font-semibold">{currentItem.variations.length}</span>
                        <span className="mx-2">|</span>
                        Qtd total: <span className="text-white font-semibold">{effectiveQty}</span>
                      </span>
                    </div>
                  </div>
                ) : currentItem.hasVariations ? (
                  /* ── Existing variations: show list with qty inputs + manual add ── */
                  <div className="mb-3 bg-slate-900 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-2">Qtd comprada por variação</p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {currentItem.variations.map((v, vi) => (
                        <div key={v.id || vi} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-1.5">
                          <span className="text-sm text-white flex-1 truncate">{v.name}</span>
                          <input type="number" value={v.stockQty || ''} onChange={(e) => {
                            const updated = [...currentItem.variations];
                            updated[vi] = { ...updated[vi], stockQty: Number(e.target.value) };
                            setCurrentItem({ ...currentItem, variations: updated });
                          }}
                            min="0" step="1" placeholder="0"
                            className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm text-center focus:border-indigo-500 outline-none" />
                          <input type="date" value={currentItem.expiryDates[v.name] || ''} onChange={(e) => {
                            setCurrentItem({ ...currentItem, expiryDates: { ...currentItem.expiryDates, [v.name]: e.target.value } });
                          }}
                            className="w-28 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs focus:border-indigo-500 outline-none" />
                          <button
                            onClick={() => {
                              const updated = currentItem.variations.filter((_, i) => i !== vi);
                              setCurrentItem({ ...currentItem, variations: updated });
                            }}
                            className="text-slate-500 hover:text-red-400 shrink-0">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {/* Add new variation manually (no template) */}
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={newVarName}
                        onChange={(e) => setNewVarName(e.target.value)}
                        placeholder="Nova variação (ex: GG)"
                        className="flex-1 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-xs focus:border-indigo-500 outline-none"
                      />
                      <input
                        type="number"
                        value={newVarQty || ''}
                        onChange={(e) => setNewVarQty(Number(e.target.value))}
                        min="0" step="1" placeholder="0"
                        className="w-16 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-xs text-center focus:border-indigo-500 outline-none"
                      />
                      <input
                        type="date"
                        value={newVarExpiryDate}
                        onChange={(e) => setNewVarExpiryDate(e.target.value)}
                        className="w-28 px-1 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-[10px] focus:border-indigo-500 outline-none"
                      />
                      <button
                        onClick={() => {
                          const name = newVarName.trim();
                          if (!name || newVarQty <= 0) return;
                          // Check if variation already exists (avoid duplicate)
                          const existingIdx = currentItem.variations.findIndex(
                            (v: any) => v.name.toLowerCase() === name.toLowerCase()
                          );
                          if (existingIdx >= 0) {
                            // Update quantity of existing variation
                            const updated = [...currentItem.variations];
                            updated[existingIdx] = { ...updated[existingIdx], stockQty: (updated[existingIdx].stockQty || 0) + newVarQty };
                            const expiryUpdate = newVarExpiryDate
                              ? { expiryDates: { ...currentItem.expiryDates, [name]: newVarExpiryDate } }
                              : {};
                            setCurrentItem({ ...currentItem, variations: updated, ...expiryUpdate });
                          } else {
                            setCurrentItem({
                              ...currentItem,
                              variations: [
                                ...currentItem.variations,
                                { id: undefined, name, priceModifier: 0, stockQty: newVarQty, lowStockAt: undefined },
                              ],
                              expiryDates: newVarExpiryDate
                                ? { ...currentItem.expiryDates, [name]: newVarExpiryDate }
                                : currentItem.expiryDates,
                            });
                          }
                          setNewVarName('');
                          setNewVarQty(0);
                          setNewVarExpiryDate('');
                        }}
                        disabled={!newVarName.trim() || newVarQty <= 0}
                        className="px-2 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white rounded text-sm font-bold transition-colors shrink-0"
                        title="Adicionar variação">
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-700 flex justify-between items-center">
                      <span className="text-xs text-slate-400">
                        Qtd total: <span className="text-white font-semibold">{effectiveQty}</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  /* ── Simple product: single quantity ── */
                  <div className="mb-3">
                    <div className="flex items-center gap-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Qtd Comprada</label>
                        <input type="number" value={currentItem.quantity || ''} onChange={(e) => setCurrentItem({ ...currentItem, quantity: Number(e.target.value) })}
                          min="0.001" step="any" placeholder="1"
                          className="w-32 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm text-center focus:border-indigo-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Data de Validade</label>
                        <input type="date" value={currentItem.simpleExpiryDate} onChange={(e) => setCurrentItem({ ...currentItem, simpleExpiryDate: e.target.value })}
                          className="w-40 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Add item button */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                  <span className="text-xs text-slate-500">
                    Total custo: <span className="text-white font-semibold">R$ {(currentItem.costPrice * effectiveQty).toFixed(2)}</span>
                    {currentItem.salePrice > 0 && (
                      <span className="ml-2 text-emerald-400">| Preço: R$ {currentItem.salePrice.toFixed(2)}</span>
                    )}
                  </span>
                  <button onClick={addCurrentItem}
                    disabled={!currentItem.productId || effectiveQty <= 0}
                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                    <Plus size={14} className="inline mr-1" /> Adicionar a Compra
                  </button>
                </div>
              </>
            ) : (
              <p className="text-slate-600 text-sm">Busque e selecione um produto acima</p>
            )}
          </div>

          {/* ── 5. Items list ── */}
          {purchaseItems.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Produtos na Compra ({purchaseItems.length})</h3>
              <div className="bg-slate-800 rounded-lg divide-y divide-slate-700 max-h-52 overflow-y-auto">
                {purchaseItems.map((item, idx) => (
                  <div key={idx} className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{item.productName}</p>
                        {item.salePrice > 0 && (
                          <p className="text-xs text-slate-400">
                            Venda: R$ {item.salePrice.toFixed(2)}
                            {item.taxRatePct > 0 && <span className="ml-2 text-slate-500">Tx: {item.taxRatePct}%</span>}
                            {item.marginPct > 0 && <span className="ml-2 text-slate-500">Mg: {item.marginPct}%</span>}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm text-white font-medium">{item.quantity}</p>
                        <p className="text-xs text-slate-500">R$ {(item.costPrice * item.quantity).toFixed(2)}</p>
                      </div>
                      <button onClick={() => removeItem(idx)} className="p-1 text-slate-500 hover:text-red-400">
                        <X size={14} />
                      </button>
                    </div>
                    {/* Variation breakdown */}
                    {item.hasVariations && item.variations.filter((v: any) => (v.stockQty || 0) > 0).length > 0 && (
                      <div className="mt-1 ml-2 pl-2 border-l-2 border-slate-700 space-y-0.5">
                        {item.variations.filter((v: any) => (v.stockQty || 0) > 0).map((v: any) => (
                          <div key={v.id || v.name} className="flex justify-between text-xs">
                            <span className="text-slate-400">{v.name}</span>
                            <span className="text-slate-500">{v.stockQty} un. — R$ {(item.costPrice * v.stockQty).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
              {saving ? 'Salvando...' : (editingId ? `Salvar Alterações (R$ ${itemsTotal.toFixed(2)})` : `Criar Compra (R$ ${itemsTotal.toFixed(2)})`)}
            </button>
          </div>
        </div>
      </Modal>

      {/* Receive Modal (with expiry dates) */}
      <Modal open={receiveOpen} onClose={() => { setReceiveOpen(false); setReceivingPurchase(null); }} title="Confirmar Recebimento" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Confirme o recebimento da compra <strong className="text-white">#{receivingPurchase?.orderNumber}</strong>.
          </p>
          <div className="space-y-3">
            <p className="text-xs text-slate-500 font-medium">Data de validade (opcional — preencha para produtos perecíveis)</p>
            {receivingPurchase?.items?.map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 bg-slate-800 rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{item.productName}</p>
                  <p className="text-xs text-slate-500">Qtd: {item.quantity} | Custo: R$ {Number(item.unitCost).toFixed(2)}</p>
                </div>
                <input
                  type="date"
                  value={receivingExpiryDates[item.id] || ''}
                  onChange={(e) => setReceivingExpiryDates(prev => ({ ...prev, [item.id]: e.target.value }))}
                  className="px-2.5 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-xs focus:border-indigo-500 outline-none w-36 flex-shrink-0"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
            <button onClick={() => { setReceiveOpen(false); setReceivingPurchase(null); }} className="px-4 py-2 text-slate-400 text-sm hover:text-white">Cancelar</button>
            <button onClick={handleConfirmReceive} className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
              Confirmar Recebimento
            </button>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => loadPurchases()}
        config={IMPORT_CONFIGS.purchases}
      />

      {/* New Product + Purchase Wizard */}
      <NewProductPurchaseWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => loadPurchases()}
      />

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
