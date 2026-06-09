'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Search, Scan, ChevronDown, Info, Upload, X, Check, Package } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Modal } from '@/components/ui/Modal';
import type { VariationData } from '@/components/products/VariationEditor';
import api, { type CategoryWithCount, type VariationTemplate } from '@/lib/api';

const BarcodeScanner = dynamic(
  () => import('@/components/products/BarcodeScanner').then(m => ({ default: m.BarcodeScanner })),
  { ssr: false }
);

interface NewProductPurchaseWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

// ─── Pricing helpers (same logic as purchases page) ───
const totalCost = (cost: number, operational: number) => cost + operational;

const calcSalePrice = (cost: number, operational: number, tax: number, margin: number): number => {
  const c = totalCost(cost, operational);
  if (c <= 0) return 0;
  const divisor = 1 - (tax / 100) - (margin / 100);
  if (divisor <= 0) return 0;
  return Math.round((c / divisor) * 100) / 100;
};

const calcMarginFromSale = (cost: number, operational: number, tax: number, price: number): number => {
  const c = totalCost(cost, operational);
  if (c <= 0 || price <= 0) return 0;
  const margin = (1 - (tax / 100) - (c / price)) * 100;
  return Math.round(margin * 10) / 10;
};

const costWithTax = (cost: number, operational: number, tax: number, price: number): number => {
  const taxAmount = price > 0 ? price * (tax / 100) : 0;
  return cost + operational + taxAmount;
};

// ─── Image compression ───
function compressImage(file: File, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      canvas.width = w;
      canvas.height = h;
      ctx?.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(file);
    };
    img.src = url;
  });
}

// ─── Accumulated product data (for multi-product purchases) ───
interface AccumulatedProduct {
  productName: string;
  productSku: string;
  productBarcode: string;
  productDescription: string;
  categoryId: string;
  productPrice: string;
  lowStockAt: string;
  productImage: string | null;
  selectedTemplate: VariationTemplate | null;
  variations: VariationData[];
  variationExpiryDates: Record<string, string>;
  costPrice: number;
  operationalCost: number;
  taxRatePct: number;
  marginPct: number;
  salePrice: number;
  simpleQty: number;
  simpleExpiryDate: string;
}

export function NewProductPurchaseWizard({ open, onClose, onCreated }: NewProductPurchaseWizardProps) {
  // ─── Accordion steps ───
  const [expandedStep, setExpandedStep] = useState<'supplier' | 'product' | 'review'>('supplier');
  const [supplierDone, setSupplierDone] = useState(false);

  // ─── Accumulated products ───
  const [accumulatedProducts, setAccumulatedProducts] = useState<AccumulatedProduct[]>([]);

  // ─── Toast ───
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const show = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Step 1: Supplier ───
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [useNewSupplier, setUseNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');

  // ─── Step 2: Product ───
  const [productName, setProductName] = useState('');
  const [productSku, setProductSku] = useState('');
  const [productBarcode, setProductBarcode] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [lowStockAt, setLowStockAt] = useState('');
  const [productImage, setProductImage] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<VariationTemplate | null>(null);
  const [variations, setVariations] = useState<VariationData[]>([]);
  const [rowDims, setRowDims] = useState<Record<string, string>>({});
  const [rowCustom, setRowCustom] = useState<Record<string, string>>({});
  const [rowQty, setRowQty] = useState<number>(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ─── Step 2 inline costs ───
  const [costPrice, setCostPrice] = useState<number>(0);
  const [operationalCost, setOperationalCost] = useState<number>(0);
  const [taxRatePct, setTaxRatePct] = useState<number>(0);
  const [marginPct, setMarginPct] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);
  // Simple product quantity + expiry
  const [simpleQty, setSimpleQty] = useState<number>(1);
  const [simpleExpiryDate, setSimpleExpiryDate] = useState('');
  // Expiry dates per variation name
  const [variationExpiryDates, setVariationExpiryDates] = useState<Record<string, string>>({});

  // ─── Step 3: Review (discount + dates) ───
  const [discount, setDiscount] = useState('0');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [receivedDate, setReceivedDate] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load data on open
  useEffect(() => {
    if (!open) return;
    setError('');
    loadSuppliers();
    loadCategories();
  }, [open]);

  const loadSuppliers = async () => {
    try {
      const data = await api.suppliers.list({ active: true });
      setSuppliers(data.suppliers || []);
    } catch { /* silently fail */ }
  };

  const loadCategories = async () => {
    try {
      const data = await api.categories.list();
      setCategories(data);
    } catch { /* silently fail */ }
  };

  // When category changes, load its template
  useEffect(() => {
    const cat = categories.find(c => c.id === categoryId);
    setSelectedTemplate(cat?.variationTemplate || null);
    // Reset variations when category changes
    if (!cat?.variationTemplate) {
      setVariations([]);
    }
  }, [categoryId, categories]);

  // When salePrice changes from pricing, sync to productPrice
  useEffect(() => {
    if (salePrice > 0 && !productPrice) {
      setProductPrice(String(salePrice));
    }
  }, [salePrice]);

  // ─── Step navigation ───
  const advanceToProduct = () => {
    if (!selectedSupplier && !(useNewSupplier && newSupplierName.trim())) {
      show('Selecione ou informe o fornecedor', 'error');
      return;
    }
    setSupplierDone(true);
    setExpandedStep('product');
  };

  // Reset product form fields (keep supplier)
  const resetProductForm = () => {
    setProductName('');
    setProductSku('');
    setProductBarcode('');
    setProductDescription('');
    setCategoryId('');
    setProductPrice('');
    setLowStockAt('');
    setProductImage(null);
    setSelectedTemplate(null);
    setVariations([]);
    setRowDims({});
    setRowCustom({});
    setRowQty(0);
    setCostPrice(0);
    setOperationalCost(0);
    setTaxRatePct(0);
    setMarginPct(0);
    setSalePrice(0);
    setSimpleQty(1);
    setSimpleExpiryDate('');
    setVariationExpiryDates({});
  };

  // Add current product to the purchase accumulator
  const addToPurchase = () => {
    if (!productName.trim()) {
      show('Informe o nome do produto', 'error');
      return;
    }
    if (selectedTemplate) {
      const varsWithQty = variations.filter(v => (v.stockQty || 0) > 0);
      if (varsWithQty.length === 0) {
        show('Adicione pelo menos uma variação com quantidade', 'error');
        return;
      }
    }
    if (costPrice <= 0) {
      show('Informe o custo unitário', 'error');
      return;
    }
    const qty = selectedTemplate
      ? variations.reduce((sum, v) => sum + (v.stockQty || 0), 0)
      : (simpleQty || 1);
    if (qty <= 0) {
      show('Quantidade deve ser maior que zero', 'error');
      return;
    }

    const newProduct: AccumulatedProduct = {
      productName: productName.trim(),
      productSku: productSku.trim(),
      productBarcode: productBarcode.trim(),
      productDescription: productDescription.trim(),
      categoryId,
      productPrice,
      lowStockAt,
      productImage,
      selectedTemplate,
      variations: [...variations],
      variationExpiryDates: { ...variationExpiryDates },
      costPrice,
      operationalCost,
      taxRatePct,
      marginPct,
      salePrice,
      simpleQty,
      simpleExpiryDate,
    };

    setAccumulatedProducts(prev => [...prev, newProduct]);
    resetProductForm();
    show(`"${newProduct.productName}" adicionado à compra!`);
  };

  const removeFromPurchase = (index: number) => {
    setAccumulatedProducts(prev => prev.filter((_, i) => i !== index));
  };

  // ─── Image upload ───
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImage(file, 800, 0.7);
      setProductImage(base64);
    } catch {
      show('Erro ao processar imagem', 'error');
    }
  };

  // ─── Barcode scanner callback ───
  const handleBarcodeDetected = (product: any) => {
    setProductBarcode(product.barcode || '');
    setScannerOpen(false);
  };

  // ─── FINALIZE: Create all products + one purchase ───
  const handleFinalize = async () => {
    if (accumulatedProducts.length === 0) {
      show('Adicione pelo menos um produto à compra', 'error');
      return;
    }

    // Validate supplier
    if (!selectedSupplier && !(useNewSupplier && newSupplierName.trim())) {
      show('Selecione ou informe o fornecedor', 'error');
      return;
    }

    setSaving(true);
    setError('');
    try {
      // 1. Resolve supplier
      let supplierId = selectedSupplier;
      if (useNewSupplier && newSupplierName.trim()) {
        const newSup = await api.suppliers.create({ name: newSupplierName.trim() });
        supplierId = newSup.id;
      }

      // 2. Create all products and collect purchase items
      const purchaseItems: any[] = [];
      const createdProductIds: string[] = [];

      for (const prod of accumulatedProducts) {
        // Create product
        const productPayload: any = {
          name: prod.productName,
          description: prod.productDescription || undefined,
          barcode: prod.productBarcode || undefined,
          sku: prod.productSku || undefined,
          categoryId: prod.categoryId || undefined,
          imageUrl: prod.productImage || undefined,
        };
        if (prod.productPrice) productPayload.price = parseFloat(prod.productPrice);
        if (prod.lowStockAt) productPayload.lowStockAt = parseFloat(prod.lowStockAt);

        const created = await api.products.create(productPayload);
        const productId = created.id;
        createdProductIds.push(productId);

        // Create variations if any (stockQty=0 — stock comes from purchase receive)
        if (prod.variations.length > 0) {
          for (const v of prod.variations) {
            await api.products.addVariation(productId, {
              name: v.name,
              stockQty: 0,
              lowStockAt: v.lowStockAt,
              priceModifier: v.priceModifier,
              sku: v.sku,
              barcode: v.barcode,
            });
          }
        }

        // Build purchase items for this product
        if (prod.variations.filter(v => (v.stockQty || 0) > 0).length > 0) {
          // Has variations with quantity
          const freshProduct = await api.products.get(productId);
          for (const v of prod.variations) {
            const varQty = v.stockQty || 0;
            if (varQty <= 0) continue;
            const matchingVar = freshProduct.variations?.find((pv: any) => pv.name === v.name);
            purchaseItems.push({
              productId,
              variationId: matchingVar?.id || undefined,
              productName: `${prod.productName} - ${v.name}`,
              quantity: varQty,
              unitCost: prod.costPrice,
              total: prod.costPrice * varQty,
              salePrice: prod.salePrice || undefined,
              operationalCost: prod.operationalCost || undefined,
              taxRatePct: prod.taxRatePct || undefined,
              marginPct: prod.marginPct || undefined,
            });
          }
        } else {
          // Simple product
          const qty = prod.simpleQty || 1;
          purchaseItems.push({
            productId,
            productName: prod.productName,
            quantity: qty,
            unitCost: prod.costPrice,
            total: prod.costPrice * qty,
            salePrice: prod.salePrice || undefined,
            operationalCost: prod.operationalCost || undefined,
            taxRatePct: prod.taxRatePct || undefined,
            marginPct: prod.marginPct || undefined,
          });
        }
      }

      if (purchaseItems.length === 0) {
        show('Nenhum item com quantidade > 0', 'error');
        setSaving(false);
        return;
      }

      // 3. Create ONE purchase with all items
      const payload: any = {
        supplierId,
        discount: Number(discount) || 0,
        items: purchaseItems,
      };
      if (purchaseDate) payload.purchaseDate = purchaseDate;
      const createdPurchase = await api.purchases.create(payload);

      // 4. Auto-receive the purchase
      if (createdPurchase?.id) {
        try {
          const expiryPayload: any = {};
          if (receivedDate) expiryPayload.receivedDate = receivedDate;

          // Collect all expiry dates from accumulated products
          const itemExpiryDates: Record<string, string> = {};
          for (const prod of accumulatedProducts) {
            for (const [varName, dateStr] of Object.entries(prod.variationExpiryDates)) {
              if (!dateStr) continue;
              const matchingItem = createdPurchase.items?.find((item: any) =>
                item.productName?.endsWith(` - ${varName}`)
              );
              if (matchingItem) {
                itemExpiryDates[matchingItem.id] = dateStr;
              }
            }
            if (prod.simpleExpiryDate) {
              const matchingItem = createdPurchase.items?.find((item: any) =>
                item.productName === prod.productName
              );
              if (matchingItem) {
                itemExpiryDates[matchingItem.id] = prod.simpleExpiryDate;
              }
            }
          }
          if (Object.keys(itemExpiryDates).length > 0) {
            expiryPayload.itemExpiryDates = itemExpiryDates;
          }

          await api.purchases.receive(createdPurchase.id, expiryPayload);
        } catch {
          // Non-critical: purchase was created, user can receive manually
        }
      }

      const productCount = createdProductIds.length;
      show(`${productCount} produto(s) criado(s), compra recebida e estoque atualizado!`);
      setTimeout(() => {
        onCreated();
        resetForm();
        onClose();
      }, 1000);
    } catch (err: any) {
      const msg = err?.message || err?.error || 'Erro ao finalizar';
      setError(msg);
      show(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSupplierDone(false);
    setExpandedStep('supplier');
    setSelectedSupplier('');
    setUseNewSupplier(false);
    setNewSupplierName('');
    resetProductForm();
    setAccumulatedProducts([]);
    setDiscount('0');
    setPurchaseDate('');
    setReceivedDate('');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // ─── Render helpers ───
  const stepIcon = (step: 'supplier' | 'product' | 'review', done: boolean) => {
    if (done) return <Check size={18} className="text-emerald-400" />;
    const isActive = expandedStep === step;
    const num = step === 'supplier' ? 1 : step === 'product' ? 2 : 3;
    return (
      <span className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[11px] font-bold
        ${isActive ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
        {num}
      </span>
    );
  };

  // Total cost of all accumulated products
  const accumulatedTotalCost = accumulatedProducts.reduce((sum, p) => {
    const qty = p.selectedTemplate
      ? p.variations.reduce((s, v) => s + (v.stockQty || 0), 0)
      : (p.simpleQty || 1);
    return sum + p.costPrice * qty;
  }, 0);

  const isReviewReady = supplierDone && accumulatedProducts.length > 0;

  return (
    <Modal open={open} onClose={handleClose} title="Novo Produto + Compra" size="lg" closeOnOverlayClick={false}>
      <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">

        {error && (
          <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300"><X size={16} /></button>
          </div>
        )}

        {/* ════ STEP 1: FORNECEDOR ════ */}
        <div className="bg-slate-800/50 rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandedStep(expandedStep === 'supplier' ? 'review' : 'supplier')}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors"
          >
            {stepIcon('supplier', supplierDone)}
            <span className={`text-sm font-semibold flex-1 text-left ${supplierDone ? 'text-emerald-400' : 'text-white'}`}>
              1. Fornecedor
            </span>
            {supplierDone && (
              <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                {useNewSupplier ? newSupplierName : suppliers.find(s => s.id === selectedSupplier)?.name || ''}
              </span>
            )}
            <ChevronDown size={16} className={`text-slate-500 transition-transform ${expandedStep === 'supplier' ? 'rotate-180' : ''}`} />
          </button>

          {expandedStep === 'supplier' && (
            <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
              {!useNewSupplier ? (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Selecionar Fornecedor *</label>
                  <select
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
                  >
                    <option value="">Selecionar...</option>
                    {suppliers.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nome do Fornecedor *</label>
                  <input
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    placeholder="Digite o nome..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useNewSupplier}
                  onChange={(e) => { setUseNewSupplier(e.target.checked); setSelectedSupplier(''); }}
                  className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0"
                />
                <span className="text-sm text-slate-400">Novo fornecedor</span>
              </label>

              <button
                onClick={advanceToProduct}
                disabled={!selectedSupplier && !(useNewSupplier && newSupplierName.trim())}
                className="w-full px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Avançar → Produto
              </button>
            </div>
          )}
        </div>

        {/* ════ STEP 2: PRODUTO + CUSTOS ════ */}
        <div className="bg-slate-800/50 rounded-xl overflow-hidden">
          <button
            onClick={() => supplierDone && setExpandedStep(expandedStep === 'product' ? 'review' : 'product')}
            disabled={!supplierDone}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {stepIcon('product', false)}
            <span className="text-sm font-semibold flex-1 text-left text-white">
              2. Produto + Custos
            </span>
            {accumulatedProducts.length > 0 && (
              <span className="text-[11px] text-indigo-400">
                {accumulatedProducts.length} prod.
              </span>
            )}
            <ChevronDown size={16} className={`text-slate-500 transition-transform ${expandedStep === 'product' ? 'rotate-180' : ''}`} />
          </button>

          {expandedStep === 'product' && supplierDone && (
            <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
              {/* Nome */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nome do Produto *</label>
                  <input
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Nome do produto"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Categoria</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.variationTemplate ? `(${c.variationTemplate.name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SKU + Barcode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">SKU (Código Interno)</label>
                  <input
                    value={productSku}
                    onChange={(e) => setProductSku(e.target.value)}
                    placeholder="Gerado automaticamente"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Código de Barras</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        value={productBarcode}
                        onChange={(e) => setProductBarcode(e.target.value)}
                        placeholder="Escanear ou digitar"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <button
                      onClick={() => setScannerOpen(true)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors shrink-0"
                      title="Escanear código de barras"
                    >
                      <Scan size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {scannerOpen && (
                <BarcodeScanner
                  isOpen={scannerOpen}
                  onClose={() => setScannerOpen(false)}
                  onDetected={handleBarcodeDetected}
                  onCodeScanned={(code: string) => {
                    setProductBarcode(code);
                    setScannerOpen(false);
                  }}
                  onError={(msg: string) => show(msg, 'error')}
                />
              )}

              {/* Price + LowStock */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Preço de Venda (R$)</label>
                  <input
                    type="number"
                    value={productPrice}
                    onChange={(e) => { setProductPrice(e.target.value); if (e.target.value) setSalePrice(Number(e.target.value)); }}
                    min="0" step="0.01" placeholder="0,00"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Estoque Mínimo</label>
                  <input
                    type="number"
                    value={lowStockAt}
                    onChange={(e) => setLowStockAt(e.target.value)}
                    min="0" step="1" placeholder="0"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Descrição</label>
                <textarea
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  rows={2}
                  placeholder="Descrição do produto (opcional)"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none resize-none"
                />
              </div>

              {/* Image */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Imagem do Produto</label>
                <div className="flex items-center gap-3">
                  {productImage && (
                    <img src={productImage} alt="Preview" className="w-12 h-12 rounded-lg object-cover border border-slate-700" />
                  )}
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 text-sm transition-colors"
                  >
                    <Upload size={14} />
                    {productImage ? 'Trocar Imagem' : 'Upload Imagem'}
                  </button>
                  {productImage && (
                    <button onClick={() => setProductImage(null)} className="text-slate-500 hover:text-red-400">
                      <X size={14} />
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </div>
              </div>

              {/* Variation row builder with dropdowns (if category has template) */}
              {selectedTemplate && (() => {
                const dims = selectedTemplate.dimensions.map((d: any) => ({
                  ...d,
                  options: Array.isArray(d.options) ? d.options : (typeof d.options === 'string' ? JSON.parse(d.options) : []),
                }));
                return (
                <div className="bg-slate-900 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-2">
                    Variações — Template: <span className="text-indigo-400 font-medium">{selectedTemplate.name}</span>
                  </p>

                  {/* Table of added variations */}
                  {variations.length > 0 && (
                    <div className="mb-3 bg-slate-800 rounded-lg divide-y divide-slate-700 max-h-40 overflow-y-auto">
                      <div className="grid gap-2 px-3 py-1.5 text-xs text-slate-500 bg-slate-800/50"
                        style={{ gridTemplateColumns: `repeat(${dims.length + 1}, 1fr) 40px` }}>
                        {dims.map((d: any) => (
                          <span key={d.id || d.label}>{d.label}</span>
                        ))}
                        <span className="text-center">Qtd</span>
                        <span />
                      </div>
                      {variations.map((v, vi) => {
                        const parts = v.name.includes(' / ') ? v.name.split(' / ') : v.name.split(' ');
                        return (
                          <div key={vi}
                            className="grid gap-2 px-3 py-1.5 items-center text-sm"
                            style={{ gridTemplateColumns: `repeat(${dims.length + 1}, 1fr) 40px` }}>
                            {parts.map((part: string, pi: number) => (
                              <span key={pi} className="text-white truncate">{part}</span>
                            ))}
                            <span className="text-white text-center font-medium">{v.stockQty || 0}</span>
                            <button
                              onClick={() => {
                                const updated = variations.filter((_, i) => i !== vi);
                                setVariations(updated);
                              }}
                              className="text-slate-500 hover:text-red-400 justify-self-center">
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Row builder to add new variation */}
                  <div className="bg-slate-800 rounded-lg p-2">
                    <div className="grid gap-2 items-end"
                      style={{ gridTemplateColumns: `repeat(${dims.length}, 1fr) 100px 40px` }}>
                      {dims.map((d: any) => {
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
                      <button
                        onClick={() => {
                          const hasAtLeastOne = dims.some((d: any) => {
                            const val = rowDims[d.label];
                            if (!val) return false;
                            if (val === '__custom__') return (rowCustom[d.label] || '').trim().length > 0;
                            return true;
                          });
                          if (!hasAtLeastOne || rowQty <= 0) return;
                          const name = dims.map((d: any) => {
                            const val = rowDims[d.label];
                            if (!val) return '';
                            return val === '__custom__' ? rowCustom[d.label].trim() : val;
                          }).filter(Boolean).join(' / ');
                          // Check if variation already exists
                          const existingIdx = variations.findIndex(
                            (v: any) => v.name.toLowerCase() === name.toLowerCase()
                          );
                          if (existingIdx >= 0) {
                            const updated = [...variations];
                            updated[existingIdx] = { ...updated[existingIdx], stockQty: (updated[existingIdx].stockQty || 0) + rowQty };
                            setVariations(updated);
                          } else {
                            setVariations([
                              ...variations,
                              { name, stockQty: rowQty, priceModifier: 0, lowStockAt: undefined },
                            ]);
                          }
                          setRowDims({});
                          setRowCustom({});
                          setRowQty(0);
                        }}
                        disabled={!dims.some((d: any) => {
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
                      Variações: <span className="text-white font-semibold">{variations.length}</span>
                      <span className="mx-2">|</span>
                      Qtd total: <span className="text-white font-semibold">
                        {variations.reduce((sum, v) => sum + (v.stockQty || 0), 0)}
                      </span>
                    </span>
                  </div>
                </div>
                );
              })()}

              {/* ─── Pricing calculator (inline in step 2) ─── */}
              <div className="bg-slate-900 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-3">Calculadora de Precificação</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
                  <div>
                    <label className="block text-[10px] sm:text-xs text-slate-400 mb-1 truncate">Custo Un. (R$)</label>
                    <input type="number"
                      value={costPrice || ''}
                      onChange={(e) => {
                        const c = Number(e.target.value);
                        setCostPrice(c);
                        setSalePrice(calcSalePrice(c, operationalCost, taxRatePct, marginPct));
                      }}
                      min="0" step="0.01" placeholder="0,00"
                      className="w-full px-1.5 py-2 bg-slate-800 border border-slate-700 rounded text-white text-xs sm:text-sm text-center focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-xs text-slate-400 mb-1 truncate">Custo Oper. (R$)</label>
                    <input type="number"
                      value={operationalCost || ''}
                      onChange={(e) => {
                        const op = Number(e.target.value);
                        setOperationalCost(op);
                        setSalePrice(calcSalePrice(costPrice, op, taxRatePct, marginPct));
                      }}
                      min="0" step="0.01" placeholder="0,00"
                      className="w-full px-1.5 py-2 bg-slate-800 border border-slate-700 rounded text-white text-xs sm:text-sm text-center focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-xs text-slate-400 mb-1 truncate">Taxa %</label>
                    <input type="number"
                      value={taxRatePct || ''}
                      onChange={(e) => {
                        const tax = Number(e.target.value);
                        setTaxRatePct(tax);
                        setSalePrice(calcSalePrice(costPrice, operationalCost, tax, marginPct));
                      }}
                      min="0" max="100" step="0.1" placeholder="0"
                      className="w-full px-1.5 py-2 bg-slate-800 border border-slate-700 rounded text-white text-xs sm:text-sm text-center focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-xs text-slate-400 mb-1 truncate">Margem %</label>
                    <input type="number"
                      value={marginPct || ''}
                      onChange={(e) => {
                        const margin = Number(e.target.value);
                        setMarginPct(margin);
                        setSalePrice(calcSalePrice(costPrice, operationalCost, taxRatePct, margin));
                      }}
                      min="0" max="100" step="0.1" placeholder="0"
                      className="w-full px-1.5 py-2 bg-slate-800 border border-slate-700 rounded text-white text-xs sm:text-sm text-center focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-xs text-slate-400 mb-1 truncate">Pr. Venda (R$)</label>
                    <input type="number"
                      value={salePrice || ''}
                      onChange={(e) => {
                        const price = Number(e.target.value);
                        setSalePrice(price);
                        setMarginPct(calcMarginFromSale(costPrice, operationalCost, taxRatePct, price));
                      }}
                      min="0" step="0.01" placeholder="Auto"
                      className="w-full px-1.5 py-2 bg-slate-800 border border-slate-700 rounded text-white text-xs sm:text-sm text-center focus:border-indigo-500 outline-none" />
                  </div>
                </div>
                {/* Summary line */}
                {costPrice > 0 && salePrice > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-xs text-slate-400 text-center">
                      <span className="text-slate-500">Margem</span>{' '}
                      <span className="text-emerald-400 font-semibold">{(((salePrice - costWithTax(costPrice, operationalCost, taxRatePct, salePrice)) / salePrice) * 100).toFixed(1)}%</span>
                      <span className="mx-2 text-slate-700">|</span>
                      <span className="text-slate-500">Markup</span>{' '}
                      <span className="text-indigo-400 font-semibold">{((salePrice / totalCost(costPrice, operationalCost) - 1) * 100).toFixed(1)}%</span>
                      <span className="mx-2 text-slate-700">|</span>
                      <span className="text-slate-500">Custo total</span>{' '}
                      <span className="text-white font-medium">R$ {costWithTax(costPrice, operationalCost, taxRatePct, salePrice).toFixed(2)}</span>
                      <span className="mx-2 text-slate-700">|</span>
                      <span className="text-slate-500">Lucro est.</span>{' '}
                      <span className="text-emerald-400 font-semibold">R$ {(salePrice - costWithTax(costPrice, operationalCost, taxRatePct, salePrice)).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-center gap-1 text-[10px] text-slate-600">
                      <Info size={10} />
                      <span><strong>Margem</strong> = % do preço que é lucro (já com taxa). <strong>Markup</strong> = % que o preço está acima do custo base (sem taxa).</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Variation quantities + expiry (if template) */}
              {selectedTemplate && variations.length > 0 && (
                <div className="bg-slate-900 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-2">
                    Quantidades e Validade (opcional)
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {variations.map((v, vi) => (
                      <div key={vi} className="flex items-center gap-2 bg-slate-800 rounded-lg px-2 sm:px-3 py-1.5">
                        <span className="text-xs sm:text-sm text-white flex-1 truncate min-w-0">{v.name}</span>
                        <div className="shrink-0 w-14 sm:w-16">
                          <input
                            type="number"
                            value={v.stockQty || ''}
                            onChange={(e) => {
                              const updated = [...variations];
                              updated[vi] = { ...updated[vi], stockQty: Number(e.target.value) };
                              setVariations(updated);
                            }}
                            min="0" step="1" placeholder="0"
                            className="w-full px-1 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs text-center focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div className="shrink-0 w-24 sm:w-28">
                          <input
                            type="date"
                            value={variationExpiryDates[v.name] || ''}
                            onChange={(e) => setVariationExpiryDates(prev => ({ ...prev, [v.name]: e.target.value }))}
                            className="w-full px-1 py-1 bg-slate-700 border border-slate-600 rounded text-white text-[10px] focus:border-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 pt-1 border-t border-slate-700 flex justify-between items-center">
                    <span className="text-xs text-slate-400">
                      Qtd total: <span className="text-white font-semibold">{variations.reduce((sum, v) => sum + (v.stockQty || 0), 0)}</span>
                    </span>
                    <span className="text-xs text-slate-400">
                      Custo total: <span className="text-white font-semibold">R$ {(costPrice * variations.reduce((sum, v) => sum + (v.stockQty || 0), 0)).toFixed(2)}</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Simple product quantity + expiry (no template) */}
              {!selectedTemplate && (
                <div className="bg-slate-900 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-3">
                    Quantidade e Validade (opcional)
                  </p>
                  <div className="flex items-end gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Qtd Comprada</label>
                      <input
                        type="number"
                        value={simpleQty || ''}
                        onChange={(e) => setSimpleQty(Number(e.target.value))}
                        min="1" step="1" placeholder="1"
                        className="w-20 sm:w-24 px-2 sm:px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm text-center focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Data de Validade</label>
                      <input
                        type="date"
                        value={simpleExpiryDate}
                        onChange={(e) => setSimpleExpiryDate(e.target.value)}
                        className="w-40 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
                      />
                    </div>
                    {simpleQty > 0 && costPrice > 0 && (
                      <div className="self-end pb-1">
                        <span className="text-xs text-slate-400">
                          Custo: <span className="text-white font-medium">R$ {(costPrice * simpleQty).toFixed(2)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── Action buttons ─── */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={addToPurchase}
                  disabled={!productName.trim() || costPrice <= 0}
                  className="flex-1 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus size={14} className="inline mr-1" /> Adicionar à Compra
                </button>
                {accumulatedProducts.length > 0 && (
                  <button
                    onClick={() => setExpandedStep('review')}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Revisar <span className="opacity-80">({accumulatedProducts.length})</span> →
                  </button>
                )}
              </div>

              {/* ─── Accumulated products list ─── */}
              {accumulatedProducts.length > 0 && (
                <div className="bg-slate-900 rounded-xl p-3">
                  <h4 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-2">
                    <Package size={14} className="text-indigo-400" />
                    Produtos na Compra ({accumulatedProducts.length})
                  </h4>
                  <div className="bg-slate-800 rounded-lg divide-y divide-slate-700 max-h-48 overflow-y-auto">
                    {accumulatedProducts.map((prod, idx) => {
                      const qty = prod.selectedTemplate
                        ? prod.variations.reduce((s, v) => s + (v.stockQty || 0), 0)
                        : (prod.simpleQty || 1);
                      return (
                        <div key={idx} className="px-3 py-2 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{prod.productName}</p>
                            {prod.variations.length > 0 && (
                              <p className="text-[10px] text-slate-500">
                                {prod.variations.filter(v => (v.stockQty || 0) > 0).map(v => `${v.name} (${v.stockQty})`).join(', ')}
                              </p>
                            )}
                            <p className="text-[10px] text-slate-500">
                              Custo un: R$ {prod.costPrice.toFixed(2)}
                              {prod.salePrice > 0 && ` | Venda: R$ ${prod.salePrice.toFixed(2)}`}
                              {prod.taxRatePct > 0 && ` | Tx: ${prod.taxRatePct}%`}
                              {prod.marginPct > 0 && ` | Mg: ${prod.marginPct}%`}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm text-white font-medium">{qty}</p>
                            <p className="text-[10px] text-slate-500">R$ {(prod.costPrice * qty).toFixed(2)}</p>
                          </div>
                          <button
                            onClick={() => removeFromPurchase(idx)}
                            className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                            title="Remover produto"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2 text-xs">
                    <span className="text-slate-400">Total</span>
                    <span className="text-white font-semibold">R$ {accumulatedTotalCost.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ════ STEP 3: REVISÃO E FINALIZAÇÃO ════ */}
        <div className="bg-slate-800/50 rounded-xl overflow-hidden">
          <button
            onClick={() => isReviewReady && setExpandedStep(expandedStep === 'review' ? 'product' : 'review')}
            disabled={!isReviewReady}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[11px] font-bold
              ${expandedStep === 'review' ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
              3
            </span>
            <span className="text-sm font-semibold flex-1 text-left text-white">
              3. Revisão e Finalização
            </span>
            {accumulatedProducts.length > 0 && (
              <span className="text-[11px] text-indigo-400">
                {accumulatedProducts.length} prod. — R$ {accumulatedTotalCost.toFixed(2)}
              </span>
            )}
            <ChevronDown size={16} className={`text-slate-500 transition-transform ${expandedStep === 'review' ? 'rotate-180' : ''}`} />
          </button>

          {expandedStep === 'review' && isReviewReady && (
            <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50 pt-3">
              {/* Products summary */}
              <div className="bg-slate-900 rounded-xl p-3">
                <h4 className="text-xs font-semibold text-slate-400 mb-2">
                  Resumo da Compra — {accumulatedProducts.length} produto(s)
                </h4>
                <div className="bg-slate-800 rounded-lg divide-y divide-slate-700 max-h-52 overflow-y-auto">
                  {accumulatedProducts.map((prod, idx) => {
                    const qty = prod.selectedTemplate
                      ? prod.variations.reduce((s, v) => s + (v.stockQty || 0), 0)
                      : (prod.simpleQty || 1);
                    return (
                      <div key={idx} className="px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-white truncate">
                              {prod.productName}
                              {prod.productSku && <span className="text-[10px] text-slate-500 ml-2">SKU: {prod.productSku}</span>}
                            </p>
                            {prod.variations.length > 0 && (
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {prod.variations.filter(v => (v.stockQty || 0) > 0).map(v => `${v.name} (${v.stockQty})`).join(', ')}
                              </p>
                            )}
                            <p className="text-[10px] text-slate-600 mt-0.5">
                              Custo un: R$ {prod.costPrice.toFixed(2)}
                              {prod.operationalCost > 0 && ` + R$ ${prod.operationalCost.toFixed(2)} op.`}
                              {prod.salePrice > 0 && ` → Venda: R$ ${prod.salePrice.toFixed(2)}`}
                              {prod.taxRatePct > 0 && ` (Tx: ${prod.taxRatePct}%)`}
                              {prod.marginPct > 0 && ` (Mg: ${prod.marginPct}%)`}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0 ml-3">
                            <p className="text-sm text-white font-semibold">{qty} un.</p>
                            <p className="text-xs text-slate-400">R$ {(prod.costPrice * qty).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-sm font-semibold">
                  <span className="text-white">Subtotal</span>
                  <span className="text-white">R$ {accumulatedTotalCost.toFixed(2)}</span>
                </div>
              </div>

              {/* Discount */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Desconto na Compra (R$)</label>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  min="0" step="0.01" placeholder="0,00"
                  className="w-40 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Data da Compra</label>
                  <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Data de Recebimento</label>
                  <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
                </div>
              </div>

              {/* Finalize button */}
              <button
                onClick={handleFinalize}
                disabled={saving}
                className="w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-colors"
              >
                {saving ? 'Criando produtos e compra...' : `Finalizar Compra (R$ ${(accumulatedTotalCost - (Number(discount) || 0)).toFixed(2)})`}
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
          {toast.message}
        </div>
      )}
    </Modal>
  );
}
