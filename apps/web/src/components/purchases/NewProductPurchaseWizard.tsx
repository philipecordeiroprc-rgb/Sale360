'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Search, Scan, ChevronDown, Info, Upload, X, Check } from 'lucide-react';
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

export function NewProductPurchaseWizard({ open, onClose, onCreated }: NewProductPurchaseWizardProps) {
  // ─── Accordion steps ───
  const [expandedStep, setExpandedStep] = useState<'supplier' | 'product' | 'costs'>('supplier');
  const [supplierDone, setSupplierDone] = useState(false);
  const [productDone, setProductDone] = useState(false);

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

  // ─── Step 3: Costs ───
  const [costPrice, setCostPrice] = useState<number>(0);
  const [operationalCost, setOperationalCost] = useState<number>(0);
  const [taxRatePct, setTaxRatePct] = useState<number>(0);
  const [marginPct, setMarginPct] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [discount, setDiscount] = useState('0');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Quantity for simple product (no variations)
  const [simpleQty, setSimpleQty] = useState<number>(1);
  // Expiry date for simple product (no variations)
  const [simpleExpiryDate, setSimpleExpiryDate] = useState('');
  // Expiry dates per variation name (for auto-receive)
  const [variationExpiryDates, setVariationExpiryDates] = useState<Record<string, string>>({});

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

  const advanceToCosts = () => {
    if (!productName.trim()) {
      show('Informe o nome do produto', 'error');
      return;
    }
    if (selectedTemplate && variations.filter(v => (v.stockQty || 0) > 0).length === 0) {
      show('Adicione pelo menos uma variação com quantidade', 'error');
      return;
    }
    // Pre-fill pricing from product price
    if (productPrice && salePrice === 0) {
      setSalePrice(Number(productPrice));
    }
    setProductDone(true);
    setExpandedStep('costs');
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

  // ─── Variation quantity change ───
  const handleVariationsChange = (newVariations: VariationData[]) => {
    setVariations(newVariations);
  };

  // ─── FINALIZE: Create product + purchase ───
  const handleFinalize = async () => {
    if (!productName.trim()) { show('Nome do produto é obrigatório', 'error'); return; }
    // Validate supplier
    if (!selectedSupplier && !(useNewSupplier && newSupplierName.trim())) {
      show('Selecione ou informe o fornecedor', 'error');
      return;
    }
    // Validate variations if template
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

    setSaving(true);
    setError('');
    try {
      // 1. Resolve supplier
      let supplierId = selectedSupplier;
      if (useNewSupplier && newSupplierName.trim()) {
        const newSup = await api.suppliers.create({ name: newSupplierName.trim() });
        supplierId = newSup.id;
      }

      // 2. Create product
      const productPayload: any = {
        name: productName.trim(),
        description: productDescription.trim() || undefined,
        barcode: productBarcode.trim() || undefined,
        sku: productSku.trim() || undefined,
        categoryId: categoryId || undefined,
        imageUrl: productImage || undefined,
      };
      if (productPrice) productPayload.price = parseFloat(productPrice);
      if (lowStockAt) productPayload.lowStockAt = parseFloat(lowStockAt);

      const created = await api.products.create(productPayload);
      const productId = created.id;

      // 3. Create variations if any
      if (variations.length > 0) {
        for (const v of variations) {
          const varQty = v.stockQty || 0;
          if (varQty <= 0 && !selectedTemplate) continue;
          await api.products.addVariation(productId, {
            name: v.name,
            stockQty: varQty,
            lowStockAt: v.lowStockAt,
            priceModifier: v.priceModifier,
            sku: v.sku,
            barcode: v.barcode,
          });
        }
      }

      // 4. Create purchase
      const purchaseItems: any[] = [];

      if (variations.filter(v => (v.stockQty || 0) > 0).length > 0) {
        // Has variations with quantity
        for (const v of variations) {
          const varQty = v.stockQty || 0;
          if (varQty <= 0) continue;
          // Find the actual variation ID from the created product
          const freshProduct = await api.products.get(productId);
          const matchingVar = freshProduct.variations?.find((pv: any) => pv.name === v.name);
          purchaseItems.push({
            productId,
            variationId: matchingVar?.id || undefined,
            productName: `${productName.trim()} - ${v.name}`,
            quantity: varQty,
            unitCost: costPrice,
            total: costPrice * varQty,
            salePrice: salePrice || undefined,
            operationalCost: operationalCost || undefined,
            taxRatePct: taxRatePct || undefined,
            marginPct: marginPct || undefined,
          });
        }
      } else {
        // Simple product — use quantity from Step 3
        const qty = simpleQty || 1;
        purchaseItems.push({
          productId,
          productName: productName.trim(),
          quantity: qty,
          unitCost: costPrice,
          total: costPrice * qty,
          salePrice: salePrice || undefined,
          operationalCost: operationalCost || undefined,
          taxRatePct: taxRatePct || undefined,
          marginPct: marginPct || undefined,
        });
      }

      if (purchaseItems.length === 0) {
        show('Adicione pelo menos um item com quantidade > 0', 'error');
        setSaving(false);
        return;
      }

      await api.purchases.create({
        supplierId,
        discount: Number(discount) || 0,
        items: purchaseItems,
      });

      // 5. Auto-receive the purchase so stock is updated immediately
      const purchasesData = await api.purchases.list({ status: 'DRAFT' });
      const createdPurchase = purchasesData.purchases?.[0];
      if (createdPurchase) {
        try {
          // Build itemExpiryDates from both variation dates and simple product date
          const expiryPayload: any = {};
          const dates = Object.entries(variationExpiryDates).filter(([, v]) => v);
          if (simpleExpiryDate) {
            dates.push([productName.trim(), simpleExpiryDate]);
          }
          if (dates.length > 0) {
            const fullPurchase = await api.purchases.get(createdPurchase.id);
            if (fullPurchase?.items) {
              const itemExpiryDates: Record<string, string> = {};
              for (const [varName, dateStr] of dates) {
                const matchingItem = fullPurchase.items.find((item: any) =>
                  item.productName?.endsWith(` - ${varName}`) || item.productName === varName
                );
                if (matchingItem) {
                  itemExpiryDates[matchingItem.id] = dateStr;
                }
              }
              if (Object.keys(itemExpiryDates).length > 0) {
                expiryPayload.itemExpiryDates = itemExpiryDates;
              }
            }
          }
          await api.purchases.receive(createdPurchase.id, expiryPayload);
        } catch {
          // Non-critical: purchase was created, user can receive manually
        }
      }

      show('Produto criado, compra recebida e estoque atualizado!');
      setTimeout(() => {
        onCreated();
        resetForm();
        onClose();
      }, 800);
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
    setProductDone(false);
    setExpandedStep('supplier');
    setSelectedSupplier('');
    setUseNewSupplier(false);
    setNewSupplierName('');
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
    setCostPrice(0);
    setOperationalCost(0);
    setTaxRatePct(0);
    setMarginPct(0);
    setSalePrice(0);
    setDiscount('0');
    setSimpleQty(1);
    setSimpleExpiryDate('');
    setVariationExpiryDates({});
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // ─── Render helpers ───

  const stepIcon = (step: 'supplier' | 'product' | 'costs', done: boolean) => {
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
            onClick={() => setExpandedStep(expandedStep === 'supplier' ? 'costs' : 'supplier')}
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

        {/* ════ STEP 2: PRODUTO ════ */}
        <div className="bg-slate-800/50 rounded-xl overflow-hidden">
          <button
            onClick={() => supplierDone && setExpandedStep(expandedStep === 'product' ? (productDone ? 'costs' : 'supplier') : 'product')}
            disabled={!supplierDone}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {stepIcon('product', productDone)}
            <span className={`text-sm font-semibold flex-1 text-left ${productDone ? 'text-emerald-400' : 'text-white'}`}>
              2. Produto
            </span>
            {productDone && (
              <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                {productName} {variations.length > 0 ? `(${variations.length} var.)` : ''}
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

              {/* Variation Editor (if category has template) */}
              {selectedTemplate && (
                <div className="bg-slate-900 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-2">
                    Variações — Template: <span className="text-indigo-400 font-medium">{selectedTemplate.name}</span>
                  </p>
                  <VariationEditor
                    template={selectedTemplate}
                    variations={variations}
                    onChange={handleVariationsChange}
                    purchaseMode
                  />
                </div>
              )}

              {scannerOpen && (
                <div className="mb-3">
                  <BarcodeScanner
                    isOpen={scannerOpen}
                    onClose={() => setScannerOpen(false)}
                    onDetected={handleBarcodeDetected}
                    onError={(msg) => show(msg, 'error')}
                  />
                </div>
              )}

              <button
                onClick={advanceToCosts}
                disabled={!productName.trim()}
                className="w-full px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Avançar → Custos e Variações
              </button>
            </div>
          )}
        </div>

        {/* ════ STEP 3: CUSTOS E VARIAÇÕES ════ */}
        <div className="bg-slate-800/50 rounded-xl overflow-hidden">
          <button
            onClick={() => productDone && setExpandedStep(expandedStep === 'costs' ? 'product' : 'costs')}
            disabled={!productDone}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[11px] font-bold
              ${expandedStep === 'costs' ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
              3
            </span>
            <span className="text-sm font-semibold flex-1 text-left text-white">
              3. Custos e Variações
            </span>
            {costPrice > 0 && (
              <span className="text-[11px] text-slate-400">
                Custo: R$ {costPrice.toFixed(2)} | Venda: R$ {salePrice.toFixed(2)}
              </span>
            )}
            <ChevronDown size={16} className={`text-slate-500 transition-transform ${expandedStep === 'costs' ? 'rotate-180' : ''}`} />
          </button>

          {expandedStep === 'costs' && productDone && (
            <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50 pt-3">
              {/* Pricing calculator — 5 fields (same as existing purchase) */}
              <div className="bg-slate-900 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-3">Calculadora de Precificação</p>
                <div className="grid grid-cols-5 gap-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Custo Un. (R$)</label>
                    <input type="number"
                      value={costPrice || ''}
                      onChange={(e) => {
                        const c = Number(e.target.value);
                        setCostPrice(c);
                        setSalePrice(calcSalePrice(c, operationalCost, taxRatePct, marginPct));
                      }}
                      min="0" step="0.01" placeholder="0,00"
                      className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm text-center focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Custo Oper. (R$)</label>
                    <input type="number"
                      value={operationalCost || ''}
                      onChange={(e) => {
                        const op = Number(e.target.value);
                        setOperationalCost(op);
                        setSalePrice(calcSalePrice(costPrice, op, taxRatePct, marginPct));
                      }}
                      min="0" step="0.01" placeholder="0,00"
                      className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm text-center focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Taxa %</label>
                    <input type="number"
                      value={taxRatePct || ''}
                      onChange={(e) => {
                        const tax = Number(e.target.value);
                        setTaxRatePct(tax);
                        setSalePrice(calcSalePrice(costPrice, operationalCost, tax, marginPct));
                      }}
                      min="0" max="100" step="0.1" placeholder="0"
                      className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm text-center focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Margem %</label>
                    <input type="number"
                      value={marginPct || ''}
                      onChange={(e) => {
                        const margin = Number(e.target.value);
                        setMarginPct(margin);
                        setSalePrice(calcSalePrice(costPrice, operationalCost, taxRatePct, margin));
                      }}
                      min="0" max="100" step="0.1" placeholder="0"
                      className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm text-center focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Pr. Venda (R$)</label>
                    <input type="number"
                      value={salePrice || ''}
                      onChange={(e) => {
                        const price = Number(e.target.value);
                        setSalePrice(price);
                        setMarginPct(calcMarginFromSale(costPrice, operationalCost, taxRatePct, price));
                      }}
                      min="0" step="0.01" placeholder="Auto"
                      className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm text-center focus:border-indigo-500 outline-none" />
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

              {/* Variation quantities (if category has template) */}
              {selectedTemplate && variations.length > 0 && (
                <div className="bg-slate-900 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-2">
                    Quantidades por Variação
                    <span className="text-slate-500 ml-2">(opcional: informe a data de validade para rastreamento FEFO)</span>
                  </p>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {/* Header row */}
                    <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-slate-500">
                      <span className="flex-1">Variação</span>
                      <span className="w-16 text-center">Qtd</span>
                      <span className="w-28 text-center">Validade</span>
                    </div>
                    {variations.map((v, vi) => (
                      <div key={vi} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-1.5">
                        <span className="text-sm text-white flex-1 truncate">{v.name}</span>
                        <input
                          type="number"
                          value={v.stockQty || ''}
                          onChange={(e) => {
                            const updated = [...variations];
                            updated[vi] = { ...updated[vi], stockQty: Number(e.target.value) };
                            setVariations(updated);
                          }}
                          min="0" step="1" placeholder="0"
                          className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm text-center focus:border-indigo-500 outline-none"
                        />
                        <input
                          type="date"
                          value={variationExpiryDates[v.name] || ''}
                          onChange={(e) => setVariationExpiryDates(prev => ({ ...prev, [v.name]: e.target.value }))}
                          className="w-28 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs focus:border-indigo-500 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-700 flex justify-between items-center">
                    <span className="text-xs text-slate-400">
                      Qtd total: <span className="text-white font-semibold">
                        {variations.reduce((sum, v) => sum + (v.stockQty || 0), 0)}
                      </span>
                    </span>
                    <span className="text-xs text-slate-400">
                      Custo total: <span className="text-white font-semibold">
                        R$ {(costPrice * variations.reduce((sum, v) => sum + (v.stockQty || 0), 0)).toFixed(2)}
                      </span>
                    </span>
                  </div>
                </div>
              )}

              {/* Simple product quantity + expiry (no template) */}
              {!selectedTemplate && (
                <div className="bg-slate-900 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-3">
                    Quantidade e Validade
                    <span className="text-slate-500 ml-2">(validade é opcional — usada no rastreamento FEFO)</span>
                  </p>
                  <div className="flex items-center gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Qtd Comprada</label>
                      <input
                        type="number"
                        value={simpleQty || ''}
                        onChange={(e) => setSimpleQty(Number(e.target.value))}
                        min="1" step="1" placeholder="1"
                        className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm text-center focus:border-indigo-500 outline-none"
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
                          Custo total: <span className="text-white font-medium">R$ {(costPrice * simpleQty).toFixed(2)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Desconto geral */}
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

              {/* Finalizar button */}
              <button
                onClick={handleFinalize}
                disabled={saving || costPrice <= 0}
                className="w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-colors"
              >
                {saving ? 'Criando produto e compra...' : `Finalizar Compra (R$ ${((costPrice * (selectedTemplate
                  ? variations.reduce((sum, v) => sum + (v.stockQty || 0), 0)
                  : (simpleQty || 1))) - (Number(discount) || 0)).toFixed(2)})`}
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
