'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'password' | 'pin'>('password');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'pin'
        ? `${API_URL}/api/auth/login-pin`
        : `${API_URL}/api/auth/login`;

      const body = mode === 'pin'
        ? { email: email.trim(), pin }
        : { email: email.trim(), password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Credenciais inválidas');
        setLoading(false);
        return;
      }

      useAuth.getState().setAuth({
        token: data.token,
        user: data.user,
        tenant: data.tenant,
      });

      const redirectTo = data.user.role === 'SUPER_ADMIN' ? '/admin' : '/dashboard';
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError('Erro de conexão. Verifique sua internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
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
          <p className="text-slate-400 mt-0.5 text-base">PDV Inteligente</p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white text-center mb-4">
            {mode === 'pin' ? 'Login Rápido (PIN)' : 'Entrar'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Email */}
            <div>
              <label className="block text-slate-400 text-sm mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>

            {/* Password or PIN */}
            <div>
              <label className="block text-slate-400 text-sm mb-1">
                {mode === 'pin' ? 'PIN (4 dígitos)' : 'Senha'}
              </label>
              <input
                type={mode === 'pin' ? 'text' : 'password'}
                value={mode === 'pin' ? pin : password}
                onChange={(e) => mode === 'pin' ? setPin(e.target.value) : setPassword(e.target.value)}
                maxLength={mode === 'pin' ? 4 : undefined}
                placeholder={mode === 'pin' ? '1234' : '••••••'}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-2.5 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-500 hover:bg-indigo-400 text-white py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {/* Toggle & Forgot */}
          <div className="mt-3 flex items-center justify-between text-sm">
            <button
              onClick={() => { setMode(mode === 'pin' ? 'password' : 'pin'); setError(''); }}
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {mode === 'pin' ? 'Usar senha' : 'Usar PIN'}
            </button>
            <a
              href="/forgot-password"
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              Esqueceu a senha?
            </a>
          </div>

          {/* Credentials hint */}
          <div className="mt-4 pt-3 border-t border-slate-800">
            <p className="text-xs text-slate-400 text-center">
              Demo: admin@sale360.app / admin123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
