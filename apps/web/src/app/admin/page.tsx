'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Plus, Shield, Building2, Search } from 'lucide-react';
import api from '@/lib/api';

interface Tenant {
  id: string;
  slug: string;
  companyName: string;
  plan: string;
  status: string;
  trialEndsAt?: string | null;
  _count?: { users: number; products: number; orders: number };
  createdAt: string;
}

interface Plan {
  label: string;
  value: string;
}

const PLANS: Plan[] = [
  { label: 'PRO', value: 'PRO' },
  { label: 'GROW', value: 'GROW' },
  { label: 'PRIME', value: 'PRIME' },
];

const STATUSES: Plan[] = [
  { label: 'Trial', value: 'TRIAL' },
  { label: 'Ativo', value: 'ACTIVE' },
  { label: 'Suspenso', value: 'SUSPENDED' },
  { label: 'Cancelado', value: 'CANCELLED' },
];

type Tab = 'stores' | 'admins';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('stores');

  return (
    <div className="p-4 md:p-6">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit max-w-full overflow-x-auto">
        <button
          onClick={() => setTab('stores')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'stores' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Building2 size={16} /> Lojas
        </button>
        <button
          onClick={() => setTab('admins')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'admins' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Shield size={16} /> Administradores
        </button>
      </div>

      {tab === 'stores' && <StoresTab />}
      {tab === 'admins' && <AdminsTab />}
    </div>
  );
}

function StoresTab() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form
  const [form, setForm] = useState({ companyName: '', slug: '', plan: 'PRO', status: 'TRIAL', trialEndsAt: '' });

  const fetchTenants = async () => {
    try {
      const data = await api.admin.tenants.list({ search: search || undefined });
      setTenants(data?.tenants || []);
    } catch {
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ companyName: '', slug: '', plan: 'PRO', status: 'TRIAL', trialEndsAt: '' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (t: Tenant) => {
    setEditingId(t.id);
    const trialEnd = t.trialEndsAt ? new Date(t.trialEndsAt).toISOString().split('T')[0] : '';
    setForm({ companyName: t.companyName, slug: t.slug, plan: t.plan, status: t.status, trialEndsAt: trialEnd });
    setError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        ...form,
        trialEndsAt: form.trialEndsAt || undefined,
      };
      if (editingId) {
        await api.admin.tenants.update(editingId, payload);
      } else {
        await api.admin.tenants.create(payload);
      }
      setShowModal(false);
      fetchTenants();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTenants();
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Lojas</h2>
          <p className="text-slate-400 text-sm mt-0.5">Gerencie todas as lojas da plataforma</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-2 rounded-lg font-medium text-sm transition-colors self-start"
        >
          <Plus size={16} />
          Nova Loja
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou slug..."
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </form>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Loja</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Slug</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Plano</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Status</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">Criada em</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">
                  Carregando...
                </td>
              </tr>
            ) : tenants.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">
                  Nenhuma loja encontrada.
                </td>
              </tr>
            ) : (
              tenants.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => router.push(`/admin/tenants/${t.id}`)}
                  className="border-b border-slate-800/50 hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <p className="text-white font-medium text-sm">{t.companyName}</p>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-sm">{t.slug}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded-md text-[11px] font-medium
                      ${t.plan === 'PRIME' ? 'bg-purple-400/10 text-purple-400' : ''}
                      ${t.plan === 'GROW' ? 'bg-blue-400/10 text-blue-400' : ''}
                      ${t.plan === 'PRO' ? 'bg-slate-400/10 text-slate-400' : ''}
                    `}>
                      {t.plan}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded-md text-[11px] font-medium
                      ${t.status === 'ACTIVE' ? 'bg-green-400/10 text-green-400' : ''}
                      ${t.status === 'SUSPENDED' ? 'bg-red-400/10 text-red-400' : ''}
                      ${t.status === 'CANCELLED' ? 'bg-red-400/10 text-red-400' : ''}
                      ${t.status === 'TRIAL' ? 'bg-yellow-400/10 text-yellow-400' : ''}
                    `}>
                      {t.status === 'ACTIVE' ? 'Ativo' : t.status === 'SUSPENDED' ? 'Suspenso' : t.status === 'CANCELLED' ? 'Cancelado' : 'Trial'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs">
                    {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">
                {editingId ? 'Editar Loja' : 'Nova Loja'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-sm mb-1">Nome da Empresa</label>
                <input
                  type="text"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-1">Slug (identificador único na URL)</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="Ex: minha-loja"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
                <p className="text-slate-500 text-xs mt-1">Apenas letras minúsculas e hífen. Ex: minha-loja</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Plano</label>
                  <select
                    value={form.plan}
                    onChange={(e) => setForm({ ...form, plan: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    {PLANS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 text-sm mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-1">Término do Trial</label>
                <input
                  type="date"
                  value={form.trialEndsAt}
                  onChange={(e) => setForm({ ...form, trialEndsAt: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <p className="text-slate-500 text-xs mt-1">Deixe em branco para sem data de trial</p>
              </div>

              {error && (
                <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-indigo-500 hover:bg-indigo-400 text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Loja'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminsTab() {
