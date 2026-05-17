'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, Edit2, ToggleLeft, ToggleRight, Trash2, Phone, Mail, Building2, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import api from '@/lib/api';

interface FormData {
  name: string;
  cnpj: string;
  ie: string;
  email: string;
  phone: string;
  whatsapp: string;
  contactName: string;
  address: string;
  addressNumber: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  notes: string;
}

const emptyForm: FormData = {
  name: '', cnpj: '', ie: '', email: '', phone: '', whatsapp: '',
  contactName: '', address: '', addressNumber: '', complement: '',
  neighborhood: '', city: '', state: '', zipCode: '', notes: '',
};

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const show = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const searchTimer = useRef<NodeJS.Timeout>(undefined);

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const { toast, show } = useToast();

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.suppliers.list({ search: search || undefined, page });
      setSuppliers(data.suppliers);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar fornecedores');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); }, 300);
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData({ ...emptyForm });
    setFormOpen(true);
  };

  const openEdit = (s: any) => {
    setEditingId(s.id);
    setFormData({
      name: s.name, cnpj: s.cnpj || '', ie: s.ie || '', email: s.email || '',
      phone: s.phone || '', whatsapp: s.whatsapp || '', contactName: s.contactName || '',
      address: s.address || '', addressNumber: s.addressNumber || '', complement: s.complement || '',
      neighborhood: s.neighborhood || '', city: s.city || '', state: s.state || '',
      zipCode: s.zipCode || '', notes: s.notes || '',
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      const data = { ...formData, cnpj: formData.cnpj || undefined, ie: formData.ie || undefined };
      if (editingId) {
        await api.suppliers.update(editingId, data);
        show('Fornecedor atualizado!');
      } else {
        await api.suppliers.create(data);
        show('Fornecedor criado!');
      }
      setFormOpen(false);
      loadSuppliers();
    } catch (err: any) {
      show(err.message || 'Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.suppliers.toggle(id);
      loadSuppliers();
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este fornecedor?')) return;
    try {
      await api.suppliers.delete(id);
      show('Fornecedor removido!');
      loadSuppliers();
    } catch (err: any) {
      show(err.message || 'Erro ao excluir', 'error');
    }
  };

  const formatPhone = (p: string) => {
    if (!p) return '';
    const d = p.replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return p;
  };

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Fornecedores</h1>
          <p className="text-slate-400 text-sm mt-1">{total} fornecedores cadastrados</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium text-sm transition-colors"
        >
          <Plus size={18} /> Novo Fornecedor
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar por nome, CNPJ, email ou telefone..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
        />
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
          <button onClick={loadSuppliers} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm">Tentar novamente</button>
        </div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-12">
          <Building2 size={48} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 mb-3">Nenhum fornecedor encontrado</p>
          <button onClick={openCreate} className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm">Cadastrar primeiro fornecedor</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((s) => (
              <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold truncate">{s.name}</h3>
                    {s.cnpj && <p className="text-xs text-slate-500 mt-0.5">CNPJ: {s.cnpj}</p>}
                  </div>
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${s.active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                </div>

                <div className="space-y-1.5 mb-4">
                  {s.email && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Mail size={14} /> {s.email}
                    </div>
                  )}
                  {s.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Phone size={14} /> {formatPhone(s.phone)}
                    </div>
                  )}
                  {s._count && (
                    <p className="text-xs text-slate-500">{s._count.purchases} compras</p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                  <button onClick={() => openEdit(s)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleToggle(s.id)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                    {s.active ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} />}
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors ml-auto">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > 50 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 bg-slate-900 text-slate-400 rounded-lg text-sm disabled:opacity-40">Anterior</button>
              <span className="text-slate-400 text-sm">Página {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 50 >= total}
                className="px-3 py-1.5 bg-slate-900 text-slate-400 rounded-lg text-sm disabled:opacity-40">Próxima</button>
            </div>
          )}
        </>
      )}

      {/* Form Modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? 'Editar Fornecedor' : 'Novo Fornecedor'} size="lg">
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Nome *</label>
            <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">CNPJ</label>
              <input value={formData.cnpj} onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Inscrição Estadual</label>
              <input value={formData.ie} onChange={(e) => setFormData({ ...formData, ie: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Telefone</label>
              <input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">WhatsApp</label>
              <input value={formData.whatsapp} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Contato</label>
              <input value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800">
            <p className="text-xs text-slate-500 mb-2">Endereço</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Logradouro" className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <input value={formData.addressNumber} onChange={(e) => setFormData({ ...formData, addressNumber: e.target.value })}
                  placeholder="Número" className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input value={formData.neighborhood} onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                placeholder="Bairro" className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
            </div>
            <div>
              <input value={formData.complement} onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                placeholder="Complemento" className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Cidade" className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
            </div>
            <div>
              <input value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="UF" className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Observações</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-slate-400 text-sm hover:text-white transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !formData.name.trim()}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Fornecedor'}
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
