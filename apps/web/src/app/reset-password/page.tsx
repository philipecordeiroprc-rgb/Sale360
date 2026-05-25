'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não conferem.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao redefinir senha.');
        setLoading(false);
        return;
      }

      setDone(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch {
      setError('Erro de conexão. Verifique sua internet.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-6 text-red-400">
          <p className="font-medium">Link inválido</p>
          <p className="text-sm mt-1">Token de redefinição não encontrado.</p>
        </div>
        <Link
          href="/forgot-password"
          className="inline-block mt-4 text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Solicitar novo link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <div className="bg-green-400/10 border border-green-400/30 rounded-xl px-4 py-6 text-green-400">
          <p className="font-medium">Senha redefinida!</p>
          <p className="text-sm mt-1">Redirecionando para o login...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-xl font-bold text-white text-center mb-2">
        Redefinir Senha
      </h2>
      <p className="text-slate-400 text-sm text-center mb-6">
        Escolha uma nova senha para sua conta.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-slate-400 text-sm mb-1">Nova Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-1">Confirmar Senha</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repita a senha"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            required
          />
        </div>

        {error && (
          <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-500 hover:bg-indigo-400 text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? 'Redefinindo...' : 'Redefinir Senha'}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
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

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <Suspense fallback={
            <div className="text-center text-slate-400">Carregando...</div>
          }>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
