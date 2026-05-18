'use client';

import { useState, useEffect } from 'react';
import { Settings, Percent, Save, Loader2 } from 'lucide-react';
import api from '@/lib/api';

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const show = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

export default function SettingsPage() {
  const [configs, setConfigs] = useState<{ paymentMethod: string; label: string; taxRate: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast, show } = useToast();

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const data = await api.paymentConfigs.list();
      setConfigs(data);
    } catch (err: any) {
      show(err.message || 'Erro ao carregar configurações', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = configs.map(c => ({
        paymentMethod: c.paymentMethod,
        taxRate: c.taxRate,
      }));
      await api.paymentConfigs.update(payload);
      show('Configurações salvas!');
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
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Configuracoes</h1>
          <p className="text-slate-400 text-sm mt-1">Taxas e parametros do sistema</p>
        </div>
      </div>

      {/* Taxas por Meio de Pagamento */}
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
            <div className="p-5 space-y-4">
              {configs.map((config) => (
                <div key={config.paymentMethod} className="flex items-center gap-4">
                  <div className="w-40">
                    <p className="text-white text-sm font-medium">{config.label}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.1"
                      value={config.taxRate}
                      onChange={(e) => setTaxRate(config.paymentMethod, Number(e.target.value))}
                      className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <div className="w-24 flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
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

            {/* Save */}
            <div className="p-5 border-t border-slate-800 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </>
        )}
      </div>

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
