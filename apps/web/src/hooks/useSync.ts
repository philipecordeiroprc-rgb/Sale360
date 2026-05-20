'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import {
  cacheProducts,
  cacheCustomers,
  cacheCategories,
  getPendingOrders,
  removePendingOrder,
  updatePendingOrder,
  countPendingOrders,
  getLastSync,
  setLastSync,
} from '@/lib/offline-db';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

let syncing = false; // module-level guard against concurrent syncs

function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)sale360_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getTenantId(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)sale360_tenant=([^;]*)/);
  if (!match) return null;
  try {
    const t = JSON.parse(decodeURIComponent(match[1]));
    return t.id || null;
  } catch {
    return null;
  }
}

function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('sale360_device_id');
  if (!id) {
    id = 'web_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('sale360_device_id', id);
  }
  return id;
}

export interface UseSyncReturn {
  sync: () => Promise<{ pulled: boolean; pushed: number; errors: number }>;
  isSyncing: boolean;
  isOnline: boolean;
  pendingCount: number;
}

export function useSync(): UseSyncReturn {
  const { isOnline, wasOffline, consumeOfflineFlag } = useNetworkStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Refresh pending count
  const refreshCount = useCallback(() => {
    countPendingOrders().then(setPendingCount).catch(() => {});
  }, []);

  // Initial count load
  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  const sync = useCallback(async () => {
    if (syncing) return { pulled: false, pushed: 0, errors: 0 };
    if (!isOnline && navigator.onLine === false) return { pulled: false, pushed: 0, errors: 0 };

    syncing = true;
    setIsSyncing(true);

    let pulled = false;
    let pushed = 0;
    let errors = 0;

    const token = getToken();
    if (!token) {
      syncing = false;
      setIsSyncing(false);
      return { pulled: false, pushed: 0, errors: 0 };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    try {
      // ---- Pull: fetch latest catalog ----
      const lastSync = await getLastSync();
      const deviceId = getDeviceId();
      const pullParams = new URLSearchParams({ deviceId });
      if (lastSync) pullParams.set('lastSyncAt', lastSync);

      try {
        const pullRes = await fetch(`${API_URL}/api/sync/pull?${pullParams}`, { headers });
        if (pullRes.ok) {
          const data = await pullRes.json();
          // Cache products, customers, categories
          const promises: Promise<void>[] = [];
          if (data.products?.length) promises.push(cacheProducts(data.products));
          if (data.customers?.length) promises.push(cacheCustomers(data.customers));
          if (data.categories?.length) promises.push(cacheCategories(data.categories));
          await Promise.all(promises);
          await setLastSync(new Date().toISOString());
          pulled = true;
        }
      } catch {
        // Pull failed — continue to push (doesn't block)
      }

      // ---- Push: send pending orders ----
      const pending = await getPendingOrders('pending');

      for (const order of pending) {
        try {
          await updatePendingOrder(order.localId, { status: 'syncing', lastAttempt: Date.now() });

          const pushBody = {
            deviceId: getDeviceId(),
            lastSyncAt: await getLastSync(),
            changes: {
              orders: [{
                localId: order.data.localId || order.localId,
                data: order.data,
                createdAtDevice: new Date(order.createdAt).toISOString(),
              }],
            },
          };

          const pushRes = await fetch(`${API_URL}/api/sync/push`, {
            method: 'POST',
            headers,
            body: JSON.stringify(pushBody),
          });

          if (pushRes.ok) {
            await removePendingOrder(order.localId);
            pushed++;
          } else {
            const errData = await pushRes.json();
            await updatePendingOrder(order.localId, {
              status: 'failed',
              error: errData.error || 'Erro ao sincronizar',
            });
            errors++;
          }
        } catch {
          // Network error during push — set back to pending, stop pushing
          await updatePendingOrder(order.localId, { status: 'pending' });
          break; // stop pushing, wait for next sync cycle
        }
      }
    } finally {
      syncing = false;
      setIsSyncing(false);
      refreshCount();
    }

    return { pulled, pushed, errors };
  }, [isOnline, refreshCount]);

  // Auto-sync on reconnection
  useEffect(() => {
    if (wasOffline) {
      consumeOfflineFlag();
      sync();
    }
  }, [wasOffline, consumeOfflineFlag, sync]);

  return { sync, isSyncing, isOnline, pendingCount };
}
