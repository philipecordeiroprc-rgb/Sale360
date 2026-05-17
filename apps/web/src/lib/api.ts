const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)sale360_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  // Only send Content-Type when there's a body to send
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Erro ${res.status}`);
  }

  return data as T;
}

// ============================================================
// Products
// ============================================================

export interface ProductCategory {
  id: string;
  name: string;
  color: string | null;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  barcode?: string | null;
  price: number;
  costPrice?: number | null;
  unit: string;
  stockQty: number;
  lowStockAt?: number | null;
  imageUrl?: string | null;
  active: boolean;
  isFractional: boolean;
  hasVariations: boolean;
  taxRate?: number | null;
  operationalCost?: number | null;
  categoryId?: string | null;
  category?: ProductCategory | null;
  variations: any[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CreateProductInput {
  name: string;
  price: number;
  description?: string;
  sku?: string;
  barcode?: string;
  costPrice?: number;
  unit?: string;
  stockQty?: number;
  lowStockAt?: number;
  categoryId?: string;
  isFractional?: boolean;
  taxRate?: number;
  operationalCost?: number;
  imageUrl?: string;
  hasVariations?: boolean;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {}

export const api = {
  // Products
  products: {
    list(params?: { search?: string; categoryId?: string; active?: boolean; variationName?: string; page?: number }) {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set('search', params.search);
      if (params?.categoryId) searchParams.set('categoryId', params.categoryId);
      if (params?.active !== undefined) searchParams.set('active', String(params.active));
      if (params?.variationName) searchParams.set('variationName', params.variationName);
      if (params?.page) searchParams.set('page', String(params.page));
      const qs = searchParams.toString();
      return request<ProductsResponse>(`/api/products${qs ? `?${qs}` : ''}`);
    },
    get(id: string) {
      return request<Product>(`/api/products/${id}`);
    },
    create(data: CreateProductInput) {
      return request<Product>('/api/products', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: UpdateProductInput) {
      return request<Product>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    toggle(id: string) {
      return request<Product>(`/api/products/${id}/toggle`, { method: 'PATCH' });
    },
    delete(id: string) {
      return request<{ success: boolean }>(`/api/products/${id}`, { method: 'DELETE' });
    },
    // Variations
    addVariation(productId: string, data: { name: string; priceModifier?: number; stockQty?: number; lowStockAt?: number; sku?: string; barcode?: string }) {
      return request<any>(`/api/products/${productId}/variations`, { method: 'POST', body: JSON.stringify(data) });
    },
    updateVariation(productId: string, variationId: string, data: { name?: string; priceModifier?: number; stockQty?: number; lowStockAt?: number; sku?: string; barcode?: string }) {
      return request<any>(`/api/products/${productId}/variations/${variationId}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    deleteVariation(productId: string, variationId: string) {
      return request<{ success: boolean }>(`/api/products/${productId}/variations/${variationId}`, { method: 'DELETE' });
    },
  },

  // Categories
  categories: {
    list(search?: string) {
      const qs = search ? `?search=${encodeURIComponent(search)}` : '';
      return request<CategoryWithCount[]>(`/api/categories${qs}`);
    },
    get(id: string) {
      return request<CategoryWithCount>(`/api/categories/${id}`);
    },
    create(data: { name: string; color?: string; sortOrder?: number; variationTemplateId?: string }) {
      return request<CategoryWithCount>('/api/categories', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: { name?: string; color?: string; sortOrder?: number; variationTemplateId?: string | null }) {
      return request<CategoryWithCount>(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    delete(id: string) {
      return request<{ success: boolean }>(`/api/categories/${id}`, { method: 'DELETE' });
    },
  },

  // Customers
  customers: {
    list(params?: { search?: string; page?: number }) {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set('search', params.search);
      if (params?.page) searchParams.set('page', String(params.page));
      const qs = searchParams.toString();
      return request<any>(`/api/customers${qs ? `?${qs}` : ''}`);
    },
    create(data: { name: string; phone?: string; email?: string; document?: string; notes?: string }) {
      return request<any>('/api/customers', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: any) {
      return request<any>(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    delete(id: string) {
      return request<{ success: boolean }>(`/api/customers/${id}`, { method: 'DELETE' });
    },
    get(id: string) {
      return request<any>(`/api/customers/${id}`);
    },
  },

  // Orders
  orders: {
    list(params?: { search?: string; status?: string; page?: number }) {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set('search', params.search);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.page) searchParams.set('page', String(params.page));
      const qs = searchParams.toString();
      return request<any>(`/api/orders${qs ? `?${qs}` : ''}`);
    },
    todaySummary() {
      return request<any>('/api/orders/today-summary');
    },
    create(data: {
      customerId?: string;
      items: { productId?: string; variationId?: string; productName: string; quantity: number; unitPrice: number; total: number }[];
      subtotal: number;
      discount?: number;
      total: number;
      paymentMethod: string;
      paymentStatus?: string;
      notes?: string;
    }) {
      // Generate localId for offline support
      const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return request<any>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({ ...data, localId, paymentStatus: data.paymentStatus || 'PAID' }),
      });
    },
    cancel(id: string) {
      return request<any>(`/api/orders/${id}/cancel`, { method: 'POST' });
    },
  },

  // Suppliers
  suppliers: {
    list(params?: { search?: string; active?: boolean; page?: number }) {
      const sp = new URLSearchParams();
      if (params?.search) sp.set('search', params.search);
      if (params?.active !== undefined) sp.set('active', String(params.active));
      if (params?.page) sp.set('page', String(params.page));
      const qs = sp.toString();
      return request<any>(`/api/suppliers${qs ? `?${qs}` : ''}`);
    },
    get(id: string) {
      return request<any>(`/api/suppliers/${id}`);
    },
    create(data: any) {
      return request<any>('/api/suppliers', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: any) {
      return request<any>(`/api/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    toggle(id: string) {
      return request<any>(`/api/suppliers/${id}/toggle`, { method: 'PATCH' });
    },
    delete(id: string) {
      return request<{ success: boolean }>(`/api/suppliers/${id}`, { method: 'DELETE' });
    },
  },

  // Purchases
  purchases: {
    list(params?: { status?: string; supplierId?: string; page?: number }) {
      const sp = new URLSearchParams();
      if (params?.status) sp.set('status', params.status);
      if (params?.supplierId) sp.set('supplierId', params.supplierId);
      if (params?.page) sp.set('page', String(params.page));
      const qs = sp.toString();
      return request<any>(`/api/purchases${qs ? `?${qs}` : ''}`);
    },
    get(id: string) {
      return request<any>(`/api/purchases/${id}`);
    },
    create(data: { supplierId: string; customerId?: string; items: { productId?: string; variationId?: string; productName: string; quantity: number; unitCost: number; total: number }[]; discount?: number; notes?: string }) {
      return request<any>('/api/purchases', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: any) {
      return request<any>(`/api/purchases/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    receive(id: string) {
      return request<any>(`/api/purchases/${id}/receive`, { method: 'POST' });
    },
    cancel(id: string) {
      return request<any>(`/api/purchases/${id}/cancel`, { method: 'POST' });
    },
    delete(id: string) {
      return request<{ success: boolean }>(`/api/purchases/${id}`, { method: 'DELETE' });
    },
  },

  // Inventory
  inventory: {
    batches(params?: { productId?: string; variationId?: string; page?: number }) {
      const sp = new URLSearchParams();
      if (params?.productId) sp.set('productId', params.productId);
      if (params?.variationId) sp.set('variationId', params.variationId);
      if (params?.page) sp.set('page', String(params.page));
      const qs = sp.toString();
      return request<any>(`/api/inventory/batches${qs ? `?${qs}` : ''}`);
    },
    batchesByProduct(productId: string) {
      return request<any>(`/api/inventory/batches/${productId}`);
    },
    movements(params?: { productId?: string; type?: string; startDate?: string; endDate?: string; page?: number }) {
      const sp = new URLSearchParams();
      if (params?.productId) sp.set('productId', params.productId);
      if (params?.type) sp.set('type', params.type);
      if (params?.startDate) sp.set('startDate', params.startDate);
      if (params?.endDate) sp.set('endDate', params.endDate);
      if (params?.page) sp.set('page', String(params.page));
      const qs = sp.toString();
      return request<any>(`/api/inventory/movements${qs ? `?${qs}` : ''}`);
    },
    adjust(data: { productId?: string; variationId?: string; quantity: number; unitCost?: number; notes?: string }) {
      return request<any>('/api/inventory/adjust', { method: 'POST', body: JSON.stringify(data) });
    },
  },

  // Dashboard
  dashboard: {
    summary() {
      return request<any>('/api/orders/today-summary');
    },
  },

  // Variation Templates
  variationTemplates: {
    list() {
      return request<VariationTemplate[]>('/api/variation-templates');
    },
    get(id: string) {
      return request<VariationTemplate>(`/api/variation-templates/${id}`);
    },
    create(data: { name: string; dimensions: { type: DimensionType; label: string; options: string[]; orderIndex?: number }[] }) {
      return request<VariationTemplate>('/api/variation-templates', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: any) {
      return request<VariationTemplate>(`/api/variation-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    delete(id: string) {
      return request<{ success: boolean }>(`/api/variation-templates/${id}`, { method: 'DELETE' });
    },
  },
};

export interface CategoryWithCount {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  _count: { products: number };
  variationTemplateId?: string | null;
  variationTemplate?: VariationTemplate | null;
}

// Variation Template types
export type DimensionType = 'TAMANHO_LETRA' | 'TAMANHO_NUMERO' | 'COR' | 'VOLUME' | 'PESO' | 'PERSONALIZADO';

export interface VariationDimension {
  id: string;
  type: DimensionType;
  label: string;
  options: string[];
  orderIndex: number;
}

export interface VariationTemplate {
  id: string;
  name: string;
  tenantId?: string | null;
  dimensions: VariationDimension[];
}

export default api;
