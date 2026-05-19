import type { Metadata, Viewport } from 'next';
import { AuthHydrator } from '@/components/layout/AuthHydrator';
import { ClientShell } from '@/components/layout/ClientShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sale360 — PDV Inteligente',
  description: 'Sistema PDV SaaS Multiplataforma com Offline-First',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Sale360',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#6366f1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-950 text-white antialiased overflow-x-hidden">
        <AuthHydrator>
          <ClientShell>
            {children}
          </ClientShell>
        </AuthHydrator>
      </body>
    </html>
  );
}
