'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, Package, Users,
  DollarSign, Settings, LogOut,
  Truck, ShoppingBag, Layers, Tag, X, Store, BarChart3, Shield,
  ChevronDown, FolderOpen,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

type Role = 'SUPER_ADMIN' | 'OWNER' | 'CASHIER';

const navItems: { href: string; label: string; icon: any; roles: Role[] }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['OWNER', 'CASHIER'] },
  { href: '/customers', label: 'Clientes', icon: Users, roles: ['OWNER', 'CASHIER'] },
  { href: '/orders', label: 'Vendas', icon: ShoppingCart, roles: ['OWNER', 'CASHIER'] },
  { href: '/inventory', label: 'Estoque', icon: Layers, roles: ['OWNER'] },
  { href: '/products', label: 'Produtos', icon: Package, roles: ['OWNER', 'CASHIER'] },
  { href: '/purchases', label: 'Compras', icon: ShoppingBag, roles: ['OWNER'] },
  { href: '/finance', label: 'Financeiro', icon: DollarSign, roles: ['OWNER'] },
  { href: '/indicadores', label: 'Indicadores', icon: BarChart3, roles: ['OWNER'] },
  { href: '/settings', label: 'Config', icon: Settings, roles: ['OWNER'] },
];

const cadastroItems: { href: string; label: string; icon: any; roles: Role[] }[] = [
  { href: '/coupons', label: 'Cupons', icon: Tag, roles: ['OWNER'] },
  { href: '/categories', label: 'Categorias', icon: FolderOpen, roles: ['OWNER'] },
  { href: '/suppliers', label: 'Fornecedores', icon: Truck, roles: ['OWNER'] },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getRoleLabel(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN': return 'Super Admin';
    case 'OWNER': return 'Administrador';
    case 'CASHIER': return 'Vendedor';
    default: return role;
  }
}

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, tenant, isSuperAdmin, availableTenants } = useAuth();
  const storeRole = user?.storeRole || user?.role || '';
  // SUPER_ADMIN in store mode uses tenant.role (or OWNER as fallback) so nav items appear
  const userRole = isSuperAdmin ? (tenant?.role || 'OWNER') : (storeRole || '');

  if (isSuperAdmin && !tenant) return null; // Admin mode: no sidebar

  const visibleItems = navItems.filter(item => item.roles.includes(userRole as Role));

  function handleNav() {
    onClose?.();
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen w-52 bg-slate-900 border-r border-slate-800 flex flex-col z-50
          transform transition-transform duration-300 ease-in-out
          md:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 md:hidden"
          aria-label="Fechar menu"
        >
          <X size={16} />
        </button>

        {/* Logo + Store Name */}
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-lg font-black text-indigo-400 tracking-tight">SALE360</h1>
          {tenant?.companyName ? (
            <p className="text-xs text-white font-medium mt-0.5 truncate" title={tenant.companyName}>
              {tenant.companyName}
            </p>
          ) : (
            <p className="text-[10px] text-slate-400 mt-0.5">PDV Inteligente</p>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          {visibleItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNav}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150
                  ${isActive
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                <item.icon size={16} />
                <span className="font-medium text-xs">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          {/* SUPER_ADMIN: link to admin panel */}
          {isSuperAdmin && (
            <Link
              href="/admin"
              onClick={handleNav}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 transition-colors text-[11px]"
            >
              <Shield size={13} />
              <span>Administrar Plataforma</span>
            </Link>
          )}

          {/* Store switcher (multiple tenants or SUPER_ADMIN with stores) */}
          {(availableTenants.length > 1 || (isSuperAdmin && availableTenants.length > 0)) && (
            <Link
              href="/select-store"
              onClick={handleNav}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-[11px]"
            >
              <Store size={13} />
              <span>Trocar empresa</span>
            </Link>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
              {user ? getInitials(user.name) : '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white font-medium truncate">{user?.name || 'Usuário'}</p>
              <p className="text-[10px] text-slate-400 truncate">
                {tenant ? `Plano ${tenant.plan}` : getRoleLabel(userRole)}
              </p>
            </div>
            <button
              onClick={() => useAuth.getState().logout()}
              className="text-slate-400 hover:text-red-400 transition-colors shrink-0"
              title="Sair"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
