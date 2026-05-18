'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, Package, Users,
  ClipboardList, DollarSign, Settings, LogOut,
  Truck, ShoppingBag, Layers, Tag,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

type Role = 'SUPER_ADMIN' | 'OWNER' | 'CASHIER';

const navItems: { href: string; label: string; icon: any; roles: Role[] }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['OWNER', 'CASHIER'] },
  { href: '/orders', label: 'Vendas', icon: ShoppingCart, roles: ['OWNER', 'CASHIER'] },
  { href: '/products', label: 'Produtos', icon: Package, roles: ['OWNER', 'CASHIER'] },
  { href: '/inventory', label: 'Estoque', icon: Layers, roles: ['OWNER'] },
  { href: '/purchases', label: 'Compras', icon: ShoppingBag, roles: ['OWNER'] },
  { href: '/suppliers', label: 'Fornecedores', icon: Truck, roles: ['OWNER'] },
  { href: '/customers', label: 'Clientes', icon: Users, roles: ['OWNER', 'CASHIER'] },
  { href: '/coupons', label: 'Cupons', icon: Tag, roles: ['OWNER'] },
  { href: '/commands', label: 'Comandas', icon: ClipboardList, roles: ['OWNER', 'CASHIER'] },
  { href: '/finance', label: 'Financeiro', icon: DollarSign, roles: ['OWNER'] },
  { href: '/settings', label: 'Config', icon: Settings, roles: ['OWNER'] },
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

export function Sidebar() {
  const pathname = usePathname();
  const { user, tenant, isSuperAdmin } = useAuth();
  const storeRole = user?.storeRole || user?.role || '';
  const userRole = isSuperAdmin ? 'SUPER_ADMIN' : (storeRole || '');

  // SUPER_ADMIN doesn't see the tenant sidebar
  if (isSuperAdmin) return null;

  const visibleItems = navItems.filter(item => item.roles.includes(userRole as Role));

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-30">
      {/* Logo + Store Name */}
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-2xl font-black text-indigo-400 tracking-tight">SALE360</h1>
        {tenant?.companyName ? (
          <p className="text-sm text-white font-medium mt-1 truncate" title={tenant.companyName}>
            {tenant.companyName}
          </p>
        ) : (
          <p className="text-xs text-slate-400 mt-1">PDV Inteligente</p>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150
                ${isActive
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <item.icon size={20} />
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm">
            {user ? getInitials(user.name) : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">{user?.name || 'Usuário'}</p>
            <p className="text-xs text-slate-400 truncate">
              {tenant ? `Plano ${tenant.plan}` : getRoleLabel(userRole)}
            </p>
          </div>
          <button
            onClick={() => useAuth.getState().logout()}
            className="text-slate-400 hover:text-red-400 transition-colors"
            title="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
