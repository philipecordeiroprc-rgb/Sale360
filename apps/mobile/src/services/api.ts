// ============================================================
// Sale360 Mobile — API Client
// ============================================================

import { useStore } from '../stores/useStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiOptions {
  method?: string;
  body?: any;
  auth?: boolean;
}

async function request<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth) {
    const token = useStore.getState().token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// --- Products ---

export async function fetchProducts(search?: string, categoryId?: string) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (categoryId) params.set('categoryId', categoryId);

  const qs = params.toString();
  return request(`/api/products${qs ? `?${qs}` : ''}`);
}

export async function fetchProductByBarcode(barcode: string) {
  return request(`/api/products/barcode/${barcode}`);
}

// --- Orders ---

export async function createOrder(orderData: any) {
  return request('/api/orders', { method: 'POST', body: orderData });
}

export async function fetchTodaySummary() {
  return request('/api/orders/today-summary');
}

// --- Customers ---

export async function fetchCustomers(search?: string) {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  return request(`/api/customers${params}`);
}

export async function fetchRecentBuyers() {
  return request('/api/customers/recent-buyers');
}

// --- Commands ---

export async function fetchCommands() {
  return request('/api/commands');
}

export async function closeCommand(id: string, data: any) {
  return request(`/api/commands/${id}/close`, { method: 'POST', body: data });
}

// --- Finance ---

export async function fetchCashFlow(month?: number, year?: number) {
  const params = new URLSearchParams();
  if (month) params.set('month', String(month));
  if (year) params.set('year', String(year));
  return request(`/api/finance/cash-flow?${params.toString()}`);
}

export async function fetchSalesReport(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  return request(`/api/finance/reports/sales?${params.toString()}`);
}

// --- Auth ---

export async function login(email: string, password: string, deviceId?: string) {
  return request('/api/auth/login', {
    method: 'POST',
    body: { email, password, deviceId },
    auth: false,
  });
}

