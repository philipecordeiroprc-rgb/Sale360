import { create } from 'zustand';

export interface CartItem {
  productId: string;
  variationId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface CouponInfo {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  discountAmount: number;
}

interface CartState {
  items: CartItem[];
  coupon: CouponInfo | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  paymentMethod: string;
  notes: string;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variationId?: string) => void;
  updateQty: (productId: string, variationId: string | undefined, qty: number) => void;
  clearCart: () => void;
  setCoupon: (coupon: CouponInfo | null) => void;
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;
  setCustomerEmail: (email: string) => void;
  setPaymentMethod: (method: string) => void;
  setNotes: (notes: string) => void;
  itemCount: () => number;
  subtotal: () => number;
  discount: () => number;
  total: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  coupon: null,
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  paymentMethod: '',
  notes: '',

  addItem: (item) => {
    const items = [...get().items];
    const existing = items.find(
      (i) => i.productId === item.productId && i.variationId === item.variationId,
    );
    if (existing) {
      existing.quantity += item.quantity;
      existing.total = existing.quantity * existing.unitPrice;
    } else {
      items.push(item);
    }
    set({ items });
  },

  removeItem: (productId, variationId) => {
    set({
      items: get().items.filter(
        (i) => !(i.productId === productId && i.variationId === variationId),
      ),
    });
  },

  updateQty: (productId, variationId, qty) => {
    if (qty <= 0) {
      get().removeItem(productId, variationId);
      return;
    }
    set({
      items: get().items.map((i) =>
        i.productId === productId && i.variationId === variationId
          ? { ...i, quantity: qty, total: qty * i.unitPrice }
          : i,
      ),
    });
  },

  clearCart: () =>
    set({
      items: [],
      coupon: null,
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      paymentMethod: '',
      notes: '',
    }),

  setCoupon: (coupon) => set({ coupon }),
  setCustomerName: (name) => set({ customerName: name }),
  setCustomerPhone: (phone) => set({ customerPhone: phone }),
  setCustomerEmail: (email) => set({ customerEmail: email }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  setNotes: (notes) => set({ notes }),

  itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  subtotal: () => get().items.reduce((sum, i) => sum + i.total, 0),

  discount: () => {
    const { coupon, items } = get();
    if (!coupon) return 0;
    const sub = items.reduce((sum, i) => sum + i.total, 0);
    if (coupon.discountType === 'PERCENTAGE') {
      return sub * (coupon.discountValue / 100);
    }
    return Math.min(coupon.discountValue, sub);
  },

  total: () => {
    const sub = get().subtotal();
    const disc = get().discount();
    return Math.max(sub - disc, 0);
  },
}));
