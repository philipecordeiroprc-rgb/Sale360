'use client';

import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  pin?: string;
  storeRole?: string;
}

interface Tenant {
  id: string;
  slug: string;
  companyName: string;
  plan: string;
  status: string;
  role?: string;
  pin?: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  tenant: Tenant | null;
  availableTenants: Tenant[];
  isAuthenticated: boolean;
  isSuperAdmin: boolean;

  hydrate: () => void;
  setAuth: (data: { token: string; user: User; tenant: Tenant | null; tenants?: Tenant[] }) => void;
  setAvailableTenants: (tenants: Tenant[]) => void;
  switchTenant: (tenantId: string) => Promise<void>;
  logout: () => void;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  tenant: null,
  isAuthenticated: false,
  isSuperAdmin: false,

  hydrate: () => {
    const token = getCookie('sale360_token');
    const userStr = getCookie('sale360_user');
    const tenantStr = getCookie('sale360_tenant');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        const tenant = tenantStr ? JSON.parse(tenantStr) : null;
        set({
          token,
          user,
          tenant,
          isAuthenticated: true,
          isSuperAdmin: user.role === 'SUPER_ADMIN',
        });
      } catch {
        // Invalid cookie data — clear
        document.cookie = 'sale360_token=; path=/; max-age=0';
        document.cookie = 'sale360_user=; path=/; max-age=0';
        document.cookie = 'sale360_tenant=; path=/; max-age=0';
      }
    }
  },

  setAuth: ({ token, user, tenant }) => {
    const maxAge = 60 * 60 * 24 * 7; // 7 days
    document.cookie = `sale360_token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `sale360_user=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=${maxAge}; SameSite=Lax`;
    if (tenant) {
      document.cookie = `sale360_tenant=${encodeURIComponent(JSON.stringify(tenant))}; path=/; max-age=${maxAge}; SameSite=Lax`;
    } else {
      document.cookie = 'sale360_tenant=; path=/; max-age=0';
    }
    set({ token, user, tenant, isAuthenticated: true, isSuperAdmin: user.role === 'SUPER_ADMIN' });
  },

  logout: () => {
    document.cookie = 'sale360_token=; path=/; max-age=0';
    document.cookie = 'sale360_user=; path=/; max-age=0';
    document.cookie = 'sale360_tenant=; path=/; max-age=0';
    set({ token: null, user: null, tenant: null, isAuthenticated: false, isSuperAdmin: false });
    window.location.href = '/login';
  },
}));
