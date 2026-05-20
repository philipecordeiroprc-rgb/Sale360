'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div>
      {/* Admin Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-indigo-400">SALE360 Admin</h1>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">Plataforma</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">{user?.name}</span>
          <button
            onClick={logout}
            className="text-sm text-slate-400 hover:text-red-400 transition-colors"
          >
            Sair
          </button>
        </div>
      </header>

      {children}
    </div>
  );
}
