'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, Barcode, Edit2, ToggleLeft, ToggleRight, Trash2,
  Tags, X, Layers,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { CategoriesModal } from '@/components/products/CategoriesModal';
import { VariationEditor, type VariationData } from '@/components/products/VariationEditor';
import api, { type Product, type CategoryWithCount, type VariationTemplate } from '@/lib/api';

const UNITS = [
  { id: 'UN', label: 'Unidade' },
  { id: 'PC', label: 'Peça' },
  { id: 'CX', label: 'Caixa' },
  { id: 'KG', label: 'Quilo (kg)' },
  { id: 'G', label: 'Grama (g)' },
  { id: 'L', label: 'Litro (L)' },
  { id: 'ML', label: 'Mililitro (ml)' },
  { id: 'M', label: 'Metro (m)' },
  { id: 'M2', label: 'Metro² (m²)' },
  { id: 'PAR', label: 'Par' },
  { id: 'FD', label: 'Fardo' },
  { id: 'PCT', label: 'Pacote' },
] as const;

interface FormData {
  name: string;
  description: string;
  price: string;
  costPrice: string;
  taxRate: string;
  operationalCost: string;
  desiredMargin: string;
  stockQty: string;
  barcode: string;
  sku: string;
  categoryId: string;
  unit: string;
}

const emptyForm: FormData = {
  name: '',
  description: '',
  price: '',
  costPrice: '',
  taxRate: '',
  operationalCost: '',
  desiredMargin: '',
  stockQty: '0',
  barcode: '',
  sku: '',
  categoryId: '',
  unit: 'UN',
};

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const show = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

// Calculate profit margin
function calcProfit(price: number, cost: number, operationalCost: number, taxRate: number): { profit: number; margin: number } {
  if (price <= 0) return { profit: 0, margin: 0 };
  const taxAmount = price * (taxRate / 100);
  const totalCost = cost + operationalCost + taxAmount;
  const profit = price - totalCost;
  const margin = (profit / price) * 100;
  return { profit, margin };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);

  // Product form
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });
  const [variations, setVariations] = useState<VariationData[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showVariations, setShowVariations] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<VariationTemplate | null>(null);

  // Load variation template for a given category
  const loadTemplate = useCallback(async (categoryId: string) => {
    if (!categoryId) {
      setCurrentTemplate(null);
      return;
    }
    try {
      const cat = await api.categories.get(categoryId);
      setCurrentTemplate(cat.variationTemplate || null);
    } catch {
      setCurrentTemplate(null);
    }
  }, []);

  // Categories modal
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);

  const { toast, show } = useToast();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load products
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params: any = {};
      if (search) params.search = search;
      if (selectedCategory !== 'all') params.categoryId = selectedCategory;

      const data = await api.products.list(params);
      setProducts(data.products);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory]);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      const data = await api.categories.list();
      setCategories(data);
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadProducts(), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [loadProducts]);

  // Open form for create
  const handleCreate = () => {
    setEditingProduct(null);
    setFormData({ ...emptyForm });
    setVariations([]);
    setShowVariations(false);
    setFormError('');
    setCurrentTemplate(null);
    setFormOpen(true);
  };

  // Open form for edit
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: String(product.price),
      costPrice: product.costPrice != null ? String(product.costPrice) : '',
      taxRate: product.taxRate != null ? String(product.taxRate) : '',
      operationalCost: product.operationalCost != null ? String(product.operationalCost) : '',
      desiredMargin: '',
      stockQty: String(product.stockQty),
      barcode: product.barcode || '',
      sku: product.sku || '',
      categoryId: product.categoryId || '',
      unit: product.unit,
    });
    setVariations(
      product.variations?.map((v: any) => ({
        id: v.id,
        name: v.name,
        priceModifier: Number(v.priceModifier),
        stockQty: Number(v.stockQty),
        lowStockAt: v.lowStockAt != null ? Number(v.lowStockAt) : undefined,
        sku: v.sku || '',
        barcode: v.barcode || '',
      })) || [],
    );
    setShowVariations(product.hasVariations || (product.variations?.length > 0));
    setFormError('');
    setFormOpen(true);
  };

  // Calculate suggested price: (cost + opsCost) * (1 + tax/100) * (1 + margin/100)
  const suggestedPrice = (() => {
    const cost = parseFloat(formData.costPrice) || 0;
    const opsCost = parseFloat(formData.operationalCost) || 0;
    const margin = parseFloat(formData.desiredMargin) || 0;
    const tax = parseFloat(formData.taxRate) || 0;
    const price = parseFloat(formData.price) || 0;
    if (cost <= 0 || margin <= 0) return null;
    const totalCost = cost + opsCost;
    const withTax = totalCost * (1 + tax / 100);
    const withMargin = withTax * (1 + margin / 100);
    return {
      value: Math.round(withMargin * 100) / 100,
      margin,
      currentProfit: price > 0 ? calcProfit(price, cost, opsCost, tax) : null,
    };
  })();

  // Save product
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const price = parseFloat(formData.price);
    const costPrice = formData.costPrice ? parseFloat(formData.costPrice) : undefined;
    const taxRate = formData.taxRate ? parseFloat(formData.taxRate) : undefined;
    const operationalCost = formData.operationalCost ? parseFloat(formData.operationalCost) : undefined;
    const stockQty = parseInt(formData.stockQty) || 0;

    if (!formData.name.trim()) { setFormError('Nome é obrigatório'); return; }
    if (isNaN(price) || price <= 0) { setFormError('Preço de venda deve ser maior que zero'); return; }

    try {
      setSaving(true);
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        price,
        costPrice,
        taxRate,
        operationalCost,
        stockQty,
        barcode: formData.barcode.trim() || undefined,
        sku: formData.sku.trim() || undefined,
        categoryId: formData.categoryId || undefined,
        unit: formData.unit,
        hasVariations: variations.length > 0,
      };

      let savedProduct: any;

      if (editingProduct) {
        savedProduct = await api.products.update(editingProduct.id, payload);

        // Sync variations: delete removed, update existing, create new
        const existingVariationIds = new Set(
          (editingProduct.variations || []).map((v: any) => v.id),
        );
        const keptIds = new Set(
          variations.filter((v) => v.id).map((v) => v.id as string),
        );

        // Delete removed
        for (const oldId of existingVariationIds) {
          if (!keptIds.has(oldId)) {
            await api.products.deleteVariation(editingProduct.id, oldId).catch(() => {});
          }
        }

        // Create or update
        for (const v of variations) {
          if (v.id) {
            await api.products.updateVariation(editingProduct.id, v.id, {
              name: v.name,
              priceModifier: v.priceModifier,
              stockQty: v.stockQty,
              lowStockAt: v.lowStockAt,
              sku: v.sku || undefined,
              barcode: v.barcode || undefined,
            }).catch(() => {});
          } else {
            await api.products.addVariation(editingProduct.id, {
              name: v.name,
              priceModifier: v.priceModifier,
              stockQty: v.stockQty,
              lowStockAt: v.lowStockAt,
              sku: v.sku || undefined,
              barcode: v.barcode || undefined,
            }).catch(() => {});
          }
        }

        show('Produto atualizado!');
      } else {
        savedProduct = await api.products.create(payload);

        // Create variations for new product
        for (const v of variations) {
          await api.products.addVariation(savedProduct.id, {
            name: v.name,
            priceModifier: v.priceModifier,
            stockQty: v.stockQty,
            lowStockAt: v.lowStockAt,
            sku: v.sku || undefined,
            barcode: v.barcode || undefined,
          }).catch(() => {});
        }

        show('Produto criado!');
      }

      setFormOpen(false);
      await loadProducts();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Toggle active
  const handleToggle = async (product: Product) => {
    try {
      await api.products.toggle(product.id);
      await loadProducts();
    } catch (err: any) {
      show(err.message, 'error');
    }
  };

  // Delete product
  const handleDelete = async (product: Product) => {
    if (deletingId) return;
    if (!confirm(`Excluir "${product.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      setDeletingId(product.id);
      await api.products.delete(product.id);
      show('Produto excluído!');
      await loadProducts();
    } catch (err: any) {
      show(err.message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const activeCategories = categories.filter((c) => c._count.products > 0);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg animate-slide-up ${
            toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Produtos</h2>
          <p className="text-slate-400 mt-1">
            {loading ? 'Carregando...' : `${total} produtos no catálogo`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCategoriesOpen(true)}
            className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white px-4 py-3 rounded-xl font-medium transition-colors"
          >
            <Tags size={18} />
            Categorias
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-3 rounded-xl font-semibold transition-colors"
          >
            <Plus size={20} />
            Novo Produto
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, SKU ou código de barras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
            selectedCategory === 'all'
              ? 'bg-indigo-500 text-white'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          Todas
        </button>
        {activeCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              selectedCategory === cat.id
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-8 text-center">
          <p className="text-red-400 mb-2">{error}</p>
          <button onClick={loadProducts} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Products Table */}
      {loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden animate-pulse">
          <div className="p-4 border-b border-slate-800 grid grid-cols-12 gap-3 text-xs text-slate-500">
            <div className="col-span-1 h-4 bg-slate-800 rounded" />
            <div className="col-span-2 h-4 bg-slate-800 rounded" />
            <div className="col-span-1 h-4 bg-slate-800 rounded" />
            <div className="col-span-1 h-4 bg-slate-800 rounded" />
            <div className="col-span-2 h-4 bg-slate-800 rounded" />
            <div className="col-span-2 h-4 bg-slate-800 rounded" />
            <div className="col-span-2 h-4 bg-slate-800 rounded" />
            <div className="col-span-1 h-4 bg-slate-800 rounded" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-slate-800/50 grid grid-cols-12 gap-3 items-center">
              <div className="col-span-1 h-10 w-10 bg-slate-800 rounded-lg" />
              <div className="col-span-2 h-5 bg-slate-800 rounded" />
              <div className="col-span-1 h-4 bg-slate-800 rounded" />
              <div className="col-span-1 h-4 bg-slate-800 rounded" />
              <div className="col-span-2 h-5 bg-slate-800 rounded" />
              <div className="col-span-2 h-5 bg-slate-800 rounded" />
              <div className="col-span-2 h-4 bg-slate-800 rounded" />
              <div className="col-span-1 h-8 bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-white mb-2">Nenhum produto encontrado</h3>
          <p className="text-slate-400 mb-6">
            {search || selectedCategory !== 'all'
              ? 'Tente ajustar os filtros de busca.'
              : 'Comece cadastrando seu primeiro produto.'}
          </p>
          {!search && selectedCategory === 'all' && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-3 rounded-xl font-semibold transition-colors mx-auto"
            >
              <Plus size={20} />
              Novo Produto
            </button>
          )}
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium w-14">Foto</th>
                  <th className="text-left px-4 py-3 font-medium">Produto</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Cód/SKU</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Categoria</th>
                  <th className="text-right px-4 py-3 font-medium">Preço</th>
                  <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Margem</th>
                  <th className="text-left px-4 py-3 font-medium">Estoque</th>
                  <th className="text-right px-4 py-3 font-medium w-28">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {products.map((product) => {
                  const cost = Number(product.costPrice) || 0;
                  const price = Number(product.price);
                  const opsCost = Number(product.operationalCost) || 0;
                  const tax = Number(product.taxRate) || 0;
                  const { profit, margin } = calcProfit(price, cost, opsCost, tax);
                  const hasCost = cost > 0;
                  const hasVariations = product.hasVariations && product.variations?.length > 0;
                  const totalStock = hasVariations
                    ? product.variations.reduce((sum: number, v: any) => sum + Number(v.stockQty), 0)
                    : Number(product.stockQty);
                  const inactive = !product.active;

                  return (
                    <tr
                      key={product.id}
                      className={`transition-colors hover:bg-slate-800/30 ${
                        inactive ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Photo */}
                      <td className="px-4 py-3">
                        <div className="relative group w-10 h-10">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          ) : (
                            <button
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = async (ev: any) => {
                                  const file = ev.target.files?.[0];
                                  if (!file) return;
                                  const reader = new FileReader();
                                  reader.onload = async () => {
                                    try {
                                      await api.products.update(product.id, { imageUrl: reader.result as string });
                                      show('Foto atualizada!');
                                      await loadProducts();
                                    } catch { show('Erro ao salvar foto', 'error'); }
                                  };
                                  reader.readAsDataURL(file);
                                };
                                input.click();
                              }}
                              className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                              title="Upload foto"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                <circle cx="12" cy="13" r="4"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Product name + details */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium truncate max-w-[200px]">
                            {product.name}
                          </span>
                          {hasVariations && (
                            <span className="text-xs text-slate-500 flex items-center gap-0.5" title={`${product.variations.length} variações`}>
                              <Layers size={11} />
                              {product.variations.length}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                          {product.description || <span className="italic">Sem descrição</span>}
                        </div>
                      </td>

                      {/* SKU / Barcode */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-sm text-slate-300 font-mono">
                          {product.sku && <div>{product.sku}</div>}
                          {product.barcode && (
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Barcode size={12} />
                              {product.barcode}
                            </div>
                          )}
                          {!product.sku && !product.barcode && <span className="text-slate-600">-</span>}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {product.category ? (
                          <span
                            className="px-2 py-0.5 rounded-md text-xs text-white whitespace-nowrap"
                            style={{ backgroundColor: (product.category.color || '#6366F1') + '50' }}
                          >
                            {product.category.name}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">-</span>
                        )}
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3 text-right">
                        <div className="text-white font-semibold">
                          R$ {price.toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-500">
                          / {product.unit.toLowerCase()}
                        </div>
                      </td>

                      {/* Margin / Profit */}
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {hasCost ? (
                          <div>
                            <div className={`text-sm font-medium ${margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {margin >= 0 ? '+' : ''}{margin.toFixed(0)}%
                            </div>
                            <div className={`text-xs ${profit > 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                              R$ {profit.toFixed(2)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs">-</span>
                        )}
                      </td>

                      {/* Stock */}
                      <td className="px-4 py-3">
                        <span className={`text-sm font-semibold ${
                          totalStock > 10 ? 'text-white' : totalStock > 0 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {totalStock > 0 ? `${totalStock}` : '0'}
                        </span>
                        <span className="text-xs text-slate-500 ml-0.5">un</span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          {hasVariations && (
                            <button
                              onClick={() => setStockProduct(product)}
                              className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                              title="Ver estoque por variação"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 hover:text-white">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={15} className="text-slate-400 hover:text-white" />
                          </button>
                          <button
                            onClick={() => handleToggle(product)}
                            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                            title={product.active ? 'Desativar' : 'Ativar'}
                          >
                            {product.active ? (
                              <ToggleRight size={15} className="text-emerald-400" />
                            ) : (
                              <ToggleLeft size={15} className="text-slate-500" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(product)}
                            disabled={deletingId === product.id}
                            className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Excluir"
                          >
                            <Trash2 size={15} className="text-slate-400 hover:text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Product Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingProduct ? 'Editar Produto' : 'Novo Produto'}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {formError && (
            <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center justify-between">
              <span>{formError}</span>
              <button type="button" onClick={() => setFormError('')} className="text-red-400 hover:text-red-300"><X size={16} /></button>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-slate-400 text-sm mb-1">Nome *</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome do produto"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors" required />
          </div>

          {/* Description */}
          <div>
            <label className="block text-slate-400 text-sm mb-1">Descrição</label>
            <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição curta do produto"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors" />
          </div>

          {/* SKU + Barcode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-sm mb-1">SKU</label>
              <input type="text" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="Código interno"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Código de Barras</label>
              <input type="text" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="789..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
          </div>

          {/* Category + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-sm mb-1">Categoria</label>
              <select value={formData.categoryId} onChange={(e) => {
                  const catId = e.target.value;
                  setFormData({ ...formData, categoryId: catId });
                  loadTemplate(catId);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                <option value="">Sem categoria</option>
                {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Unidade</label>
              <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                {UNITS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>
          </div>

          {/* Financial: Cost + Operational Cost + Tax + Margin + Price */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-medium text-slate-300">Precificação</h4>

            {/* Row 1: Cost Price + Operational Cost (fixed R$) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-xs mb-1">Preço de Custo (R$)</label>
                <input type="number" step="0.01" min="0" value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  placeholder="0,00"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Custo Operacional (R$)</label>
                <input type="number" step="0.01" min="0" value={formData.operationalCost}
                  onChange={(e) => setFormData({ ...formData, operationalCost: e.target.value })}
                  placeholder="Embalagem, frete, etc."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
            </div>

            {/* Row 2: Tax Rate (%) + Desired Margin (%) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-xs mb-1">Taxa (%)</label>
                <input type="number" step="0.01" min="0" max="100" value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                  placeholder="Ex: 12% cartão"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Margem de Lucro (%)</label>
                <input type="number" step="0.01" min="0" value={formData.desiredMargin}
                  onChange={(e) => setFormData({ ...formData, desiredMargin: e.target.value })}
                  placeholder="Ex: 100%"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
            </div>

            {/* Suggested price */}
            {suggestedPrice && (
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-3 py-2 text-xs">
                <span className="text-indigo-400">
                  Preço sugerido ({suggestedPrice.margin}% margem): <strong>R$ {suggestedPrice.value.toFixed(2)}</strong>
                </span>
                <button type="button" onClick={() => setFormData({ ...formData, price: suggestedPrice.value.toFixed(2) })}
                  className="ml-2 text-indigo-400 hover:text-indigo-300 underline">
                  Usar
                </button>
                {suggestedPrice.currentProfit && (
                  <span className="ml-2 text-slate-400">
                    (atual: {suggestedPrice.currentProfit.margin >= 0 ? '+' : ''}{suggestedPrice.currentProfit.margin.toFixed(0)}% margem)
                  </span>
                )}
              </div>
            )}

            {/* Row 3: Sale Price + Stock */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-xs mb-1">Preço de Venda (R$) *</label>
                <input type="number" step="0.01" min="0.01" value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0,00"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors" required />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Estoque Inicial</label>
                <input type="number" min="0" value={formData.stockQty}
                  onChange={(e) => setFormData({ ...formData, stockQty: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
            </div>
          </div>

          {/* Variations toggle */}
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={() => { setShowVariations(!showVariations); if (!showVariations && variations.length === 0) { setVariations([{ name: '', priceModifier: 0, stockQty: 0 }]); } }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showVariations ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}>
              <Layers size={16} />
              {showVariations ? 'Variações ativadas' : 'Adicionar Variações (Cor, Tamanho, etc.)'}
            </button>
          </div>

          {showVariations && (
            <VariationEditor template={currentTemplate} variations={variations} onChange={setVariations} />
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 sticky bottom-0 bg-slate-900 py-3 border-t border-slate-800">
            <button type="button" onClick={() => setFormOpen(false)}
              className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-3 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors">
              {saving ? 'Salvando...' : editingProduct ? 'Atualizar Produto' : 'Criar Produto'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Categories Modal */}
      <CategoriesModal
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        onChanged={() => { loadCategories(); loadProducts(); }}
      />

      {/* Stock Detail Modal */}
      {stockProduct && (
        <Modal
          open={!!stockProduct}
          onClose={() => setStockProduct(null)}
          title={`Estoque - ${stockProduct.name}`}
          size="sm"
        >
          <div className="space-y-3">
            {stockProduct.hasVariations && stockProduct.variations?.length > 0 ? (
              <>
                <div className="bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-800 overflow-hidden">
                  <div className="grid grid-cols-3 gap-2 px-4 py-2 text-xs text-slate-500 bg-slate-900/50">
                    <span>Variação</span>
                    <span className="text-center">Estoque</span>
                    <span className="text-center">Est. Mínimo</span>
                  </div>
                  {stockProduct.variations.map((v: any) => {
                    const vStock = Number(v.stockQty);
                    const vLow = v.lowStockAt != null ? Number(v.lowStockAt) : null;
                    const low = vLow != null && vStock <= vLow;
                    return (
                      <div key={v.id || v.name} className="grid grid-cols-3 gap-2 px-4 py-2.5 items-center text-sm">
                        <span className="text-white truncate">{v.name}</span>
                        <span className={`text-center font-medium ${
                          low ? 'text-red-400' : vStock > 0 ? 'text-white' : 'text-slate-500'
                        }`}>
                          {vStock}
                        </span>
                        <span className="text-center text-slate-400">
                          {vLow != null ? vLow : '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between px-1 text-sm">
                  <span className="text-slate-400">Total</span>
                  <span className="text-white font-semibold">
                    {stockProduct.variations.reduce((sum: number, v: any) => sum + Number(v.stockQty), 0)} un
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center text-slate-400 py-4">
                Produto sem variações. Estoque: {Number(stockProduct.stockQty)} un
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
