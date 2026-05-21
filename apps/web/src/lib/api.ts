const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

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
    const msg = data.details
      ? `${data.error}: ${JSON.stringify(data.details)}`
      : (data.error || `Erro ${res.status}`);
    throw new Error(msg);
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
  variationTemplate?: VariationTemplate | null;
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
  avgMargin?: number | null;
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
  price?: number;
  description?: string;
  sku?: string;
  barcode?: string;
  categoryId?: string;
  imageUrl?: string | null;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {}

export const api = {
  // Auth
  auth: {
    switchTenant(tenantId: string) {
      return request<{ token: string; refreshToken: string; user: any; tenant: any }>('/api/auth/switch-tenant', {
        method: 'POST',
        body: JSON.stringify({ tenantId }),
      });
    },
  },

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
    getByBarcode(code: string) {
      return request<Product>(`/api/products/barcode/${encodeURIComponent(code)}`);
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
    uploadImage(productId: string, file: File) {
      const formData = new FormData();
      formData.append('file', file);
      return upload(`/api/products/${productId}/image`, formData);
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
    create(data: { name: string; sortOrder?: number; variationTemplateId?: string }) {
      return request<CategoryWithCount>('/api/categories', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: { name?: string; sortOrder?: number; variationTemplateId?: string | null }) {
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
    list(params?: { search?: string; status?: string; paymentMethod?: string; page?: number }) {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set('search', params.search);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.paymentMethod) searchParams.set('paymentMethod', params.paymentMethod);
      if (params?.page) searchParams.set('page', String(params.page));
      const qs = searchParams.toString();
      return request<any>(`/api/orders${qs ? `?${qs}` : ''}`);
    },
    todaySummary() {
      return request<any>('/api/orders/today-summary');
    },
    create(data: {
      customerId?: string;
      customerName?: string;
      items: { productId?: string; variationId?: string; productName: string; quantity: number; unitPrice: number; total: number }[];
      subtotal: number;
      discount?: number;
      total: number;
      paymentMethod: string;
      paymentStatus?: string;
      dueDate?: string;
      notes?: string;
      couponId?: string;
      couponDiscount?: number;
    }) {
      // Generate localId for offline support
      const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return request<any>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({ ...data, localId, paymentStatus: data.paymentStatus || 'PAID' }),
      });
    },
    get(id: string) {
      return request<any>(`/api/orders/${id}`);
    },
    cancel(id: string) {
      return request<any>(`/api/orders/${id}/cancel`, { method: 'POST' });
    },
    pay(id: string, data?: { paidAmount?: number; paymentMethod?: string }) {
      return request<any>(`/api/orders/${id}/pay`, { method: 'POST', body: JSON.stringify(data || {}) });
    },
    confirm(id: string, data?: { paymentMethod?: string }) {
      return request<any>(`/api/orders/${id}/confirm`, { method: 'POST', body: JSON.stringify(data || {}) });
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
    create(data: { supplierId: string; customerId?: string; items: { productId?: string; variationId?: string; productName: string; quantity: number; unitCost: number; total: number; salePrice?: number; operationalCost?: number; taxRatePct?: number; marginPct?: number }[]; discount?: number; notes?: string }) {
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

  // Reports
  reports: {
    financial(params?: { startDate?: string; endDate?: string }) {
      const sp = new URLSearchParams();
      if (params?.startDate) sp.set('startDate', params.startDate);
      if (params?.endDate) sp.set('endDate', params.endDate);
      const qs = sp.toString();
      return request<any>(`/api/reports/financial${qs ? `?${qs}` : ''}`);
    },
  },

  // Payment Method Configs
  paymentConfigs: {
    list() {
      return request<{ paymentMethod: string; label: string; taxRate: number }[]>('/api/payment-configs');
    },
    update(configs: { paymentMethod: string; taxRate: number }[]) {
      return request<any>('/api/payment-configs', { method: 'PUT', body: JSON.stringify({ configs }) });
    },
  },

  // Coupons
  coupons: {
    list(params?: { search?: string; active?: boolean }) {
      const sp = new URLSearchParams();
      if (params?.search) sp.set('search', params.search);
      if (params?.active !== undefined) sp.set('active', String(params.active));
      const qs = sp.toString();
      return request<{ coupons: any[] }>(`/api/coupons${qs ? `?${qs}` : ''}`);
    },
    get(id: string) {
      return request<any>(`/api/coupons/${id}`);
    },
    create(data: {
      code: string;
      description?: string;
      discountType: 'PERCENTAGE' | 'FIXED';
      discountValue: number;
      minOrderValue?: number;
      maxDiscount?: number;
      usageLimit?: number;
      validFrom?: string;
      validUntil?: string;
      active?: boolean;
      productIds?: string[];
      categoryIds?: string[];
    }) {
      return request<any>('/api/coupons', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Record<string, unknown>) {
      return request<any>(`/api/coupons/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    delete(id: string) {
      return request<{ success: boolean }>(`/api/coupons/${id}`, { method: 'DELETE' });
    },
    validate(data: { code: string; orderSubtotal: number; productIds?: string[]; categoryIds?: string[] }) {
      return request<any>('/api/coupons/validate', { method: 'POST', body: JSON.stringify(data) });
    },
  },

  // Dashboard
  dashboard: {
    summary() {
      return request<any>('/api/orders/today-summary');
    },
  },

  // Tenant users (ADMIN)
  tenant: {
    users: {
      list() {
        return request<any[]>('/api/tenant/users');
      },
      create(data: { email: string; name: string; password: string; role: string; pin?: string }) {
        return request<any>('/api/tenant/users', { method: 'POST', body: JSON.stringify(data) });
      },
      update(userId: string, data: { role?: string; pin?: string }) {
        return request<any>(`/api/tenant/users/${userId}`, { method: 'PUT', body: JSON.stringify(data) });
      },
      remove(userId: string) {
        return request<{ success: boolean }>(`/api/tenant/users/${userId}`, { method: 'DELETE' });
      },
      resetPassword(userId: string, password: string) {
        return request<any>(`/api/tenant/users/${userId}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) });
      },
    },
    me: {
      profile() {
        return request<any>('/api/tenant/me/profile');
      },
      changePassword(currentPassword: string, newPassword: string) {
        return request<any>('/api/tenant/me/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      },
    },
    features() {
      return request<any>('/api/tenant/features');
    },
    devices() {
      return request<any[]>('/api/tenant/devices');
    },
  },

  // Admin (SUPER_ADMIN)
  admin: {
    tenants: {
      list(params?: { search?: string }) {
        const sp = new URLSearchParams();
        if (params?.search) sp.set('search', params.search);
        const qs = sp.toString();
        return request<{ tenants: any[]; total: number; page: number; totalPages: number }>(`/api/admin/tenants${qs ? `?${qs}` : ''}`);
      },
      get(id: string) {
        return request<any>(`/api/admin/tenants/${id}`);
      },
      create(data: { companyName: string; slug: string; plan: string; status: string; trialEndsAt?: string }) {
        return request<any>('/api/admin/tenants', { method: 'POST', body: JSON.stringify(data) });
      },
      update(id: string, data: { companyName?: string; slug?: string; plan?: string; status?: string; trialEndsAt?: string | null }) {
        return request<any>(`/api/admin/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
      },
      users: {
        list(tenantId: string) {
          return request<any[]>(`/api/admin/tenants/${tenantId}/users`);
        },
        add(tenantId: string, data: { email: string; name: string; password: string; role: string; pin?: string }) {
          return request<any>(`/api/admin/tenants/${tenantId}/users`, { method: 'POST', body: JSON.stringify(data) });
        },
        update(tenantId: string, userId: string, data: { role?: string; pin?: string; name?: string; email?: string }) {
          return request<any>(`/api/admin/tenants/${tenantId}/users/${userId}`, { method: 'PUT', body: JSON.stringify(data) });
        },
        remove(tenantId: string, userId: string) {
          return request<{ success: boolean }>(`/api/admin/tenants/${tenantId}/users/${userId}`, { method: 'DELETE' });
        },
        resetPassword(tenantId: string, userId: string, password: string) {
          return request<any>(`/api/admin/tenants/${tenantId}/users/${userId}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) });
        },
      },
      features: {
        get(tenantId: string) {
          return request<any>(`/api/admin/tenants/${tenantId}/features`);
        },
        update(tenantId: string, overrides: Record<string, boolean>) {
          return request<any>(`/api/admin/tenants/${tenantId}/features`, { method: 'PUT', body: JSON.stringify({ overrides }) });
        },
      },
    },
    users: {
      list(params?: { search?: string }) {
        const sp = new URLSearchParams();
        if (params?.search) sp.set('search', params.search);
        const qs = sp.toString();
        return request<{ users: any[]; total: number; page: number; totalPages: number }>(`/api/admin/users${qs ? `?${qs}` : ''}`);
      },
      resetPassword(userId: string, password: string) {
        return request<any>(`/api/admin/users/${userId}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) });
      },
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

  commands: {
    list(params?: { status?: string; page?: number }) {
      const sp = new URLSearchParams();
      if (params?.status) sp.set('status', params.status);
      if (params?.page) sp.set('page', String(params.page));
      const qs = sp.toString();
      return request<any>(`/api/commands${qs ? `?${qs}` : ''}`);
    },
    get(id: string) {
      return request<any>(`/api/commands/${id}`);
    },
    create(data: { customerName?: string; customerPhone?: string; tableNumber?: number }) {
      return request<any>('/api/commands', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: { customerName?: string; customerPhone?: string; tableNumber?: number }) {
      return request<any>(`/api/commands/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    close(id: string) {
      return request<any>(`/api/commands/${id}/close`, { method: 'POST' });
    },
  },

  // Catalog Settings
  catalogSettings: {
    get() {
      return request<any>('/api/catalog-settings');
    },
    update(data: any) {
      return request<any>('/api/catalog-settings', { method: 'PUT', body: JSON.stringify(data) });
    },
    uploadLogo(file: File) {
      const formData = new FormData();
      formData.append('file', file);
      return upload('/api/catalog-settings/logo', formData);
    },
    uploadBanner(file: File) {
      const formData = new FormData();
      formData.append('file', file);
      return upload('/api/catalog-settings/banners', formData);
    },
    deleteBanner(id: string) {
      return request<any>(`/api/catalog-settings/banners/${id}`, { method: 'DELETE' });
    },
    reorderBanners(bannerIds: string[]) {
      return request<any>('/api/catalog-settings/banners/reorder', {
        method: 'PUT',
        body: JSON.stringify({ bannerIds }),
      });
    },
    updatePaymentMethods(methods: Array<{
      paymentMethod: string;
      enabled: boolean;
      dueDays?: number;
      instructions?: string;
    }>) {
      return request<any>('/api/catalog-settings/payment-methods', {
        method: 'PUT',
        body: JSON.stringify({ methods }),
      });
    },
  },

  // Public catalog
  public: {
    getCatalog(slug: string) {
      return request<any>(`/api/public/catalog/${slug}`);
    },
    createOrder(data: {
      tenantSlug: string;
      customerName: string;
      customerPhone?: string;
      items: Array<{
        productId: string;
        variationId?: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        total: number;
      }>;
      subtotal: number;
      discount?: number;
      total: number;
      paymentMethod: string;
      couponCode?: string;
      couponDiscount?: number;
    }) {
      return request<any>('/api/public/orders', { method: 'POST', body: JSON.stringify(data) });
    },
    validateCoupon(tenantSlug: string, code: string, subtotal: number) {
      return request<any>('/api/public/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ tenantSlug, code, subtotal }),
      });
    },
  },
};

async function upload(path: string, formData: FormData) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

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
