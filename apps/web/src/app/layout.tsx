import type { Metadata } from 'next';
import { Sidebar } from '@/components/layout/Sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sale360 — PDV Inteligente',
  description: 'Sistema PDV SaaS Multiplataforma com Offline-First',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-dark-900 text-white antialiased">
        <div className="flex">
          <Sidebar />
          <main className="ml-64 flex-1 p-8 min-h-screen">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
