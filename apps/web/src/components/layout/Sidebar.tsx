'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, Package, Users,
  ClipboardList, DollarSign, Settings, LogOut,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Vendas', icon: ShoppingCart },
  { href: '/products', label: 'Produtos', icon: Package },
  { href: '/customers', label: 'Clientes', icon: Users },
  { href: '/commands', label: 'Comandas', icon: ClipboardList },
  { href: '/finance', label: 'Financeiro', icon: DollarSign },
  { href: '/settings', label: 'Config', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-dark-800 border-r border-dark-700 flex flex-col z-30">
      {/* Logo */}
      <div className="p-6 border-b border-dark-700">
        <h1 className="text-2xl font-black text-accent tracking-tight">SALE360</h1>
        <p className="text-xs text-dark-600 mt-1">PDV Inteligente</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150
                ${isActive
                  ? 'bg-accent text-white shadow-lg shadow-accent/30'
                  : 'text-dark-600 hover:bg-dark-700 hover:text-white'
                }`}
            >
              <item.icon size={20} />
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-dark-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white font-bold text-sm">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">Admin</p>
            <p className="text-xs text-dark-600 truncate">Plano GROW</p>
          </div>
          <button className="text-dark-600 hover:text-danger transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
