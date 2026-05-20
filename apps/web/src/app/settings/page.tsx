'use client';

import { useState, useEffect } from 'react';
import { Percent, Save, Loader2, AlertCircle, RefreshCw, Users, Key, Plus, X, Trash2, Store } from 'lucide-react';
import CatalogoTab from './CatalogoTab';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';

const DEFAULT_CONFIGS = [
  { paymentMethod: 'cash', label: 'Dinheiro', taxRate: 0 },
  { paymentMethod: 'pix', label: 'Pix', taxRate: 0 },
  { paymentMethod: 'debit', label: 'Debito', taxRate: 1.5 },
  { paymentMethod: 'credit', label: 'Credito', taxRate: 4.5 },
  { paymentMethod: 'credit_store', label: 'Fiado', taxRate: 4.5 },
];

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const show = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

// ============================================================
// Taxas Tab
// ============================================================

function TaxasTab() {
  const [configs, setConfigs] = useState(DEFAULT_CONFIGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast, show } = useToast();

  const loadConfigs = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.paymentConfigs.list();
      setConfigs(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar configuracoes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConfigs(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.paymentConfigs.update(configs.map(c => ({
        paymentMethod: c.paymentMethod,
        taxRate: c.taxRate,
      })));
      show('Configuracoes salvas!');
    } catch (err: any) {
      show(err.message || 'Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const setTaxRate = (method: string, value: number) => {
    setConfigs(prev => prev.map(c =>
      c.paymentMethod === method ? { ...c, taxRate: value } : c
    ));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Percent size={20} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold">Taxas por Meio de Pagamento</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              Define a taxa (%) cobrada em cada forma de pagamento. Usada no calculo do lucro real das vendas.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 flex justify-center">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {error && (
            <div className="mx-5 mt-4 flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <AlertCircle size={16} className="text-amber-400 flex-shrink-0" />
              <p className="text-amber-400 text-sm flex-1">
                Usando valores padrao. Erro ao carregar: {error}
              </p>
              <button onClick={loadConfigs} className="text-amber-400 hover:text-amber-300 flex-shrink-0">
                <RefreshCw size={16} />
              </button>
            </div>
          )}

          <div className="p-5 space-y-4">
            {configs.map((config) => (
              <div key={config.paymentMethod} className="flex items-center gap-4">
                <div className="w-40">
                  <p className="text-white text-sm font-medium">{config.label}</p>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="range"
                    min="0" max="10" step="0.1"
                    value={config.taxRate}
                    onChange={(e) => setTaxRate(config.paymentMethod, Number(e.target.value))}
                    className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="w-24 flex items-center gap-1">
                    <input
                      type="number"
                      min="0" max="100" step="0.1"
                      value={config.taxRate || ''}
                      onChange={(e) => setTaxRate(config.paymentMethod, Number(e.target.value))}
                      className="w-16 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm text-center focus:border-indigo-500 outline-none"
                    />
                    <span className="text-slate-400 text-sm">%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-5 border-t border-slate-800 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Usuarios Tab (ADMIN only)
// ============================================================

function UsuariosTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'CASHIER', pin: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resetModal, setResetModal] = useState<{ userId: string; userName: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const { toast, show } = useToast();

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.tenant.users.list();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ email: '', name: '', password: '', role: 'CASHIER', pin: '' });
    setShowModal(true);
  };

  const openEdit = (tu: any) => {
    setEditingId(tu.userId);
    setForm({
      email: tu.user.email,
      name: tu.user.name,
      password: '',
      role: tu.role,
      pin: tu.pin || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await api.tenant.users.update(editingId, { role: form.role, pin: form.pin || undefined });
        show('Usuario atualizado!');
      } else {
        await api.tenant.users.create({
          email: form.email,
          name: form.name,
          password: form.password,
          role: form.role,
          pin: form.pin || undefined,
        });
        show('Usuario adicionado!');
      }
      setShowModal(false);
      loadUsers();
    } catch (err: any) {
      show(err.message || 'Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Remover este usuario da loja?')) return;
    try {
      await api.tenant.users.remove(userId);
      show('Usuario removido!');
      loadUsers();
    } catch (err: any) {
      show(err.message || 'Erro ao remover', 'error');
    }
  };

  const openResetPassword = (userId: string, userName: string) => {
    setResetModal({ userId, userName });
    setNewPassword('');
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      show('Senha deve ter no minimo 6 caracteres', 'error');
      return;
    }
    if (!resetModal) return;
    setSaving(true);
    try {
      await api.tenant.users.resetPassword(resetModal.userId, newPassword);
      show('Senha redefinida!');
      setResetModal(null);
    } catch (err: any) {
      show(err.message || 'Erro ao redefinir', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-lg">Usuarios da Loja</h2>
          <p className="text-slate-400 text-sm mt-1">Gerencie quem tem acesso ao sistema</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2.5 rounded-xl font-medium transition-colors text-sm"
        >
          <Plus size={18} />
          Adicionar
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-slate-500">{error}</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Nenhum usuario cadastrado.</div>
        ) : (
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Nome</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Email</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Funcao</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">PIN</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {users.map((tu) => (
                <tr key={tu.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-6 py-4 text-white text-sm">{tu.user?.name}</td>
                  <td className="px-6 py-4 text-slate-400 text-sm">{tu.user?.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium
                      ${tu.role === 'OWNER' ? 'bg-indigo-400/10 text-indigo-400' : 'bg-slate-400/10 text-slate-400'}
                    `}>
                      {tu.role === 'OWNER' ? 'Admin' : 'Vendedor'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">{tu.pin || '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(tu)}
                        className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => openResetPassword(tu.user.id, tu.user.name)}
                        className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        Reset Senha
                      </button>
                      <button
                        onClick={() => handleRemove(tu.userId)}
                        className="text-sm text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">
                {editingId ? 'Editar Usuario' : 'Novo Usuario'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {!editingId && (
                <>
                  <div>
                    <label className="block text-slate-400 text-sm mb-1">Nome</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-sm mb-1">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-sm mb-1">Senha</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                      required
                      minLength={6}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-slate-400 text-sm mb-1">Funcao na Loja</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="CASHIER">Vendedor</option>
                  <option value="OWNER">Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-1">PIN (4 digitos, opcional)</label>
                <input
                  type="text"
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  maxLength={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-indigo-500 hover:bg-indigo-400 text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Adicionar Usuario'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Redefinir Senha</h3>
              <button onClick={() => setResetModal(null)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <p className="text-slate-400 text-sm mb-4">
              Nova senha para <strong className="text-white">{resetModal.userName}</strong>
            </p>

            <div className="space-y-4">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nova senha (min 6 caracteres)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                minLength={6}
              />
              <button
                onClick={handleResetPassword}
                disabled={saving}
                className="w-full bg-amber-500 hover:bg-amber-400 text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? 'Redefinindo...' : 'Redefinir Senha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Minha Senha Tab
// ============================================================

function MinhaSenhaTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast, show } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      show('Nova senha deve ter no minimo 6 caracteres', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      show('As senhas nao conferem', 'error');
      return;
    }

    setSaving(true);
    try {
      await api.tenant.me.changePassword(currentPassword, newPassword);
      show('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      show(err.message || 'Erro ao alterar senha', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden max-w-lg">
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Key size={20} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold">Alterar Senha</h2>
            <p className="text-slate-400 text-xs mt-0.5">Altere sua senha de acesso ao sistema</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div>
          <label className="block text-slate-400 text-sm mb-1">Senha Atual</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            required
          />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1">Nova Senha</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            required
            minLength={6}
          />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1">Confirmar Nova Senha</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            required
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Salvando...' : 'Alterar Senha'}
        </button>
      </form>
    </div>
  );
}

// ============================================================
// Settings Page (with tabs)
// ============================================================

type Tab = 'taxas' | 'usuarios' | 'senha';

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'taxas', label: 'Taxas', icon: Percent },
  { key: 'usuarios', label: 'Usuarios', icon: Users },
  { key: 'senha', label: 'Minha Senha', icon: Key },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('taxas');
  const { user } = useAuth();
  const storeRole = user?.storeRole || '';

  // CASHIER only sees "Minha Senha"
  const availableTabs = storeRole === 'CASHIER'
    ? TABS.filter(t => t.key === 'senha')
    : TABS;

  const { toast, show } = useToast();

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Configuracoes</h1>
          <p className="text-slate-400 text-sm mt-1">Gerencie seu sistema</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {availableTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === tab.key
                ? 'bg-indigo-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'taxas' && <TaxasTab />}
      {activeTab === 'usuarios' && <UsuariosTab />}
      {activeTab === 'senha' && <MinhaSenhaTab />}

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
