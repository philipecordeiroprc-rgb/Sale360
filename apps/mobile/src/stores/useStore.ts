// ============================================================
// Sale360 Mobile — Global State (Zustand)
// Design principle: Minimal clicks, everything at hand
// ============================================================

import { create } from 'zustand';
import type { Plan } from '@sale360/core';

// --- Types ---

export interface Product {
  id: string;
  name: string;
  description?: string;
  barcode?: string;
  price: number;
  costPrice?: number;
  stockQty: number;
  unit: string;
  imageUrl?: string;
  category?: { id: string; name: string; color: string };
  variations?: ProductVariation[];
  isFractional: boolean;
  active: boolean;
}

export interface ProductVariation {
  id: string;
  name: string;
  priceModifier: number;
  stockQty: number;
}

export interface CartItem {
  id: string; // local cart item ID
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  variation?: string;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  creditBalance: number;
  totalPurchases: number;
  totalSpent: number;
  lastPurchaseAt?: string;
}

export interface TableCommand {
  id: string;
  tableNumber: string;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  customerName?: string;
  items: CommandItem[];
  subtotal: number;
  discount: number;
  total: number;
  openedAt: string;
}

export interface CommandItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
}

// --- State ---

interface AppState {
  // Auth
  token: string | null;
  user: { id: string; name: string; email: string; role: string } | null;
  tenant: { id: string; companyName: string; plan: Plan; slug: string } | null;
  deviceId: string;

  // Online/Offline
  isOnline: boolean;
  isSyncing: boolean;
  pendingSyncCount: number;

  // PDV Mode
  currentView: 'sell' | 'commands' | 'catalog' | 'customers' | 'dashboard';
  selectedCategory: string | null;
  searchQuery: string;

  // Cart
  cart: CartItem[];
  selectedCustomer: Customer | null;

  // Products (cached locally)
  products: Product[];
  categories: { id: string; name: string; color: string }[];

  // Commands
  commands: TableCommand[];

  // Customers (cached)
  customers: Customer[];

  // Actions
  setAuth: (auth: Partial<Pick<AppState, 'token' | 'user' | 'tenant'>>) => void;
  setOnline: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setPendingSyncCount: (count: number) => void;

  // Navigation
  setView: (view: AppState['currentView']) => void;
  setCategory: (id: string | null) => void;
  setSearch: (query: string) => void;

  // Cart (fast — no API calls for basic operations)
  addToCart: (product: Product, variation?: ProductVariation) => void;
  updateCartItem: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  setCustomer: (customer: Customer | null) => void;

  // Products cache
  setProducts: (products: Product[]) => void;
  setCategories: (categories: { id: string; name: string; color: string }[]) => void;
  updateProductStock: (productId: string, newStock: number) => void;

  // Commands
  setCommands: (commands: TableCommand[]) => void;
  updateCommand: (command: TableCommand) => void;

  // Customers cache
  setCustomers: (customers: Customer[]) => void;
}

// Generate unique cart item ID
const cartItemId = () => `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  token: null,
  user: null,
  tenant: null,
  deviceId: `device_${Date.now()}`,
  isOnline: true,
  isSyncing: false,
  pendingSyncCount: 0,
  currentView: 'sell',
  selectedCategory: null,
  searchQuery: '',
  cart: [],
  selectedCustomer: null,
  products: [],
  categories: [],
  commands: [],
  customers: [],

  // Auth
  setAuth: (auth) => set(auth),

  // Connection
  setOnline: (online) => set({ isOnline: online }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setPendingSyncCount: (count) => set({ pendingSyncCount: count }),

  // Navigation
  setView: (view) => set({ currentView: view, selectedCategory: null, searchQuery: '' }),
  setCategory: (id) => set({ selectedCategory: id }),
  setSearch: (query) => set({ searchQuery: query }),

  // Cart — designed for speed (2 clicks: select product → checkout)
  addToCart: (product, variation) => {
    const { cart } = get();
    const price = variation
      ? Number(product.price) + Number(variation.priceModifier)
      : Number(product.price);

    // If product already in cart, increment quantity
    const existing = cart.find(
      (item) =>
        item.productId === product.id &&
        (!variation || item.variation === variation.name)
    );

    if (existing) {
      set({
        cart: cart.map((item) =>
          item.id === existing.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total: (item.quantity + 1) * price,
              }
            : item,
        ),
      });
      return;
    }

    set({
      cart: [
        ...cart,
        {
          id: cartItemId(),
          productId: product.id,
          productName: variation ? `${product.name} (${variation.name})` : product.name,
          quantity: 1,
          unitPrice: price,
          total: price,
          variation: variation?.name,
        },
      ],
    });
  },

  updateCartItem: (id, quantity) => {
    const { cart } = get();
    if (quantity <= 0) {
      set({ cart: cart.filter((item) => item.id !== id) });
      return;
    }
    set({
      cart: cart.map((item) =>
        item.id === id
          ? { ...item, quantity, total: quantity * item.unitPrice }
          : item,
      ),
    });
  },

  removeFromCart: (id) => {
    set({ cart: get().cart.filter((item) => item.id !== id) });
  },

  clearCart: () => set({ cart: [], selectedCustomer: null }),

  setCustomer: (customer) => set({ selectedCustomer: customer }),

  // Products
  setProducts: (products) => set({ products }),
  setCategories: (categories) => set({ categories }),
  updateProductStock: (productId, newStock) => {
    set({
      products: get().products.map((p) =>
        p.id === productId ? { ...p, stockQty: newStock } : p,
      ),
    });
  },

  // Commands
  setCommands: (commands) => set({ commands }),
  updateCommand: (command) => {
    set({
      commands: get().commands.map((c) => (c.id === command.id ? command : c)),
    });
  },

  // Customers
  setCustomers: (customers) => set({ customers }),
}));
