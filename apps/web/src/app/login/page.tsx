'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Shield, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import QRCodeLib from 'qrcode';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA step
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  // Forced 2FA setup step (admin required 2FA but user hasn't set it up)
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const [setupToken, setSetupToken] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // Generate QR code when forced setup starts
  useEffect(() => {
    if (!showTwoFactorSetup || !setupToken) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/auth/setup-2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ setupToken }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Erro ao iniciar configuração 2FA.');
          return;
        }
        if (!cancelled) {
          const dataUrl = await QRCodeLib.toDataURL(data.qrCodeUri, { width: 200, margin: 2 });
          setQrDataUrl(dataUrl);
        }
      } catch {
        if (!cancelled) setError('Erro de conexão.');
      }
    })();

    return () => { cancelled = true; };
  }, [showTwoFactorSetup, setupToken]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Credenciais inválidas');
        setLoading(false);
        return;
      }

      // Forced 2FA setup — admin requires user to set up 2FA
      if (data.mustSetupTwoFactor) {
        setSetupToken(data.setupToken);
        setShowTwoFactorSetup(true);
        setLoading(false);
        return;
      }

      // 2FA required — show code input
      if (data.requireTwoFactor) {
        setTwoFactorToken(data.twoFactorToken);
        setShowTwoFactor(true);
        setLoading(false);
        return;
      }

      // No 2FA — proceed with normal login
      finalizeLogin(data);
    } catch (err) {
      setError('Erro de conexão. Verifique sua internet.');
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twoFactorToken, code: totpCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Código inválido');
        setLoading(false);
        return;
      }

      finalizeLogin(data);
    } catch (err) {
      setError('Erro de conexão. Verifique sua internet.');
      setLoading(false);
    }
  };

  const finalizeLogin = (data: any) => {
    useAuth.getState().setAuth({
      token: data.token,
      user: data.user,
      tenant: data.tenant,
      tenants: data.tenants,
    });

    // Force password change if required
    if (data.mustChangePassword) {
      router.push('/change-password');
      return;
    }

    // If user has multiple tenants (or is SUPER_ADMIN with stores), let them choose
    if (data.tenants && data.tenants.length > 1) {
      router.push('/select-store');
    } else if (data.tenants && data.tenants.length === 1 && data.user.role === 'SUPER_ADMIN') {
      router.push('/select-store');
    } else {
      const redirectTo = data.user.role === 'SUPER_ADMIN' ? '/admin' : '/dashboard';
      router.push(redirectTo);
      router.refresh();
    }
  };

  const handleSetupConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/confirm-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupToken, code: setupCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Código inválido');
        setLoading(false);
        return;
      }

      // Show backup codes before finalizing
      if (data.backupCodes) {
        setBackupCodes(data.backupCodes);
        setShowBackupCodes(true);
        // Store data temporarily for finalize
        setLoading(false);
        return;
      }

      finalizeLogin(data);
    } catch {
      setError('Erro de conexão.');
      setLoading(false);
    }
  };

  const finishSetup = () => {
    // Re-call confirm to get final auth (codes already saved)
    // Actually, we need to finalize with what we have
    // Just redirect to password login so user logs in normally now
    setShowTwoFactorSetup(false);
    setShowBackupCodes(false);
    setSetupToken('');
    setSetupCode('');
    setQrDataUrl('');
    setBackupCodes([]);
    setError('');
    // User now has 2FA enabled, so they'll go through the normal 2FA flow
  };

  const backToPassword = () => {
    setShowTwoFactor(false);
    setTwoFactorToken('');
    setTotpCode('');
    setError('');
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
          {!showTwoFactor ? (
            <>
              <h2 className="text-lg font-bold text-white text-center mb-4">Entrar</h2>

              <form onSubmit={handlePasswordSubmit} className="space-y-3">
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

                <div>
                  <label className="block text-slate-400 text-sm mb-1">Senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-2.5 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-500 hover:bg-indigo-400 text-white py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>

              <div className="mt-3 text-center text-sm">
                <a
                  href="/forgot-password"
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Esqueceu a senha?
                </a>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <button onClick={backToPassword} className="text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft size={18} />
                </button>
                <h2 className="text-lg font-bold text-white">Verificação em 2 Etapas</h2>
              </div>

              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Shield size={24} className="text-indigo-400" />
                </div>
              </div>
              <p className="text-slate-400 text-sm text-center mb-4">
                Digite o código de 6 dígitos do seu aplicativo Google Authenticator.
              </p>

              <form onSubmit={handleTwoFactorSubmit} className="space-y-3">
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Código de Verificação</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    placeholder="000000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-center text-2xl tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-2.5 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || totpCode.length !== 6}
                  className="w-full bg-indigo-500 hover:bg-indigo-400 text-white py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  {loading ? 'Verificando...' : 'Verificar'}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Backup code hint */}
        {showTwoFactor && (
          <p className="text-center mt-4 text-slate-500 text-xs">
            Perdeu o acesso ao autenticador? Use um código de backup ou contate o administrador.
          </p>
        )}
      </div>
    </div>
  );
}
