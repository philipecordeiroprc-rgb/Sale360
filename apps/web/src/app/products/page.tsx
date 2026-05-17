'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Search, Barcode, Edit2, ToggleLeft, ToggleRight, Trash2,
  Tags, X,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { CategoriesModal } from '@/components/products/CategoriesModal';
import api, { type Product, type CategoryWithCount } from '@/lib/api';

const UNITS = ['UN', 'KG', 'G', 'L', 'ML', 'M'] as const;

// Simple toast
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

  // Product form modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stockQty: '0',
    barcode: '',
    categoryId: '',
    unit: 'UN',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Categories modal
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadProducts();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [loadProducts]);

  // Open form for create
  const handleCreate = () => {
    setEditingProduct(null);
    setFormData({ name: '', price: '', stockQty: '0', barcode: '', categoryId: '', unit: 'UN' });
    setFormError('');
    setFormOpen(true);
  };

  // Open form for edit
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: String(product.price),
      stockQty: String(product.stockQty),
      barcode: product.barcode || '',
      categoryId: product.categoryId || '',
      unit: product.unit,
    });
    setFormError('');
    setFormOpen(true);
  };

  // Save product (create or update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const price = parseFloat(formData.price);
    if (!formData.name.trim()) { setFormError('Nome é obrigatório'); return; }
    if (isNaN(price) || price <= 0) { setFormError('Preço deve ser maior que zero'); return; }

    try {
      setSaving(true);
      const payload = {
        name: formData.name.trim(),
        price,
        stockQty: parseInt(formData.stockQty) || 0,
        barcode: formData.barcode.trim() || undefined,
        categoryId: formData.categoryId || undefined,
        unit: formData.unit,
      };

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
    <div className="space-y-6 animate-slide-up">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg animate-slide-up ${
            toast.type === 'success'
              ? 'bg-emerald-500 text-white'
              : 'bg-red-500 text-white'
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
            placeholder="Buscar por nome ou código de barras..."
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

      {/* Error state */}
      {error && !loading && (
        <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-8 text-center">
          <p className="text-red-400 mb-2">{error}</p>
          <button
            onClick={loadProducts}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 animate-pulse">
              <div className="flex items-start justify-between mb-3">
                <div className="w-14 h-14 rounded-xl bg-slate-800" />
                <div className="flex gap-1">
                  <div className="w-8 h-8 rounded-lg bg-slate-800" />
                  <div className="w-8 h-8 rounded-lg bg-slate-800" />
                </div>
              </div>
              <div className="h-6 bg-slate-800 rounded w-3/4 mb-3" />
              <div className="h-4 bg-slate-800 rounded w-1/4 mb-4" />
              <div className="flex justify-between">
                <div className="h-8 bg-slate-800 rounded w-24" />
                <div className="h-4 bg-slate-800 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
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

      {/* Product Grid */}
      {!loading && !error && products.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className={`bg-slate-900 border rounded-2xl p-5 transition-all hover:border-slate-500 ${
                product.active ? 'border-slate-800' : 'border-slate-800/50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                  style={{
                    backgroundColor: (product.category?.color || '#6366F1') + '20',
                  }}
                >
                  📦
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(product)}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={16} className="text-slate-400" />
                  </button>
                  <button
                    onClick={() => handleToggle(product)}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    title={product.active ? 'Desativar' : 'Ativar'}
                  >
                    {product.active ? (
                      <ToggleRight size={16} className="text-emerald-400" />
                    ) : (
                      <ToggleLeft size={16} className="text-slate-400" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(product)}
                    disabled={deletingId === product.id}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                    title="Excluir"
                  >
                    <Trash2 size={16} className="text-slate-400 hover:text-red-400" />
                  </button>
                </div>
              </div>

              <h3 className="text-white font-semibold text-lg mb-1">{product.name}</h3>

              <div className="flex items-center gap-2 mb-3">
                {product.category && (
                  <span
                    className="px-2 py-0.5 rounded-md text-xs text-white"
                    style={{ backgroundColor: (product.category.color || '#6366F1') + '30' }}
                  >
                    {product.category.name}
                  </span>
                )}
                {product.barcode && (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Barcode size={12} />
                    {product.barcode}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-emerald-400">
                  R$ {Number(product.price).toFixed(2)}
                </span>
                <span
                  className={`text-sm ${
                    Number(product.stockQty) > 10
                      ? 'text-slate-400'
                      : Number(product.stockQty) > 0
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }`}
                >
                  {Number(product.stockQty) > 0 ? `${Number(product.stockQty)} un` : 'Sem estoque'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Product Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingProduct ? 'Editar Produto' : 'Novo Produto'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center justify-between">
              <span>{formError}</span>
              <button type="button" onClick={() => setFormError('')} className="text-red-400 hover:text-red-300">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-slate-400 text-sm mb-1">Nome *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome do produto"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              required
            />
          </div>

          {/* Price + Unit */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-slate-400 text-sm mb-1">Preço (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0,00"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Unidade</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Stock + Barcode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-sm mb-1">Estoque</label>
              <input
                type="number"
                min="0"
                value={formData.stockQty}
                onChange={(e) => setFormData({ ...formData, stockQty: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Código de Barras</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="789..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-slate-400 text-sm mb-1">Categoria</label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">Sem categoria</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors"
            >
              {saving ? 'Salvando...' : editingProduct ? 'Atualizar' : 'Criar Produto'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Categories Modal */}
      <CategoriesModal
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        onChanged={() => {
          loadCategories();
          loadProducts();
        }}
      />
    </div>
  );
}
