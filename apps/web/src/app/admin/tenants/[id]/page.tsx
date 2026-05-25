'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X, Trash2, Loader2, Save, Copy } from 'lucide-react';
import api from '@/lib/api';

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const show = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

// ============================================================
// Feature labels & descriptions
// ============================================================
const FEATURE_DEFS: { key: string; label: string; description: string }[] = [
  { key: 'webVersion', label: 'Versão Web', description: 'Acesso ao painel web completo' },
  { key: 'aiDescriptions', label: 'Descrições IA', description: 'Geração de descrições de produtos com IA' },
  { key: 'aiAssistant', label: 'Assistente IA', description: 'Assistente virtual dentro do PDV' },
  { key: 'magicRegister', label: 'Cadastro Mágico', description: 'Cadastro rápido de produtos por foto' },
  { key: 'variations', label: 'Variações', description: 'Variações de produtos (cor, tamanho, etc)' },
  { key: 'bulkImport', label: 'Importação em Lote', description: 'Importar produtos via CSV/planilha' },
  { key: 'suppliers', label: 'Fornecedores', description: 'Gestão de fornecedores e compras' },
  { key: 'recurrentExpenses', label: 'Despesas Recorrentes', description: 'Controle de despesas fixas mensais' },
  { key: 'unlimitedUsers', label: 'Usuários Ilimitados', description: 'Sem limite de usuários por loja' },
  { key: 'prioritySupport', label: 'Suporte Prioritário', description: 'Atendimento prioritário no suporte' },
  { key: 'saturday', label: 'Suporte Sábado', description: 'Suporte aos sábados' },
  { key: 'videoCall', label: 'Videochamada', description: 'Suporte por videochamada' },
  { key: 'whatsappSupport', label: 'Suporte WhatsApp', description: 'Suporte direto via WhatsApp' },
];

type Tab = 'info' | 'users' | 'modules';

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast, show } = useToast();

  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('info');

  // Info form
  const [infoForm, setInfoForm] = useState({ companyName: '', slug: '', plan: 'PRO', status: 'TRIAL', trialEndsAt: '' });
  const [infoSaving, setInfoSaving] = useState(false);

  // Users
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ email: '', name: '', password: '', role: 'CASHIER', pin: '' });
  const [userSaving, setUserSaving] = useState(false);
  const [resetModal, setResetModal] = useState<{ userId: string; userName: string; loading: boolean; resetLink: string; emailSent: boolean } | null>(null);

  // Modules
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [featuresSaving, setFeaturesSaving] = useState(false);

  useEffect(() => {
    loadTenant();
  }, [id]);

  const loadTenant = async () => {
    setLoading(true);
    try {
      const data = await api.admin.tenants.get(id);
      setTenant(data);
      const trialEnd = data.trialEndsAt ? new Date(data.trialEndsAt).toISOString().split('T')[0] : '';
      setInfoForm({
        companyName: data.companyName || '',
        slug: data.slug || '',
        plan: data.plan || 'PRO',
        status: data.status || 'TRIAL',
        trialEndsAt: trialEnd,
      });
    } catch (err: any) {
      show(err.message || 'Erro ao carregar loja', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // Info
  // ============================================================
  const handleInfoSave = async () => {
    setInfoSaving(true);
    try {
      await api.admin.tenants.update(id, {
        ...infoForm,
        trialEndsAt: infoForm.trialEndsAt || null,
      });
      show('Loja atualizada!');
      loadTenant();
    } catch (err: any) {
      show(err.message, 'error');
    } finally {
      setInfoSaving(false);
    }
  };

  // ============================================================
  // Users
  // ============================================================
  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const data = await api.admin.tenants.users.list(id);
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
  }, [activeTab]);

  const openUserCreate = () => {
    setEditingUserId(null);
    setUserForm({ email: '', name: '', password: '', role: 'CASHIER', pin: '' });
    setShowUserModal(true);
  };

  const openUserEdit = (tu: any) => {
    setEditingUserId(tu.userId);
    setUserForm({
      email: tu.user?.email || '',
      name: tu.user?.name || '',
      password: '',
      role: tu.role || 'CASHIER',
      pin: tu.pin || '',
    });
    setShowUserModal(true);
  };

  const handleUserSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserSaving(true);
    try {
      if (editingUserId) {
        await api.admin.tenants.users.update(id, editingUserId, {
          name: userForm.name,
          email: userForm.email,
          role: userForm.role,
          pin: userForm.pin || undefined,
        });
      } else {
        await api.admin.tenants.users.add(id, {
          email: userForm.email,
          name: userForm.name,
          password: userForm.password,
          role: userForm.role,
          pin: userForm.pin || undefined,
        });
      }

      show(editingUserId ? 'Usuário atualizado!' : 'Usuário adicionado!');
      setShowUserModal(false);
      loadUsers();
    } catch (err: any) {
      show(err.message, 'error');
    } finally {
      setUserSaving(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm('Remover este usuário da loja?')) return;
    try {
      await api.admin.tenants.users.remove(id, userId);
      show('Usuário removido!');
      loadUsers();
    } catch (err: any) {
      show(err.message, 'error');
    }
  };

  const openResetPassword = async (userId: string, userName: string) => {
    setResetModal({ userId, userName, loading: true, resetLink: '', emailSent: false });
    try {
      const result = await api.admin.tenants.users.sendResetLink(id, userId);
      setResetModal({ userId, userName, loading: false, resetLink: result.resetLink, emailSent: result.emailSent });
    } catch (err: any) {
      show(err.message || 'Erro ao gerar link', 'error');
      setResetModal(null);
    }
  };

  const copyResetLink = () => {
    if (resetModal?.resetLink) {
      navigator.clipboard.writeText(resetModal.resetLink);
      show('Link copiado!');
    }
  };

  // ============================================================
  // Modules
  // ============================================================
  const loadFeatures = async () => {
    setFeaturesLoading(true);
    try {
      const data = await api.admin.tenants.features.get(id);
      setFeatures(data.features || {});
      setOverrides(data.overrides || {});
    } catch {
      show('Erro ao carregar módulos', 'error');
    } finally {
      setFeaturesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'modules') loadFeatures();
  }, [activeTab]);

  const toggleFeature = (key: string) => {
    setOverrides(prev => {
      const current = key in prev ? prev[key] : features[key];
      return { ...prev, [key]: !current };
    });
  };

  const handleFeaturesSave = async () => {
    setFeaturesSaving(true);
    try {
      await api.admin.tenants.features.update(id, overrides);
      show('Módulos atualizados!');
      loadFeatures();
    } catch (err: any) {
      show(err.message, 'error');
    } finally {
      setFeaturesSaving(false);
    }
  };

  const getEffectiveValue = (key: string): boolean => {
    return key in overrides ? overrides[key] : features[key];
  };

  // ============================================================
  // Render
  // ============================================================
  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-8 text-center text-slate-500">Loja não encontrada.</div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Informações' },
    { key: 'users', label: 'Usuários' },
    { key: 'modules', label: 'Módulos' },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/admin')}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">{tenant.companyName}</h2>
          <p className="text-slate-400 text-sm">{tenant.slug}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === tab.key
                ? 'bg-indigo-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Informações */}
      {activeTab === 'info' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg">
          <div className="space-y-4">
            <div>
              <label className="block text-slate-400 text-sm mb-1">Nome da Empresa</label>
              <input
                type="text"
                value={infoForm.companyName}
                onChange={(e) => setInfoForm({ ...infoForm, companyName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Slug (identificador único na URL)</label>
              <input
                type="text"
                value={infoForm.slug}
                onChange={(e) => setInfoForm({ ...infoForm, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              />
              <p className="text-slate-500 text-xs mt-1">Apenas letras minúsculas e hífen. Ex: minha-loja</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-sm mb-1">Plano</label>
                <select
                  value={infoForm.plan}
                  onChange={(e) => setInfoForm({ ...infoForm, plan: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="PRO">PRO</option>
                  <option value="GROW">GROW</option>
                  <option value="PRIME">PRIME</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Status</label>
                <select
                  value={infoForm.status}
                  onChange={(e) => setInfoForm({ ...infoForm, status: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="TRIAL">Trial</option>
                  <option value="ACTIVE">Ativo</option>
                  <option value="SUSPENDED">Suspenso</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-sm mb-1">Término do Trial</label>
              <input
                type="date"
                value={infoForm.trialEndsAt}
                onChange={(e) => setInfoForm({ ...infoForm, trialEndsAt: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              />
              <p className="text-slate-500 text-xs mt-1">Deixe em branco para sem data de trial</p>
            </div>

            <div className="pt-2 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Produtos:</span>{' '}
                <span className="text-white">{tenant._count?.products || 0}</span>
              </div>
              <div>
                <span className="text-slate-500">Vendas:</span>{' '}
                <span className="text-white">{tenant._count?.orders || 0}</span>
              </div>
              <div>
                <span className="text-slate-500">Criada em:</span>{' '}
                <span className="text-white">{new Date(tenant.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>

            <button
              onClick={handleInfoSave}
              disabled={infoSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {infoSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {infoSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Usuários */}
      {activeTab === 'users' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Usuários da Loja</h3>
            <button
              onClick={openUserCreate}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors"
            >
              <Plus size={18} />
              Adicionar Usuário
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
            {usersLoading ? (
              <div className="p-8 flex justify-center">
                <Loader2 size={24} className="animate-spin text-slate-400" />
              </div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-slate-500">Nenhum usuário nesta loja.</div>
            ) : (
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Nome</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Email</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Função</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">PIN</th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Ações</th>
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
                            onClick={() => openUserEdit(tu)}
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
                            onClick={() => handleRemoveUser(tu.userId)}
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
        </div>
      )}

      {/* Tab: Módulos */}
      {activeTab === 'modules' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white">Módulos da Loja</h3>
              <p className="text-slate-400 text-sm mt-1">
                Plano base: <span className="text-white font-medium">{tenant.plan}</span>.
                Ative/desative módulos individualmente.
              </p>
            </div>
            <button
              onClick={handleFeaturesSave}
              disabled={featuresSaving}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {featuresSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {featuresSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          {featuresLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 size={24} className="animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="divide-y divide-slate-800">
                {FEATURE_DEFS.map((def) => {
                  const enabled = getEffectiveValue(def.key);
                  const isOverridden = def.key in overrides;
                  return (
                    <div key={def.key} className="flex items-center justify-between px-6 py-4 hover:bg-slate-800/20 transition-colors">
                      <div>
                        <p className={`font-medium text-sm ${enabled ? 'text-white' : 'text-slate-600'}`}>
                          {def.label}
                          {isOverridden && (
                            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {enabled ? 'ativado' : 'desativado'}
                            </span>
                          )}
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5">{def.description}</p>
                      </div>
                      <button
                        onClick={() => toggleFeature(def.key)}
                        className={`relative w-11 h-6 rounded-full transition-colors
                          ${enabled ? 'bg-indigo-500' : 'bg-slate-700'}
                        `}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform
                          ${enabled ? 'translate-x-5' : 'translate-x-0.5'}
                        `} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Add/Edit Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">
                {editingUserId ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUserSave} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-sm mb-1">Nome</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Email</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              {!editingUserId && (
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Senha</label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                    required
                    minLength={6}
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-400 text-sm mb-1">Função na Loja</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="CASHIER">Vendedor</option>
                  <option value="OWNER">Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-1">PIN (4 dígitos, opcional)</label>
                <input
                  type="text"
                  value={userForm.pin}
                  onChange={(e) => setUserForm({ ...userForm, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  maxLength={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={userSaving}
                className="w-full bg-indigo-500 hover:bg-indigo-400 text-white py-3 rounded-xl font-semibold disabled:opacity-50 transition-colors"
              >
                {userSaving ? 'Salvando...' : editingUserId ? 'Salvar' : 'Adicionar Usuário'}
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

            {resetModal.loading ? (
              <div className="text-center py-8">
                <Loader2 size={32} className="animate-spin text-indigo-400 mx-auto mb-4" />
                <p className="text-slate-400 text-sm">
                  Gerando link para <strong className="text-white">{resetModal.userName}</strong>...
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {resetModal.emailSent ? (
                  <div className="bg-emerald-400/10 border border-emerald-400/30 rounded-xl px-4 py-3 text-emerald-400 text-sm">
                    Email enviado com sucesso para o usuario.
                  </div>
                ) : (
                  <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-3 text-amber-400 text-sm">
                    Nao foi possivel enviar o email. Envie o link manualmente.
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 text-sm mb-1">Link de redefinicao</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={resetModal.resetLink}
                      readOnly
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-300 text-xs focus:outline-none"
                    />
                    <button
                      onClick={copyResetLink}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-sm font-medium transition-colors flex-shrink-0"
                    >
                      <Copy size={14} />
                      Copiar
                    </button>
                  </div>
                </div>

                <p className="text-slate-500 text-xs">
                  O link expira em 1 hora. Envie este link para o usuario por WhatsApp, email ou outro canal.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

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
