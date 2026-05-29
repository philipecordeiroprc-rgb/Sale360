'use client';

import { useState, useEffect, useCallback } from 'react';
import { Store, Palette, ImageUp, ShoppingCart, MessageSquare, CreditCard, Upload, Trash2, Plus, GripVertical, Phone } from 'lucide-react';
import api from '@/lib/api';

interface CatalogData {
  id?: string;
  active: boolean;
  storeName?: string;
  storePhone?: string;
  document?: string;
  companyName?: string;
  primaryColor: string;
  backgroundColor: string;
  displayMode: string;
  outOfStockBehavior: string;
  acceptOrders: boolean;
  receiveWhatsApp: boolean;
  whatsAppNumber?: string;
  postOrderMessage?: string;
  instagram?: string;
  email?: string;
  aboutUs?: string;
  logoPath?: string;
  banners: Array<{ id: string; imagePath: string; linkUrl?: string; sortOrder: number }>;
  paymentMethods: Array<{ id?: string; paymentMethod: string; enabled: boolean; dueDays?: number; instructions?: string }>;
}

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'Pix',
  cash: 'Dinheiro',
  credit: 'Cartão de Crédito',
  debit: 'Cartão de Débito',
  credit_store: 'Fiado',
  meal_voucher: 'Voucher Refeição',
  food_voucher: 'Voucher Alimentação',
};

const DEFAULT_PAYMENT_METHODS = [
  { paymentMethod: 'debit', enabled: true, dueDays: undefined as number | undefined, instructions: '' },
  { paymentMethod: 'credit', enabled: true, dueDays: undefined, instructions: '' },
  { paymentMethod: 'pix', enabled: true, dueDays: undefined, instructions: '' },
  { paymentMethod: 'cash', enabled: true, dueDays: undefined, instructions: '' },
  { paymentMethod: 'food_voucher', enabled: false, dueDays: undefined, instructions: '' },
  { paymentMethod: 'meal_voucher', enabled: false, dueDays: undefined, instructions: '' },
  { paymentMethod: 'credit_store', enabled: false, dueDays: 30, instructions: '' },
];

export function CatalogoTab() {
  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.catalogSettings.get();
      // Garante que novos métodos de pagamento apareçam em tenants existentes
      if (!res.paymentMethods || res.paymentMethods.length === 0) {
        res.paymentMethods = DEFAULT_PAYMENT_METHODS;
      } else {
        const existingMethods = new Set(res.paymentMethods.map((pm: any) => pm.paymentMethod));
        for (const d of DEFAULT_PAYMENT_METHODS) {
          if (!existingMethods.has(d.paymentMethod)) {
            res.paymentMethods.push({ ...d });
          }
        }
      }
      setData(res);
    } catch (err: any) {
      showMsg(err.message || 'Erro ao carregar configurações', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const updateField = (field: string, value: any) => {
    if (!data) return;
    setData({ ...data, [field]: value });
  };

  const handleSaveSettings = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const { banners, paymentMethods, id, ...updateData } = data;
      await api.catalogSettings.update(updateData);
      showMsg('Configurações salvas!');
    } catch (err: any) {
      showMsg(err.message || 'Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await api.catalogSettings.uploadLogo(file);
      updateField('logoPath', res.logoPath);
      showMsg('Logo atualizada!');
    } catch (err: any) {
      showMsg(err.message || 'Erro ao enviar logo', 'error');
    }
  };

  const handleUploadBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await api.catalogSettings.uploadBanner(file);
      showMsg('Banner adicionado!');
      loadSettings(); // reload to get updated list
    } catch (err: any) {
      showMsg(err.message || 'Erro ao enviar banner', 'error');
    }
  };

  const handleDeleteBanner = async (id: string) => {
    try {
      await api.catalogSettings.deleteBanner(id);
      showMsg('Banner removido!');
      loadSettings();
    } catch (err: any) {
      showMsg(err.message || 'Erro ao remover', 'error');
    }
  };

  const handleSavePaymentMethods = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await api.catalogSettings.updatePaymentMethods(data.paymentMethods);
      showMsg('Métodos de pagamento salvos!');
    } catch (err: any) {
      showMsg(err.message || 'Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 animate-pulse">
            <div className="h-5 bg-slate-800 rounded w-1/3 mb-4" />
            <div className="h-4 bg-slate-800 rounded w-2/3 mb-2" />
            <div className="h-4 bg-slate-800 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return <p className="text-slate-400 text-sm">Erro ao carregar configurações.</p>;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

  return (
    <div className="space-y-5">
      {message && (
        <div className={`px-4 py-2.5 rounded-xl text-sm font-medium ${
          message.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        }`}>
          {message.text}
        </div>
      )}

      {/* ── 1. Dados da Loja ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Store size={16} className="text-indigo-400" /> Dados da Loja
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nome da Loja</label>
            <input
              value={data.storeName || ''}
              onChange={(e) => updateField('storeName', e.target.value)}
              placeholder="Nome exibido no catálogo"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Telefone</label>
            <input
              value={data.storePhone || ''}
              onChange={(e) => updateField('storePhone', e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">CPF/CNPJ</label>
            <input
              value={data.document || ''}
              onChange={(e) => updateField('document', e.target.value)}
              placeholder="000.000.000-00"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Razão Social</label>
            <input
              value={data.companyName || ''}
              onChange={(e) => updateField('companyName', e.target.value)}
              placeholder="Nome Empresarial Ltda"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleSaveSettings} disabled={saving}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors">
            {saving ? 'Salvando...' : 'Salvar Dados'}
          </button>
        </div>
      </div>

      {/* ── 2. Aparência ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Palette size={16} className="text-indigo-400" /> Aparência
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Cor Principal</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={data.primaryColor}
                onChange={(e) => updateField('primaryColor', e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
              />
              <input
                value={data.primaryColor}
                onChange={(e) => updateField('primaryColor', e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Cor do Fundo</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={data.backgroundColor}
                onChange={(e) => updateField('backgroundColor', e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
              />
              <input
                value={data.backgroundColor}
                onChange={(e) => updateField('backgroundColor', e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none font-mono"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Cor de fundo do catálogo (padrão: azul escuro)</p>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Modo de Exibição</label>
            <select
              value={data.displayMode}
              onChange={(e) => updateField('displayMode', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
            >
              <option value="grid">Grade</option>
              <option value="list">Lista</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Produtos sem Estoque</label>
            <select
              value={data.outOfStockBehavior}
              onChange={(e) => updateField('outOfStockBehavior', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
            >
              <option value="hide">Ocultar</option>
              <option value="show_disabled">Exibir como Indisponível</option>
              <option value="show">Exibir Normalmente</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleSaveSettings} disabled={saving}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors">
            Salvar Aparência
          </button>
        </div>
      </div>

      {/* ── 3. Contatos ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Phone size={16} className="text-indigo-400" /> Contatos e Informações
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Telefone</label>
            <input
              value={data.storePhone || ''}
              onChange={(e) => updateField('storePhone', e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Instagram</label>
            <input
              value={data.instagram || ''}
              onChange={(e) => updateField('instagram', e.target.value)}
              placeholder="@sualoja"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Email</label>
            <input
              value={data.email || ''}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="contato@sualoja.com"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-xs text-slate-400 mb-1">Sobre Nós</label>
          <textarea
            value={data.aboutUs || ''}
            onChange={(e) => updateField('aboutUs', e.target.value)}
            placeholder="Conte um pouco sobre sua loja..."
            rows={3}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none resize-none"
          />
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleSaveSettings} disabled={saving}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors">
            Salvar Contatos
          </button>
        </div>
      </div>

      {/* ── 4. Logo ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Upload size={16} className="text-indigo-400" /> Logo
        </h3>
        <div className="flex items-center gap-4">
          {/* Preview */}
          <div className="w-24 h-24 bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden border border-slate-700">
            {data.logoPath ? (
              <img
                src={`${API_URL}/api/public/uploads/${data.logoPath}`}
                alt="Logo"
                className="w-full h-full object-contain"
              />
            ) : (
              <Store size={32} className="text-slate-600" />
            )}
          </div>
          <div>
            <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium cursor-pointer transition-colors inline-block">
              <Upload size={14} className="inline mr-1" /> Upload Logo
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUploadLogo} className="hidden" />
            </label>
            <p className="text-[10px] text-slate-500 mt-1.5">JPG, PNG ou WebP. Máx 2MB.</p>
          </div>
        </div>
      </div>

      {/* ── 4. Banners ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <ImageUp size={16} className="text-indigo-400" /> Banners
          <span className="text-xs text-slate-500 font-normal ml-auto">1136 x 284 px recomendado</span>
        </h3>

        {/* Existing banners */}
        {data.banners.length > 0 && (
          <div className="space-y-2 mb-4">
            {data.banners.map((banner) => (
              <div key={banner.id} className="flex items-center gap-3 bg-slate-800 rounded-lg p-2">
                <div className="w-24 h-14 bg-slate-700 rounded overflow-hidden shrink-0">
                  <img
                    src={`${API_URL}/api/public/uploads/${banner.imagePath}`}
                    alt="Banner"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-xs text-slate-400 flex-1 truncate">{banner.imagePath}</span>
                <button
                  onClick={() => handleDeleteBanner(banner.id)}
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium cursor-pointer transition-colors inline-block">
          <Plus size={14} className="inline mr-1" /> Adicionar Banner
          <input type="file" accept="image/png,image/jpeg" onChange={handleUploadBanner} className="hidden" />
        </label>
        <p className="text-[10px] text-slate-500 mt-1.5">JPG ou PNG. Máx 5MB. Horizontal/paisagem.</p>
      </div>

      {/* ── 5. Pedidos ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <ShoppingCart size={16} className="text-indigo-400" /> Pedidos
        </h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm text-white">Aceitar pedidos online</span>
              <p className="text-xs text-slate-500">Clientes podem fazer pedidos pelo catálogo</p>
            </div>
            <input
              type="checkbox"
              checked={data.acceptOrders}
              onChange={(e) => updateField('acceptOrders', e.target.checked)}
              className="w-5 h-5 rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm text-white">Receber resumo no WhatsApp</span>
              <p className="text-xs text-slate-500">Cliente pode enviar resumo do pedido para o WhatsApp da loja</p>
            </div>
            <input
              type="checkbox"
              checked={data.receiveWhatsApp}
              onChange={(e) => updateField('receiveWhatsApp', e.target.checked)}
              className="w-5 h-5 rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0"
            />
          </label>

          {data.receiveWhatsApp && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Número WhatsApp</label>
              <input
                value={data.whatsAppNumber || ''}
                onChange={(e) => updateField('whatsAppNumber', e.target.value)}
                placeholder="5511999999999"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1">Formato: 55 + DDD + número, sem espaços</p>
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1">Mensagem pós-pedido</label>
            <textarea
              value={data.postOrderMessage || ''}
              onChange={(e) => updateField('postOrderMessage', e.target.value)}
              placeholder="Obrigado pelo seu pedido! Entraremos em contato em breve para confirmar."
              rows={2}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none resize-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">Exibida ao cliente após finalizar o pedido.</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleSaveSettings} disabled={saving}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors">
            Salvar Pedidos
          </button>
        </div>
      </div>

      {/* ── 6. Meios de Pagamento ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <CreditCard size={16} className="text-indigo-400" /> Meios de Pagamento no Catálogo
        </h3>
        <div className="space-y-3">
          {data.paymentMethods.map((pm, idx) => (
            <div key={pm.paymentMethod} className="bg-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pm.enabled}
                    onChange={() => {
                      const updated = [...data.paymentMethods];
                      updated[idx] = { ...updated[idx], enabled: !pm.enabled };
                      setData({ ...data, paymentMethods: updated });
                    }}
                    className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-indigo-500 focus:ring-0"
                  />
                  <span className="text-sm text-white">{PAYMENT_LABELS[pm.paymentMethod] || pm.paymentMethod}</span>
                </label>
              </div>
              {pm.enabled && pm.paymentMethod === 'credit_store' && (
                <div className="mt-2 pl-6">
                  <label className="block text-xs text-slate-400 mb-1">Dias para Vencimento</label>
                  <input
                    type="number"
                    value={pm.dueDays || ''}
                    onChange={(e) => {
                      const updated = [...data.paymentMethods];
                      updated[idx] = { ...updated[idx], dueDays: Number(e.target.value) || undefined };
                      setData({ ...data, paymentMethods: updated });
                    }}
                    min="1" max="365"
                    placeholder="30"
                    className="w-24 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm text-center focus:border-indigo-500 outline-none"
                  />
                  <span className="text-xs text-slate-500 ml-2">dias</span>
                </div>
              )}
              {pm.enabled && (
                <div className="mt-2 pl-6">
                  <label className="block text-xs text-slate-400 mb-1">Instruções (opcional)</label>
                  <input
                    value={pm.instructions || ''}
                    onChange={(e) => {
                      const updated = [...data.paymentMethods];
                      updated[idx] = { ...updated[idx], instructions: e.target.value };
                      setData({ ...data, paymentMethods: updated });
                    }}
                    placeholder={pm.paymentMethod === 'pix' ? 'Chave Pix: exemplo@email.com' : ''}
                    className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:border-indigo-500 outline-none"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleSavePaymentMethods} disabled={saving}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors">
            Salvar Pagamentos
          </button>
        </div>
      </div>
    </div>
  );
}
