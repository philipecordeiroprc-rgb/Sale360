import type { Metadata } from 'next';
import { AuthHydrator } from '@/components/layout/AuthHydrator';
import { ClientShell } from '@/components/layout/ClientShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sale360 — PDV Inteligente',
  description: 'Sistema PDV SaaS Multiplataforma com Offline-First',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-950 text-white antialiased">
        <AuthHydrator>
          <ClientShell>
            {children}
          </ClientShell>
        </AuthHydrator>
      </body>
    </html>
  );
}
