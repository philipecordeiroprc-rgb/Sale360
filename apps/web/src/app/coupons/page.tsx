'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Tag, Percent, DollarSign, Calendar, Users } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import api from '@/lib/api';

interface FormData {
  code: string;
  description: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: string;
  minOrderValue: string;
  maxDiscount: string;
  usageLimit: string;
  validFrom: string;
  validUntil: string;
  active: boolean;
  productIds: string[];
  categoryIds: string[];
}

const emptyForm: FormData = {
  code: '', description: '', discountType: 'PERCENTAGE', discountValue: '',
  minOrderValue: '', maxDiscount: '', usageLimit: '', validFrom: '', validUntil: '',
  active: true, productIds: [], categoryIds: [],
};

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const show = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('');
  const searchTimer = useRef<NodeJS.Timeout>(undefined);

  // Products & categories for multi-select
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const { toast, show } = useToast();

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = {};
      if (search) params.search = search;
      if (activeFilter) params.active = activeFilter === 'true';
      const data = await api.coupons.list(params);
      setCoupons(data.coupons);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar cupons');
    } finally {
      setLoading(false);
    }
  }, [search, activeFilter]);

  useEffect(() => { loadCoupons(); }, [loadCoupons]);

  // Load products/categories for the form
  useEffect(() => {
    if (formOpen) {
      api.products.list().then((d: any) => setProducts(d.products || [])).catch(() => {});
      api.categories.list().then((d: any) => setCategories(d || [])).catch(() => {});
    }
  }, [formOpen]);

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {}, 300);
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData({ ...emptyForm });
    setFormOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setFormData({
      code: c.code || '',
      description: c.description || '',
      discountType: c.discountType || 'PERCENTAGE',
      discountValue: c.discountValue != null ? String(c.discountValue) : '',
      minOrderValue: c.minOrderValue != null ? String(c.minOrderValue) : '',
      maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : '',
      usageLimit: c.usageLimit != null ? String(c.usageLimit) : '',
      validFrom: c.validFrom ? c.validFrom.slice(0, 10) : '',
      validUntil: c.validUntil ? c.validUntil.slice(0, 10) : '',
      active: c.active,
      productIds: c.products?.map((p: any) => p.productId) || [],
      categoryIds: c.categories?.map((c: any) => c.categoryId) || [],
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code.trim()) return;
    setSaving(true);
    try {
      const data: any = {
        code: formData.code.trim(),
        description: formData.description || undefined,
        discountType: formData.discountType,
        discountValue: parseFloat(formData.discountValue) || 0,
        minOrderValue: formData.minOrderValue ? parseFloat(formData.minOrderValue) : undefined,
        maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : undefined,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : undefined,
        validFrom: formData.validFrom || undefined,
        validUntil: formData.validUntil || undefined,
        active: formData.active,
        productIds: formData.productIds.length > 0 ? formData.productIds : undefined,
        categoryIds: formData.categoryIds.length > 0 ? formData.categoryIds : undefined,
      };
      if (editingId) {
        await api.coupons.update(editingId, data);
        show('Cupom atualizado!');
      } else {
        await api.coupons.create(data);
        show('Cupom criado!');
      }
      setFormOpen(false);
      loadCoupons();
    } catch (err: any) {
      show(err.message || 'Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este cupom?')) return;
    try {
      await api.coupons.delete(id);
      show('Cupom removido!');
      loadCoupons();
    } catch (err: any) {
      show(err.message || 'Erro ao excluir', 'error');
    }
  };

  const toggleProduct = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      productIds: prev.productIds.includes(id)
        ? prev.productIds.filter((pid) => pid !== id)
        : [...prev.productIds, id],
    }));
  };

  const toggleCategory = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id)
        ? prev.categoryIds.filter((cid) => cid !== id)
        : [...prev.categoryIds, id],
    }));
  };

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2)}`;
  const formatDate = (d: string | null) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('pt-BR');
  };

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Cupons de Desconto</h1>
          <p className="text-slate-400 text-sm mt-1">{coupons.length} cupons</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium text-sm transition-colors"
        >
          <Plus size={18} /> Novo Cupom
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por código ou descrição..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadCoupons()}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          className="px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
        >
          <option value="">Todos</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-slate-800 rounded w-3/4 mb-3" />
              <div className="h-4 bg-slate-800 rounded w-1/2 mb-2" />
              <div className="h-4 bg-slate-800 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400 mb-3">{error}</p>
          <button onClick={loadCoupons} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm">Tentar novamente</button>
        </div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-12">
          <Tag size={48} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 mb-3">Nenhum cupom encontrado</p>
          <button onClick={openCreate} className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm">Criar primeiro cupom</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map((c) => (
            <div key={c.id} className={`bg-slate-900 border rounded-xl p-5 transition-colors ${
              c.active ? 'border-slate-800 hover:border-slate-700' : 'border-slate-800/50 opacity-60'
            }`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold text-lg tracking-wider font-mono">{c.code}</h3>
                    {c.discountType === 'PERCENTAGE' ? (
                      <Percent size={16} className="text-indigo-400" />
                    ) : (
                      <DollarSign size={16} className="text-emerald-400" />
                    )}
                  </div>
                  {c.description && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{c.description}</p>
                  )}
                </div>
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${c.active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              </div>

              <div className="space-y-1.5 mb-4">
                <p className="text-sm text-slate-300 font-medium">
                  {c.discountType === 'PERCENTAGE'
                    ? `${Number(c.discountValue)}% de desconto`
                    : `${formatCurrency(Number(c.discountValue))} de desconto`}
                </p>
                {c.maxDiscount > 0 && (
                  <p className="text-xs text-slate-500">Máx desconto: {formatCurrency(Number(c.maxDiscount))}</p>
                )}
                {c.minOrderValue > 0 && (
                  <p className="text-xs text-slate-500">Pedido mín: {formatCurrency(Number(c.minOrderValue))}</p>
                )}
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Users size={12} />
                  <span>{c.usageCount || 0} uso(s){c.usageLimit ? ` / ${c.usageLimit}` : ''}</span>
                  <span className="ml-2">
                    {c._count?.orders ? `${c._count.orders} venda(s)` : ''}
                  </span>
                </div>
                {(c.validFrom || c.validUntil) && (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar size={12} />
                    <span>
                      {formatDate(c.validFrom) || '...'} até {formatDate(c.validUntil) || '...'}
                    </span>
                  </div>
                )}
                {/* Product/Category chips */}
                {c.products?.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {c.products.slice(0, 4).map((p: any) => (
                      <span key={p.product?.id || p.productId} className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-400">
                        {p.product?.name || p.productId}
                      </span>
                    ))}
                    {c.products.length > 4 && (
                      <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-400">
                        +{c.products.length - 4}
                      </span>
                    )}
                  </div>
                )}
                {c.categories?.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {c.categories.slice(0, 4).map((cat: any) => (
                      <span key={cat.category?.id || cat.categoryId} className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-indigo-400/70">
                        {cat.category?.name || cat.categoryId}
                      </span>
                    ))}
                    {c.categories.length > 4 && (
                      <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-indigo-400/70">
                        +{c.categories.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                <button onClick={() => openEdit(c)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(c.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors ml-auto">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Editar Cupom' : 'Novo Cupom'}
        size="lg"
        closeOnOverlayClick={false}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm text-slate-400 mb-1">Código *</label>
              <input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="Ex: PROMO10"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-mono focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Ativo</label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, active: !formData.active })}
                className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  formData.active ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}
              >
                {formData.active ? 'Ativo' : 'Inativo'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Descrição</label>
            <input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ex: 10% off em camisetas"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Tipo de Desconto</label>
              <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, discountType: 'PERCENTAGE' })}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm transition-colors ${
                    formData.discountType === 'PERCENTAGE'
                      ? 'bg-indigo-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Percent size={14} /> %
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, discountType: 'FIXED' })}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm transition-colors ${
                    formData.discountType === 'FIXED'
                      ? 'bg-indigo-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <DollarSign size={14} /> R$
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                {formData.discountType === 'PERCENTAGE' ? 'Valor (%)' : 'Valor (R$)'}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.discountValue}
                onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Pedido Mínimo (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.minOrderValue}
                onChange={(e) => setFormData({ ...formData, minOrderValue: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                {formData.discountType === 'PERCENTAGE' ? 'Desconto Máx (R$)' : '—'}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                disabled={formData.discountType !== 'PERCENTAGE'}
                value={formData.maxDiscount}
                onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none disabled:opacity-40"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Limite de Usos</label>
              <input
                type="number"
                min="0"
                value={formData.usageLimit}
                onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Válido de</label>
              <input
                type="date"
                value={formData.validFrom}
                onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Válido até</label>
              <input
                type="date"
                value={formData.validUntil}
                onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Product selection */}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">
              Produtos ({formData.productIds.length} selecionados)
            </label>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 max-h-32 overflow-y-auto space-y-0.5">
              {products.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-2">Nenhum produto cadastrado</p>
              ) : (
                products.slice(0, 50).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProduct(p.id)}
                    className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                      formData.productIds.includes(p.id)
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {p.name}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Category selection */}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">
              Categorias ({formData.categoryIds.length} selecionadas)
            </label>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-2 max-h-32 overflow-y-auto space-y-0.5">
              {categories.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-2">Nenhuma categoria cadastrada</p>
              ) : (
                categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                      formData.categoryIds.includes(cat.id)
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-slate-400 text-sm hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formData.code.trim()}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Cupom'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
