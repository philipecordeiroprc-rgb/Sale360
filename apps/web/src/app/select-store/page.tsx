'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Store, LogOut, ArrowRight, Shield, User } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  SELLER: 'Vendedor',
  CASHIER: 'Caixa',
};

const PLAN_LABELS: Record<string, string> = {
  STARTER: 'Starter',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
};

export default function SelectStorePage() {
  const router = useRouter();
  const { availableTenants, switchTenant, logout, user, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSelect = async (tenantId: string) => {
    setLoading(tenantId);
    setError('');
    try {
      await switchTenant(tenantId);
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Erro ao acessar empresa');
    } finally {
      setLoading(null);
    }
  };

  // If no tenants available, redirect to login
  if (availableTenants.length === 0) {
    return (
      <div className="min-h-dvh bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Nenhuma empresa vinculada.</p>
          <button
            onClick={() => logout()}
            className="text-indigo-400 hover:text-indigo-300 transition-colors text-sm"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <img
            src="/icon-192.png"
            alt="Sale360"
            className="w-14 h-14 mx-auto mb-3 rounded-2xl shadow-lg shadow-indigo-500/20"
          />
          <h1 className="text-3xl font-black text-white tracking-tight">
            Sale<span className="text-indigo-400">360</span>
          </h1>
          <p className="text-slate-400 mt-0.5 text-base">Escolha a empresa</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Tenant list */}
        <div className="space-y-3">
          {availableTenants.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelect(t.id)}
              disabled={loading !== null}
              className="w-full bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 text-left transition-all group disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                    <Store size={20} className="text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">
                      {t.companyName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded-md text-slate-400">
                        {PLAN_LABELS[t.plan] || t.plan}
                      </span>
                      {t.role && (
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Shield size={10} />
                          {ROLE_LABELS[t.role] || t.role}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {loading === t.id ? (
                    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ArrowRight size={18} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-slate-500">
            <User size={14} />
            <span className="truncate">{user?.email}</span>
          </div>
          <button
            onClick={() => logout()}
            className="flex items-center gap-1 text-slate-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={14} />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
