'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Sidebar } from './Sidebar';
import { PageTitle } from './PageTitle';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { useSync } from '@/hooks/useSync';

function isCatalogPath(pathname: string): boolean {
  if (pathname === '/') return false;
  if (pathname.startsWith('/c/')) return true; // backward compat
  const APP_SEGMENTS = new Set([
    'login', 'forgot-password', 'reset-password', 'select-store',
    'dashboard', 'admin', 'coupons', 'customers', 'finance',
    'guia-importacao', 'indicadores', 'inventory', 'orders',
    'products', 'purchases', 'settings', 'suppliers',
  ]);
  const first = pathname.split('/')[1];
  if (!first) return false;
  return !APP_SEGMENTS.has(first);
}

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isSuperAdmin, tenant } = useAuth();
  const { sync, isSyncing, isOnline, pendingCount } = useSync();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdminRoute = pathname.startsWith('/admin');
  const isAuthPage =
    pathname === '/login' ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');
  const isCatalogRoute = isCatalogPath(pathname);
  const isSelectStore = pathname === '/select-store';

  // Auth pages — no sidebar, full width
  if (isAuthPage || isSelectStore) {
    return <><PageTitle />{children}</>;
  }

  // Catalog pages — public, no sidebar, standalone
  if (isCatalogRoute) {
    return <>{children}</>;
  }

  // Admin pages — no sidebar, full width
  if (isAdminRoute && isSuperAdmin && !tenant) {
    return (
      <main className="min-h-screen bg-slate-950">
        <PageTitle />
        {children}
      </main>
    );
  }

  // Tenant pages — sidebar + main
  return (
    <div className="flex">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Mobile header bar */}
      <div className="fixed top-0 left-0 right-0 h-12 bg-slate-900 border-b border-slate-800 flex items-center px-3 z-30 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="ml-2 text-base font-bold text-indigo-400">SALE360</h1>
        <div className="ml-auto">
          <OfflineIndicator isOnline={isOnline} isSyncing={isSyncing} pendingCount={pendingCount} />
        </div>
      </div>

      <main className="flex-1 p-3 md:p-5 min-h-screen md:ml-52 mt-12 md:mt-0 w-full max-w-full overflow-x-hidden">
        <div className="flex items-center justify-between mb-2">
          <PageTitle />
          <OfflineIndicator isOnline={isOnline} isSyncing={isSyncing} pendingCount={pendingCount} />
        </div>
        <PullToRefresh onRefresh={sync}>
          {children}
        </PullToRefresh>
      </main>
    </div>
  );
}
