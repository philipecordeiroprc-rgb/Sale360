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

export const useAuth = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  tenant: null,
  availableTenants: [],
  isAuthenticated: false,
  isSuperAdmin: false,

  hydrate: () => {
    const token = getCookie('sale360_token');
    const userStr = getCookie('sale360_user');
    const tenantStr = getCookie('sale360_tenant');
    const tenantsStr = getCookie('sale360_tenants');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        const tenant = tenantStr ? JSON.parse(tenantStr) : null;
        const availableTenants = tenantsStr ? JSON.parse(tenantsStr) : [];
        set({
          token,
          user,
          tenant,
          availableTenants,
          isAuthenticated: true,
          isSuperAdmin: user.role === 'SUPER_ADMIN',
        });
      } catch {
        document.cookie = 'sale360_token=; path=/; max-age=0';
        document.cookie = 'sale360_user=; path=/; max-age=0';
        document.cookie = 'sale360_tenant=; path=/; max-age=0';
        document.cookie = 'sale360_tenants=; path=/; max-age=0';
      }
    }
  },

  setAuth: ({ token, user, tenant, tenants }) => {
    const maxAge = 60 * 60 * 24 * 7;
    document.cookie = `sale360_token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `sale360_user=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=${maxAge}; SameSite=Lax`;
    if (tenant) {
      document.cookie = `sale360_tenant=${encodeURIComponent(JSON.stringify(tenant))}; path=/; max-age=${maxAge}; SameSite=Lax`;
    } else {
      document.cookie = 'sale360_tenant=; path=/; max-age=0';
    }
    if (tenants && tenants.length > 0) {
      document.cookie = `sale360_tenants=${encodeURIComponent(JSON.stringify(tenants))}; path=/; max-age=${maxAge}; SameSite=Lax`;
      set({ availableTenants: tenants });
    } else {
      document.cookie = 'sale360_tenants=; path=/; max-age=0';
      set({ availableTenants: [] });
    }
    set({ token, user, tenant, isAuthenticated: true, isSuperAdmin: user.role === 'SUPER_ADMIN' });
  },

  setAvailableTenants: (tenants) => {
    const maxAge = 60 * 60 * 24 * 7;
    document.cookie = `sale360_tenants=${encodeURIComponent(JSON.stringify(tenants))}; path=/; max-age=${maxAge}; SameSite=Lax`;
    set({ availableTenants: tenants });
  },

  switchTenant: async (tenantId) => {
    const { availableTenants, token, user } = get();

    // SUPER_ADMIN switching to platform admin mode (no tenant)
    if (tenantId === '__admin__') {
      const res = await fetch(`/api/auth/switch-tenant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tenantId: '__admin__' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao acessar painel admin');
      }

      const data = await res.json();
      get().setAuth({
        token: data.token,
        user: { ...user!, role: 'SUPER_ADMIN' },
        tenant: null,
        tenants: availableTenants,
      });
      return;
    }

    const selected = availableTenants.find((t) => t.id === tenantId);
    if (!selected) throw new Error('Empresa não encontrada');

    const res = await fetch(`/api/auth/switch-tenant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tenantId }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao trocar de empresa');
    }

    const data = await res.json();
    get().setAuth({
      token: data.token,
      user: { ...user!, role: data.user.role, pin: data.user.pin },
      tenant: data.tenant,
      tenants: availableTenants,
    });
  },

  logout: () => {
    document.cookie = 'sale360_token=; path=/; max-age=0';
    document.cookie = 'sale360_user=; path=/; max-age=0';
    document.cookie = 'sale360_tenant=; path=/; max-age=0';
    document.cookie = 'sale360_tenants=; path=/; max-age=0';
    set({ token: null, user: null, tenant: null, availableTenants: [], isAuthenticated: false, isSuperAdmin: false });
    window.location.href = '/login';
  },
}));
