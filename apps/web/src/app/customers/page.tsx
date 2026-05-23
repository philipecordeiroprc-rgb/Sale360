'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Phone, Mail, FileText, Eye, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import api from '@/lib/api';
import { getCustomers } from '@/lib/offline-db';

interface FormData {
  name: string;
  phone: string;
  email: string;
  document: string;
  notes: string;
}

const emptyForm: FormData = { name: '', phone: '', email: '', document: '', notes: '' };

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const show = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const searchTimer = useRef<NodeJS.Timeout>(undefined);
  const { toast, show } = useToast();

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  // Detail
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Expandable row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.customers.list({ search: search || undefined, page });
      setCustomers(data.customers);
      setTotal(data.total);
    } catch (err: any) {
      // Offline fallback: load from IndexedDB cache
      try {
        const cached = await getCustomers();
        if (search) {
          const q = search.toLowerCase();
          const filtered = cached.filter((c: any) =>
            c.name?.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.phone?.toLowerCase().includes(q) ||
            c.document?.toLowerCase().includes(q)
          );
          setCustomers(filtered);
          setTotal(filtered.length);
        } else {
          setCustomers(cached);
          setTotal(cached.length);
        }
        if (cached.length === 0) setError('Voce esta offline. Nenhum cliente em cache.');
      } catch {
        setError(err.message || 'Erro ao carregar clientes');
      }
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

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

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setFormData({
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      document: c.document || '',
      notes: c.notes || '',
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await api.customers.update(editingId, formData);
        show('Cliente atualizado!');
      } else {
        await api.customers.create(formData);
        show('Cliente cadastrado!');
      }
      setFormOpen(false);
      loadCustomers();
    } catch (err: any) {
      show(err.message || 'Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este cliente?')) return;
    try {
      await api.customers.delete(id);
      show('Cliente removido!');
      loadCustomers();
    } catch (err: any) {
      show(err.message || 'Erro ao excluir', 'error');
    }
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const data = await api.customers.get(id);
      setDetailCustomer(data);
    } catch { show('Erro ao carregar detalhes', 'error'); }
    finally { setDetailLoading(false); }
  };

  const formatPhone = (p: string) => {
    if (!p) return '';
    const d = p.replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return p;
  };

  const formatDoc = (doc: string) => {
    if (!doc) return '';
    const d = doc.replace(/\D/g, '');
    if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
    if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
    return doc;
  };

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-slate-400 text-sm mt-1">{total} clientes cadastrados</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium text-sm transition-colors">
          <Plus size={18} /> Novo Cliente
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou documento..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Content */}
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
          <button onClick={loadCustomers} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm">Tentar novamente</button>
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400 mb-3">Nenhum cliente encontrado</p>
          <button onClick={openCreate} className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm">Cadastrar primeiro cliente</button>
        </div>
      ) : (
        <>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-slate-800">
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Telefone</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Email</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Documento</th>
                  <th className="text-right px-4 py-3">Compras</th>
                  <th className="text-right px-4 py-3">Total Gasto</th>
                  <th className="text-right px-4 py-3 hidden md:table-cell">Fiado</th>
                  <th className="text-left px-4 py-3 hidden xl:table-cell">Última Compra</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c: any) => (
                  <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{formatPhone(c.phone)}</td>
                    <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">{formatDoc(c.document)}</td>
                    <td className="px-4 py-3 text-right text-white">{c.totalPurchases}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-medium">R$ {Number(c.totalSpent).toFixed(2)}</td>
                    <td className={`px-4 py-3 text-right font-medium hidden md:table-cell ${Number(c.creditBalance) > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                      R$ {Number(c.creditBalance).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden xl:table-cell">
                      {c.lastPurchaseAt ? new Date(c.lastPurchaseAt).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openDetail(c.id)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors" title="Ver histórico">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => openEdit(c)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Editar">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(c.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors" title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 50 && (
            <div className="flex items-center justify-center gap-2 mt-4">
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
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? 'Editar Cliente' : 'Novo Cliente'} size="md" closeOnOverlayClick={false}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Nome *</label>
            <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Telefone</label>
              <input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(11) 99999-0001"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">CPF / CNPJ</label>
              <input value={formData.document} onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                placeholder="000.000.000-00"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Observações</label>
              <input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas sobre o cliente..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setFormOpen(false)} className="px-4 py-2 text-slate-400 text-sm hover:text-white">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !formData.name.trim()}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Cliente'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => { setDetailOpen(false); setDetailCustomer(null); }} title="Histórico do Cliente" size="lg">
        {detailLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-slate-800 rounded-lg p-3 animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-2/3 mb-2" />
                <div className="h-3 bg-slate-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : detailCustomer ? (
          <div className="space-y-5">
            {/* Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase mb-0.5">Nome</p>
                <p className="text-white text-sm font-medium">{detailCustomer.name}</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase mb-0.5">Telefone</p>
                <p className="text-white text-sm">{formatPhone(detailCustomer.phone)}</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase mb-0.5">Total Gasto</p>
                <p className="text-emerald-400 text-sm font-semibold">R$ {Number(detailCustomer.totalSpent).toFixed(2)}</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase mb-0.5">Fiado</p>
                <p className={`text-sm font-semibold ${Number(detailCustomer.creditBalance) > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  R$ {Number(detailCustomer.creditBalance).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Orders */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Últimos Pedidos</h4>
              {detailCustomer.orders?.length > 0 ? (
                <div className="bg-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 text-xs border-b border-slate-700">
                        <th className="text-left px-3 py-2">#</th>
                        <th className="text-left px-3 py-2">Data</th>
                        <th className="text-left px-3 py-2">Status</th>
                        <th className="text-right px-3 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailCustomer.orders.map((o: any) => (
                        <tr key={o.id} className="border-b border-slate-700/50">
                          <td className="px-3 py-2 text-white">#{o.orderNumber}</td>
                          <td className="px-3 py-2 text-xs text-slate-400">
                            {new Date(o.createdAt).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              o.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' :
                              o.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400' :
                              'bg-amber-500/20 text-amber-400'
                            }`}>
                              {o.status === 'PAID' ? 'Pago' : o.status === 'CANCELLED' ? 'Cancelado' : o.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-white">R$ {Number(o.total).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Nenhum pedido registrado.</p>
              )}
            </div>

            {/* Credit Transactions */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Movimentações de Fiado</h4>
              {detailCustomer.creditTransactions?.length > 0 ? (
                <div className="bg-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 text-xs border-b border-slate-700">
                        <th className="text-left px-3 py-2">Data</th>
                        <th className="text-left px-3 py-2">Tipo</th>
                        <th className="text-right px-3 py-2">Valor</th>
                        <th className="text-left px-3 py-2">Obs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailCustomer.creditTransactions.map((t: any) => {
                        const isDebit = t.type === 'PAYMENT';
                        return (
                          <tr key={t.id} className="border-b border-slate-700/50">
                            <td className="px-3 py-2 text-xs text-slate-400">
                              {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                isDebit ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {t.type === 'LOAN' ? 'Empréstimo' :
                                 t.type === 'PAYMENT' ? 'Pagamento' :
                                 t.type === 'TOPUP' ? 'Recarga' : t.type}
                              </span>
                            </td>
                            <td className={`px-3 py-2 text-right ${isDebit ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {isDebit ? '-' : '+'} R$ {Number(t.amount).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-[120px]">{t.notes || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Nenhuma movimentação de fiado.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-slate-400 text-center py-4">Cliente não encontrado.</p>
        )}
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
