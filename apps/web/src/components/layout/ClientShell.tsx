'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Sidebar } from './Sidebar';
import { PageTitle } from './PageTitle';

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isSuperAdmin } = useAuth();

  const isAdminRoute = pathname.startsWith('/admin');
  const isAuthPage =
    pathname === '/login' ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  // Auth pages — no sidebar, full width
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Admin pages — no sidebar, full width
  if (isAdminRoute && isSuperAdmin) {
    return (
      <main className="min-h-screen bg-slate-950">
        {children}
      </main>
    );
  }

  // Tenant pages — sidebar + main
  return (
    <div className="flex">
      <Sidebar />
      <main className="ml-64 flex-1 p-8 min-h-screen">
        {children}
      </main>
    </div>
  );
}
