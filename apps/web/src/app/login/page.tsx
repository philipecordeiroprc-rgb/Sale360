'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@sale360.app');
  const [password, setPassword] = useState('admin123');
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

      // Set cookie via API route (or set directly)
      document.cookie = `sale360_token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      document.cookie = `sale360_user=${encodeURIComponent(JSON.stringify(data.user))}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      document.cookie = `sale360_tenant=${encodeURIComponent(JSON.stringify(data.tenant))}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError('Erro de conexão. Verifique sua internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-indigo-400 tracking-tight">S360</h1>
          <p className="text-slate-400 mt-2 text-lg">PDV Inteligente</p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h2 className="text-xl font-bold text-white text-center mb-6">
            {mode === 'pin' ? 'Login Rápido (PIN)' : 'Entrar'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-slate-400 text-sm mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-dark-600 focus:outline-none focus:border-accent transition-colors"
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
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-dark-600 focus:outline-none focus:border-accent transition-colors"
                required
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-500 hover:bg-indigo-400 text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {/* Toggle mode */}
          <div className="mt-4 text-center">
            <button
              onClick={() => { setMode(mode === 'pin' ? 'password' : 'pin'); setError(''); }}
              className="text-sm text-indigo-400 hover:text-indigo-400-light transition-colors"
            >
              {mode === 'pin' ? 'Usar senha' : 'Usar PIN rápido'}
            </button>
          </div>

          {/* Credentials hint */}
          <div className="mt-6 pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-400 text-center">
              Demo: admin@sale360.app / admin123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
