// ============================================================
// Sale360 Core — Shared business logic
// ============================================================

// --- Plans & Feature Flags ---

export type Plan = 'PRO' | 'GROW' | 'PRIME';

export interface PlanFeatures {
  maxUsers: number;
  maxDevices: number;
  webVersion: boolean;
  aiDescriptions: boolean;
  aiAssistant: boolean;
  magicRegister: boolean;
  variations: boolean;
  bulkImport: boolean;
  suppliers: boolean;
  recurrentExpenses: boolean;
  unlimitedUsers: boolean;
  prioritySupport: boolean;
  saturday: boolean;
  videoCall: boolean;
  whatsappSupport: boolean;
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  PRO: {
    maxUsers: 1,
    maxDevices: 1,
    webVersion: false,
    aiDescriptions: false,
    aiAssistant: false,
    magicRegister: false,
    variations: false,
    bulkImport: false,
    suppliers: false,
    recurrentExpenses: false,
    unlimitedUsers: false,
    prioritySupport: false,
    saturday: false,
    videoCall: false,
    whatsappSupport: false,
  },
  GROW: {
    maxUsers: 10,
    maxDevices: 5,
    webVersion: true,
    aiDescriptions: true,
    aiAssistant: false,
    magicRegister: false,
    variations: true,
    bulkImport: true,
    suppliers: true,
    recurrentExpenses: true,
    unlimitedUsers: false,
    prioritySupport: false,
    saturday: false,
    videoCall: false,
    whatsappSupport: false,
  },
  PRIME: {
    maxUsers: Infinity,
    maxDevices: Infinity,
    webVersion: true,
    aiDescriptions: true,
    aiAssistant: true,
    magicRegister: true,
    variations: true,
    bulkImport: true,
    suppliers: true,
    recurrentExpenses: true,
    unlimitedUsers: true,
    prioritySupport: true,
    saturday: true,
    videoCall: true,
    whatsappSupport: true,
  },
};

// --- Price Calculator ---

export function calculatePlanPrice(plan: Plan, frequency: 'monthly' | 'annual'): number {
  const prices: Record<Plan, number> = {
    PRO: 49.9,
    GROW: 69.9,
    PRIME: 99.9,
  };

  const monthly = prices[plan];
  if (frequency === 'annual') {
    // Pay 10 months, get 12 (2 free)
    return Math.round(monthly * 10 * 100) / 100;
  }
  return monthly;
}

// --- Offline Sync ---

export interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  entity: string;
  entityId: string;
  payload: Record<string, unknown>;
  createdAtDevice: string;
  syncedAt?: string;
  retries: number;
}

// --- Order Helpers ---

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function generateOrderNumber(prefix: string, seq: number): string {
  return `${prefix}${String(seq).padStart(6, '0')}`;
}

// --- Payment Methods ---

export const PAYMENT_METHODS = [
  { id: 'pix', label: 'Pix', icon: 'qr-code' },
  { id: 'credit', label: 'Crédito', icon: 'card' },
  { id: 'debit', label: 'Débito', icon: 'card-outline' },
  { id: 'cash', label: 'Dinheiro', icon: 'cash' },
  { id: 'credit_store', label: 'Fiado', icon: 'wallet' },
] as const;

// --- Units ---

export const UNITS = [
  { id: 'UN', label: 'Unidade', symbol: 'un' },
  { id: 'PC', label: 'Peça', symbol: 'pc' },
  { id: 'CX', label: 'Caixa', symbol: 'cx' },
  { id: 'KG', label: 'Quilo', symbol: 'kg' },
  { id: 'G', label: 'Grama', symbol: 'g' },
  { id: 'L', label: 'Litro', symbol: 'l' },
  { id: 'ML', label: 'Mililitro', symbol: 'ml' },
  { id: 'M', label: 'Metro', symbol: 'm' },
  { id: 'M2', label: 'Metro²', symbol: 'm²' },
  { id: 'PAR', label: 'Par', symbol: 'par' },
  { id: 'FD', label: 'Fardo', symbol: 'fd' },
  { id: 'PCT', label: 'Pacote', symbol: 'pct' },
] as const;

// --- Permissions ---

export const PERMISSIONS = {
  SUPER_ADMIN: ['*'],
  OWNER: ['*'],
  CASHIER: [
    'products.read',
    'orders.read', 'orders.write',
    'customers.read', 'customers.write',
  ],
} as const;

export function hasPermission(role: string, permission: string): boolean {
  const perms = PERMISSIONS[role as keyof typeof PERMISSIONS];
  if (!perms) return false;
  if ((perms as readonly string[]).includes('*')) return true;
  return (perms as readonly string[]).some(p => {
    if (p.endsWith('.*')) return permission.startsWith(p.slice(0, -1));
    return p === permission;
  });
}
