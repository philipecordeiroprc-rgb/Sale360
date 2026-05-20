'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, Barcode, Edit2, ToggleLeft, ToggleRight, Trash2,
  Tags, X, Layers, DollarSign,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { CategoriesModal } from '@/components/products/CategoriesModal';
import { StockDetailModal } from '@/components/products/StockDetailModal';
import api, { type Product, type CategoryWithCount, type VariationTemplate } from '@/lib/api';
import { getProducts, getCategories } from '@/lib/offline-db';

interface FormData {
  name: string;
  description: string;
  sku: string;
  barcode: string;
  categoryId: string;
  lowStockAt: string;
  price: string;
}

const emptyForm: FormData = {
  name: '',
  description: '',
  sku: '',
  barcode: '',
  categoryId: '',
  lowStockAt: '',
  price: '',
};

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const show = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [variationName, setVariationName] = useState('');
  const [variationNames, setVariationNames] = useState<string[]>([]);

  // Product form
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Categories modal
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [costProduct, setCostProduct] = useState<Product | null>(null);
  const [costData, setCostData] = useState<any>(null);
  const [costLoading, setCostLoading] = useState(false);

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
      if (variationName) params.variationName = variationName;

      const data = await api.products.list(params);
      setProducts(data.products);
      setTotal(data.total);
      // Collect unique variation names from all products (for filter dropdown)
      if (!search && !variationName && selectedCategory === 'all') {
        const names = new Set<string>();
        data.products.forEach((p: any) => {
          (p.variations || []).forEach((v: any) => names.add(v.name));
        });
        setVariationNames(Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })));
      }
    } catch (err: any) {
      // Offline fallback: load from IndexedDB cache
      try {
        const cached = await getProducts();
        // Apply filters locally
        let results = cached;
        if (search) {
          const q = search.toLowerCase();
          results = results.filter((p: any) =>
            p.name?.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q) ||
            p.barcode?.toString().toLowerCase().includes(q)
          );
        }
        if (selectedCategory !== 'all') {
          results = results.filter((p: any) => p.categoryId === selectedCategory);
        }
        if (variationName) {
          results = results.filter((p: any) =>
            (p.variations || []).some((v: any) => v.name === variationName)
          );
        }
        setProducts(results);
        setTotal(results.length);
        if (results.length === 0 && !search && selectedCategory === 'all') {
          setError('Voce esta offline. Nenhum produto em cache.');
        }
      } catch {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, variationName]);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      const data = await api.categories.list();
      setCategories(data);
    } catch {
      // Offline fallback: load categories from IndexedDB
      try {
        const cached = await getCategories();
        setCategories(cached);
      } catch { /* silently fail */ }
    }

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
    setFormError('');
    setFormOpen(true);
  };

  // Open form for edit
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      categoryId: product.categoryId || '',
      lowStockAt: product.lowStockAt != null ? String(product.lowStockAt) : '',
      price: product.price != null ? String(product.price) : '',
    });
    setFormError('');
    setFormOpen(true);
  };

  // Save product
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) { setFormError('Nome é obrigatório'); return; }

    try {
      setSaving(true);
      const payload: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        barcode: formData.barcode.trim() || undefined,
        sku: formData.sku.trim() || undefined,
        categoryId: formData.categoryId || undefined,
      };
      if (formData.price) payload.price = parseFloat(formData.price);
      if (formData.lowStockAt) payload.lowStockAt = parseFloat(formData.lowStockAt);

      if (editingProduct) {
        await api.products.update(editingProduct.id, payload);
        show('Produto atualizado!');
      } else {
        await api.products.create(payload);
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
    <div className="space-y-4 animate-slide-up">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Produtos</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            {loading ? 'Carregando...' : `${total} produtos no catálogo`}
          </p>
        </div>
        <div className="flex gap-2 self-start">
          <button
            onClick={() => setCategoriesOpen(true)}
            className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Tags size={15} />
            Categorias
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <Plus size={16} />
            Novo
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

        {/* Separator */}
        {variationNames.length > 0 && (
          <>
            <div className="w-px h-10 bg-slate-800 self-center mx-1" />
            <select
              value={variationName}
              onChange={(e) => setVariationName(e.target.value)}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-slate-400 hover:text-white focus:border-indigo-500 outline-none cursor-pointer"
            >
              <option value="">Todas variações</option>
              {variationNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {variationName && (
              <button
                onClick={() => setVariationName('')}
                className="p-1 text-slate-500 hover:text-red-400"
              >
                <X size={14} />
              </button>
            )}
          </>
        )}
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
            <div className="col-span-1 h-4 bg-slate-800 rounded" />
            <div className="col-span-1 h-4 bg-slate-800 rounded" />
            <div className="col-span-1 h-4 bg-slate-800 rounded" />
            <div className="col-span-2 h-4 bg-slate-800 rounded" />
            <div className="col-span-1 h-4 bg-slate-800 rounded" />
            <div className="col-span-1 h-4 bg-slate-800 rounded" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-slate-800/50 grid grid-cols-12 gap-3 items-center">
              <div className="col-span-1 h-10 w-10 bg-slate-800 rounded-lg" />
              <div className="col-span-2 h-5 bg-slate-800 rounded" />
              <div className="col-span-1 h-4 bg-slate-800 rounded" />
              <div className="col-span-1 h-4 bg-slate-800 rounded" />
              <div className="col-span-1 h-5 bg-slate-800 rounded" />
              <div className="col-span-1 h-5 bg-slate-800 rounded" />
              <div className="col-span-1 h-4 bg-slate-800 rounded" />
              <div className="col-span-2 h-4 bg-slate-800 rounded" />
              <div className="col-span-1 h-8 bg-slate-800 rounded" />
              <div className="col-span-1 h-8 bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-white mb-2">Nenhum produto encontrado</h3>
          <p className="text-slate-400 mb-6">
            {search || selectedCategory !== 'all' || variationName
              ? 'Tente ajustar os filtros de busca.'
              : 'Comece cadastrando seu primeiro produto.'}
          </p>
          {!search && selectedCategory === 'all' && !variationName && (
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
                  <th className="text-right px-4 py-3 font-medium">Custo Total Méd</th>
                  <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">Margem</th>
                  <th className="text-left px-4 py-3 font-medium">Estoque</th>
                  <th className="text-right px-4 py-3 font-medium w-28">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {products.map((product) => {
                  const price = Number(product.price);
                  const hasVariations = product.hasVariations && product.variations?.length > 0;
                  const totalStock = hasVariations
                    ? product.variations.reduce((sum: number, v: any) => sum + Number(v.stockQty), 0)
                    : Number(product.stockQty);
                  // Alert: yellow when at or below lowStockAt, red when zero
                  const lowAt = hasVariations
                    ? (product.variations || []).some((v: any) => {
                        const vStock = Number(v.stockQty);
                        const vLow = v.lowStockAt != null ? Number(v.lowStockAt) : (product.lowStockAt != null ? Number(product.lowStockAt) : null);
                        return vLow != null && vStock > 0 && vStock <= vLow;
                      })
                    : (product.lowStockAt != null && totalStock > 0 && totalStock <= Number(product.lowStockAt));
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
                            <>
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                              {/* Hover overlay */}
                              <div className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
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
                                  className="p-0.5 hover:bg-white/20 rounded transition-colors"
                                  title="Alterar foto"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                                  </svg>
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!confirm('Remover foto do produto?')) return;
                                    try {
                                      await api.products.update(product.id, { imageUrl: null });
                                      show('Foto removida!');
                                      await loadProducts();
                                    } catch { show('Erro ao remover foto', 'error'); }
                                  }}
                                  className="p-0.5 hover:bg-red-500/50 rounded transition-colors"
                                  title="Remover foto"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                  </svg>
                                </button>
                              </div>
                            </>
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
                          <span className="px-2 py-0.5 rounded-md text-xs text-white whitespace-nowrap bg-indigo-500/20">
                            {product.category.name}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">-</span>
                        )}
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3 text-right">
                        <div className="text-white font-semibold">
                          {price > 0 ? `R$ ${price.toFixed(2)}` : <span className="text-slate-500 text-xs">—</span>}
                        </div>
                      </td>

                      {/* Average Total Cost (costPrice + operationalCost) */}
                      <td className="px-4 py-3 text-right">
                        {(() => {
                          const cost = Number(product.costPrice || 0);
                          const ops = Number(product.operationalCost || 0);
                          const total = cost + ops;
                          return total > 0 ? (
                            <div>
                              <span className="text-slate-300 font-mono text-sm">R$ {total.toFixed(2)}</span>
                              {ops > 0 && (
                                <span className="text-[10px] text-slate-500 block">
                                  +R$ {ops.toFixed(2)} oper.
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          );
                        })()}
                      </td>

                      {/* Margin (realizada nas vendas) */}
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        {(() => {
                          const avgMargin = product.avgMargin;
                          if (avgMargin != null) {
                            const positive = avgMargin >= 0;
                            return (
                              <span className={`text-sm font-semibold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                                {positive ? '+' : ''}{avgMargin.toFixed(0)}%
                              </span>
                            );
                          }
                          return <span className="text-slate-600 text-xs">—</span>;
                        })()}
                      </td>

                      {/* Stock */}
                      <td className="px-4 py-3">
                        <span className={`text-sm font-semibold ${
                          totalStock <= 0 ? 'text-red-400' : lowAt ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {totalStock > 0 ? `${totalStock}` : '0'}
                        </span>
                        {lowAt && (
                          <span className="text-[10px] text-amber-400 ml-1">baixo</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={async () => {
                              setCostProduct(product);
                              setCostData(null);
                              setCostLoading(true);
                              try {
                                const data = await api.inventory.batchesByProduct(product.id);
                                setCostData(data);
                              } catch { setCostData({ error: true }); }
                              setCostLoading(false);
                            }}
                            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                            title="Histórico de custos"
                          >
                            <DollarSign size={15} className="text-slate-400 hover:text-emerald-400" />
                          </button>
                          <button
                            onClick={() => setStockProduct(product)}
                            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                            title="Estoque mínimo e variações"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 hover:text-amber-400">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          </button>
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

          {/* Category */}
          <div>
            <label className="block text-slate-400 text-sm mb-1">Categoria</label>
            <select value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors">
              <option value="">Sem categoria</option>
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>

          {/* Price + Low Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-sm mb-1">Preço de Venda (R$)</label>
              <input type="number" step="0.01" min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0,00"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Estoque Mínimo (un)</label>
              <input type="number" step="1" min="0" value={formData.lowStockAt} onChange={(e) => setFormData({ ...formData, lowStockAt: e.target.value })}
                placeholder="Ex: 10"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors" />
              <p className="text-[10px] text-slate-500 mt-1">Ao atingir esta qtd, o estoque ficará amarelo. Ao zerar, vermelho.</p>
            </div>
          </div>

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
        <StockDetailModal
          product={stockProduct}
          onClose={() => setStockProduct(null)}
          onUpdated={() => loadProducts()}
        />
      )}

      {/* Cost History Modal */}
      {costProduct && (
        <Modal
          open={!!costProduct}
          onClose={() => { setCostProduct(null); setCostData(null); }}
          title={`Custos - ${costProduct.name}`}
          size="lg"
        >
          {costLoading ? (
            <div className="space-y-3 animate-pulse py-4">
              <div className="h-4 bg-slate-800 rounded w-1/3" />
              <div className="h-20 bg-slate-800 rounded" />
              <div className="h-20 bg-slate-800 rounded" />
            </div>
          ) : costData?.error ? (
            <div className="text-center text-red-400 py-6">Erro ao carregar histórico de custos.</div>
          ) : costData ? (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Custo Médio</p>
                  <p className="text-xl font-bold text-white">
                    R$ {Number(costData.summary?.averageCost || 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Em Estoque</p>
                  <p className="text-xl font-bold text-white">{costData.summary?.totalRemaining || 0} un</p>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 mb-1">Lotes Ativos</p>
                  <p className="text-xl font-bold text-white">{costData.summary?.totalBatches || 0}</p>
                </div>
              </div>

              {/* Preço de venda vs Custo */}
              {(() => {
                const cost = Number(costData.summary?.averageCost || 0);
                const price = Number(costProduct.price || 0);
                if (cost > 0 && price > 0) {
                  const margin = ((price - cost) / cost * 100);
                  return (
                    <div className={`border rounded-xl px-4 py-3 text-sm flex items-center justify-between ${
                      margin >= 0 ? 'bg-emerald-400/5 border-emerald-400/20' : 'bg-red-400/5 border-red-400/20'
                    }`}>
                      <span className="text-slate-400">
                        Preço de venda: <span className="text-white font-semibold">R$ {price.toFixed(2)}</span>
                      </span>
                      <span className={margin >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        Margem: {margin >= 0 ? '+' : ''}{margin.toFixed(0)}%
                      </span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Batches table */}
              {costData.batches?.length > 0 ? (
                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-5 gap-2 px-4 py-2.5 text-xs text-slate-500 bg-slate-900/50 border-b border-slate-800">
                    <span>Recebido em</span>
                    <span>Variação</span>
                    <span className="text-right">Custo Un.</span>
                    <span className="text-right">Qtd. Original</span>
                    <span className="text-right">Qtd. Restante</span>
                  </div>
                  <div className="divide-y divide-slate-800/50 max-h-64 overflow-y-auto">
                    {costData.batches.map((batch: any) => (
                      <div key={batch.id} className="grid grid-cols-5 gap-2 px-4 py-2.5 text-sm items-center">
                        <span className="text-slate-300">
                          {new Date(batch.receivedAt).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="text-slate-400">
                          {batch.variation?.name || '—'}
                        </span>
                        <span className="text-right text-slate-300 font-mono">
                          R$ {Number(batch.unitCost).toFixed(2)}
                        </span>
                        <span className="text-right text-slate-300">
                          {Number(batch.quantity)}
                        </span>
                        <span className={`text-right font-semibold ${
                          Number(batch.remainingQty) > 0 ? 'text-white' : 'text-slate-600'
                        }`}>
                          {Number(batch.remainingQty)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-500 py-4 bg-slate-950 border border-slate-800 rounded-xl">
                  Nenhum lote encontrado. O custo será registrado na primeira compra.
                </div>
              )}
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}
