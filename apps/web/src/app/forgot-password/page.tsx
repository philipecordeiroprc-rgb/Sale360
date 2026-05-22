'use client';

'use client';

import { useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetLink, setResetLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResetLink('');
    setCopied(false);

    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao enviar email');
        setLoading(false);
        return;
      }

      setSent(true);
      if (data.resetLink) {
        setResetLink(data.resetLink);
      }
    } catch {
      setError('Erro de conexao. Verifique sua internet.');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (resetLink) {
      navigator.clipboard.writeText(resetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-indigo-400 tracking-tight">S360</h1>
          <p className="text-slate-400 mt-2 text-lg">Recuperar Senha</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          {sent ? (
            resetLink ? (
              <div className="text-center space-y-4">
                <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-6 text-amber-400">
                  <p className="font-medium">Email nao enviado</p>
                  <p className="text-sm mt-1">
                    Nao foi possivel enviar o email. Use o link abaixo para redefinir sua senha.
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={resetLink}
                    readOnly
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-300 text-xs focus:outline-none"
                  />
                  <button
                    onClick={copyLink}
                    className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-sm font-medium transition-colors flex-shrink-0"
                  >
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <p className="text-slate-500 text-xs">O link expira em 1 hora.</p>
                <Link
                  href="/login"
                  className="inline-block text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Voltar ao login
                </Link>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="bg-green-400/10 border border-green-400/30 rounded-xl px-4 py-6 text-green-400">
                  <p className="font-medium">Email enviado!</p>
                  <p className="text-sm mt-1">
                    Se o email estiver cadastrado, voce recebera um link para redefinir sua senha.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="inline-block text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Voltar ao login
                </Link>
              </div>
            )
          ) : (
            <>
              <h2 className="text-xl font-bold text-white text-center mb-2">
                Esqueceu a senha?
              </h2>
              <p className="text-slate-400 text-sm text-center mb-6">
                Digite seu email e enviaremos um link para redefinir sua senha.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
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
                  {loading ? 'Enviando...' : 'Enviar Link'}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-slate-800 text-center">
                <Link
                  href="/login"
                  className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
                >
                  Voltar ao login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
