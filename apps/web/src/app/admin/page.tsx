'use client';

import { useEffect, useState } from 'react';
import { X, Plus } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)sale360_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

interface Tenant {
  id: string;
  slug: string;
  companyName: string;
  plan: string;
  status: string;
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
  { label: 'Ativo', value: 'ACTIVE' },
  { label: 'Inativo', value: 'INACTIVE' },
  { label: 'Trial', value: 'TRIAL' },
];

export default function AdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form
  const [form, setForm] = useState({ companyName: '', slug: '', plan: 'PRO', status: 'TRIAL' });

  const fetchTenants = async () => {
    try {
      const token = getToken();
      const sp = new URLSearchParams();
      if (search) sp.set('search', search);
      const res = await fetch(`${API_URL}/api/admin/tenants?${sp.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTenants(Array.isArray(data) ? data : data.tenants || []);
    } catch {
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ companyName: '', slug: '', plan: 'PRO', status: 'TRIAL' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (t: Tenant) => {
    setEditingId(t.id);
    setForm({ companyName: t.companyName, slug: t.slug, plan: t.plan, status: t.status });
    setError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const token = getToken();
      const url = editingId
        ? `${API_URL}/api/admin/tenants/${editingId}`
        : `${API_URL}/api/admin/tenants`;
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao salvar');
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
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Lojas</h2>
          <p className="text-slate-400 mt-1">Gerencie todas as lojas da plataforma</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2.5 rounded-xl font-medium transition-colors"
        >
          <Plus size={18} />
          Nova Loja
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou slug..."
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </form>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Loja</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Slug</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Plano</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Status</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Criada em</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  Carregando...
                </td>
              </tr>
            ) : tenants.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  Nenhuma loja encontrada.
                </td>
              </tr>
            ) : (
              tenants.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => openEdit(t)}
                  className="border-b border-slate-800/50 hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="text-white font-medium">{t.companyName}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{t.slug}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium
                      ${t.plan === 'PRIME' ? 'bg-purple-400/10 text-purple-400' : ''}
                      ${t.plan === 'GROW' ? 'bg-blue-400/10 text-blue-400' : ''}
                      ${t.plan === 'PRO' ? 'bg-slate-400/10 text-slate-400' : ''}
                    `}>
                      {t.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium
                      ${t.status === 'ACTIVE' ? 'bg-green-400/10 text-green-400' : ''}
                      ${t.status === 'INACTIVE' ? 'bg-red-400/10 text-red-400' : ''}
                      ${t.status === 'TRIAL' ? 'bg-yellow-400/10 text-yellow-400' : ''}
                    `}>
                      {t.status === 'ACTIVE' ? 'Ativo' : t.status === 'INACTIVE' ? 'Inativo' : 'Trial'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">
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
                <label className="block text-slate-400 text-sm mb-1">Slug (URL)</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
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
