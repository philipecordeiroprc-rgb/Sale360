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
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
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
    list(params?: { search?: string; categoryId?: string; active?: boolean; page?: number }) {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set('search', params.search);
      if (params?.categoryId) searchParams.set('categoryId', params.categoryId);
      if (params?.active !== undefined) searchParams.set('active', String(params.active));
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
    create(data: { name: string; color?: string; sortOrder?: number }) {
      return request<CategoryWithCount>('/api/categories', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: { name?: string; color?: string; sortOrder?: number }) {
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
  },

  // Dashboard
  dashboard: {
    summary() {
      return request<any>('/api/orders/today-summary');
    },
  },
};

export interface CategoryWithCount {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  _count: { products: number };
}

export default api;
