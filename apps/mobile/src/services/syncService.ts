// ============================================================
// Sale360 Mobile — Sync Service
// Manages background sync between local DB and server
// ============================================================

import { getDatabase, getPendingOrders, markOrderSynced } from '../db/localDatabase';
import { useStore } from '../stores/useStore';

const SYNC_INTERVAL_MS = 30_000; // 30 seconds when online
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

let syncTimer: ReturnType<typeof setInterval> | null = null;

export function startSyncService() {
  if (syncTimer) return;

  // Initial sync
  performSync();

  // Periodic sync
  syncTimer = setInterval(performSync, SYNC_INTERVAL_MS);
}

export function stopSyncService() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

async function performSync() {
  const { token, isOnline, setSyncing, setPendingSyncCount, setProducts, setCategories, setCustomers, updateProductStock } = useStore.getState();

  if (!token || !isOnline) return;

  setSyncing(true);

  try {
    const db = await getDatabase();

    // 1. Push pending orders
    const pendingOrders = await getPendingOrders(db);

    if (pendingOrders.length > 0) {
      for (const order of pendingOrders) {
        const orderData = JSON.parse(order.order_data);

        const res = await fetch(`${API_URL}/api/sync/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            deviceId: useStore.getState().deviceId,
            changes: {
              orders: [{
                localId: order.local_id,
                data: orderData,
                createdAtDevice: order.created_at_device,
              }],
            },
          }),
        });

        if (res.ok) {
          await markOrderSynced(db, order.local_id);
        }
      }
    }

    // 2. Pull updates from server
    const lastSyncAt = localStorage.getItem('sale360_last_sync');
    const params = new URLSearchParams({
      deviceId: useStore.getState().deviceId,
    });
    if (lastSyncAt) params.set('lastSyncAt', lastSyncAt);

    const pullRes = await fetch(`${API_URL}/api/sync/pull?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (pullRes.ok) {
      const data = await pullRes.json();

      // Update local products cache
      if (data.products?.length) {
        const { saveProductsLocally } = await import('../db/localDatabase');
        await saveProductsLocally(db, data.products);
        setProducts(data.products);
      }

      // Update local customers cache
      if (data.customers?.length) {
        const { saveCustomersLocally } = await import('../db/localDatabase');
        await saveCustomersLocally(db, data.customers);
        setCustomers(data.customers);
      }

      // Update stock
      if (data.stock?.length) {
        for (const s of data.stock) {
          updateProductStock(s.id, s.stockQty);
        }
      }

      localStorage.setItem('sale360_last_sync', data.serverTime);
    }

    // Update pending count
    const remaining = pendingOrders.filter((o) => o.sync_status === 'pending').length;
    setPendingSyncCount(remaining);

  } catch (err) {
    console.warn('Sync failed:', err);
  } finally {
    setSyncing(false);
  }
}

// Trigger immediate sync (called after creating order offline)
export async function syncNow() {
  const { isOnline } = useStore.getState();
  if (!isOnline) return;
  await performSync();
}
