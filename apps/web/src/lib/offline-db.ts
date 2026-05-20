/**
 * Offline IndexedDB wrapper — caches products, customers, categories,
 * and stores pending orders for later sync.
 *
 * No external dependencies — uses raw IndexedDB API.
 */

const DB_NAME = 'sale360_offline';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('customers')) {
        const custStore = db.createObjectStore('customers', { keyPath: 'id' });
        custStore.createIndex('name', 'name', { unique: false });
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pending_orders')) {
        const poStore = db.createObjectStore('pending_orders', { keyPath: 'localId' });
        poStore.createIndex('status', 'status', { unique: false });
        poStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('sync_meta')) {
        db.createObjectStore('sync_meta', { keyPath: 'key' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---- Generic helper ----
function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const request = callback(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

// ---- Products ----
export function cacheProducts(products: any[]): Promise<void> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readwrite');
      const store = tx.objectStore('products');
      store.clear();
      for (const p of products) {
        store.put({ ...p, _cachedAt: Date.now() });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

export function getProducts(): Promise<any[]> {
  return withStore('products', 'readonly', (s) => s.getAll());
}

export function getProduct(id: string): Promise<any | null> {
  return withStore('products', 'readonly', (s) => s.get(id));
}

/**
 * Decrement stock locally after an offline sale.
 * If variationId is provided, decrements the variation's stockQty.
 * Otherwise, decrements the product's stockQty.
 */
export async function decrementLocalStock(
  productId: string,
  variationId: string | undefined,
  quantity: number,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    const getReq = store.get(productId);
    getReq.onsuccess = () => {
      const product = getReq.result;
      if (!product) return resolve();
      if (variationId && product.variations?.length) {
        product.variations = product.variations.map((v: any) => {
          if (v.id === variationId) {
            return { ...v, stockQty: Math.max(0, (Number(v.stockQty) || 0) - quantity) };
          }
          return v;
        });
      } else {
        product.stockQty = Math.max(0, (Number(product.stockQty) || 0) - quantity);
      }
      store.put(product);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function mergeProducts(products: any[]): Promise<void> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readwrite');
      const store = tx.objectStore('products');
      for (const p of products) {
        store.put({ ...p, _cachedAt: Date.now() });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

export function clearProducts(): Promise<void> {
  return withStore('products', 'readwrite', (s) => s.clear());
}

// ---- Customers ----
export function cacheCustomers(customers: any[]): Promise<void> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('customers', 'readwrite');
      const store = tx.objectStore('customers');
      store.clear();
      for (const c of customers) {
        store.put({ ...c, _cachedAt: Date.now() });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

export function getCustomers(): Promise<any[]> {
  return withStore('customers', 'readonly', (s) => s.getAll());
}

export function mergeCustomers(customers: any[]): Promise<void> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('customers', 'readwrite');
      const store = tx.objectStore('customers');
      for (const c of customers) {
        store.put({ ...c, _cachedAt: Date.now() });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

export function clearCustomers(): Promise<void> {
  return withStore('customers', 'readwrite', (s) => s.clear());
}

// ---- Categories ----
export function cacheCategories(categories: any[]): Promise<void> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('categories', 'readwrite');
      const store = tx.objectStore('categories');
      store.clear();
      for (const c of categories) {
        store.put({ ...c, _cachedAt: Date.now() });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

export function getCategories(): Promise<any[]> {
  return withStore('categories', 'readonly', (s) => s.getAll());
}

// ---- Pending Orders ----
export interface PendingOrder {
  localId: string;
  data: any;
  status: 'pending' | 'syncing' | 'failed';
  createdAt: number;
  lastAttempt: number;
  error: string | null;
}

export function addPendingOrder(order: PendingOrder): Promise<void> {
  return withStore('pending_orders', 'readwrite', (s) => s.add(order)).then(() => {});
}

export function getPendingOrders(status?: string): Promise<PendingOrder[]> {
  return withStore('pending_orders', 'readonly', (s) => s.getAll()).then(
    (all) => (status ? all.filter((o: PendingOrder) => o.status === status) : all),
  );
}

export function updatePendingOrder(localId: string, updates: Partial<PendingOrder>): Promise<void> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_orders', 'readwrite');
      const store = tx.objectStore('pending_orders');
      const getReq = store.get(localId);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) return resolve();
        store.put({ ...existing, ...updates });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

export function removePendingOrder(localId: string): Promise<void> {
  return withStore('pending_orders', 'readwrite', (s) => s.delete(localId)).then(() => {});
}

export function countPendingOrders(): Promise<number> {
  return withStore('pending_orders', 'readonly', (s) => s.count());
}

// ---- Sync Metadata ----
export function getLastSync(): Promise<string | null> {
  return withStore('sync_meta', 'readonly', (s) => s.get('last_sync_at')).then(
    (row: any) => row?.value || null,
  );
}

export function setLastSync(timestamp: string): Promise<void> {
  return withStore('sync_meta', 'readwrite', (s) => s.put({ key: 'last_sync_at', value: timestamp })).then(() => {});
}

// ---- Bulk ----
export function clearAll(): Promise<void> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['products', 'customers', 'categories', 'pending_orders', 'sync_meta'], 'readwrite');
      tx.objectStore('products').clear();
      tx.objectStore('customers').clear();
      tx.objectStore('categories').clear();
      tx.objectStore('pending_orders').clear();
      tx.objectStore('sync_meta').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}
