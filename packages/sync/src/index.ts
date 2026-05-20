// ============================================================
// Sale360 Sync Engine — Offline-first client
// ============================================================

export interface SyncConfig {
  apiUrl: string;
  tenantId: string;
  deviceId: string;
  token: string;
}

export interface SyncState {
  lastSyncAt: string | null;
  isSyncing: boolean;
  pendingCount: number;
  lastError: string | null;
}

export interface PushChange {
  entity: 'orders' | 'customers';
  operation: 'create' | 'update' | 'delete';
  localId: string;
  data: Record<string, unknown>;
  createdAtDevice: string;
}

export interface PullResult {
  serverTime: string;
  products: any[];
  customers: any[];
  orders: any[];
  stock: { id: string; stockQty: number; updatedAt: string }[];
}

export interface PushResult {
  success: boolean;
  results: {
    orders: { localId: string; serverId: string; orderNumber: number }[];
    customers: { operation: string; id: string }[];
    conflicts: { localId: string; serverId: string; reason: string }[];
  };
  serverTime: string;
}

export class SyncEngine {
  private config: SyncConfig;
  private state: SyncState;
  private localDB: any; // SQLite / WatermelonDB adapter

  constructor(config: SyncConfig) {
    this.config = config;
    this.state = {
      lastSyncAt: null,
      isSyncing: false,
      pendingCount: 0,
      lastError: null,
    };
  }

  setLocalDB(db: any) {
    this.localDB = db;
  }

  getState(): SyncState {
    return { ...this.state };
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.token}`,
    };
  }

  // PULL: Download changes from server
  async pull(): Promise<PullResult | null> {
    if (this.state.isSyncing) return null;
    this.state.isSyncing = true;
    this.state.lastError = null;

    try {
      const params = new URLSearchParams({
        deviceId: this.config.deviceId,
      });
      if (this.state.lastSyncAt) {
        params.set('lastSyncAt', this.state.lastSyncAt);
      }

      const response = await fetch(
        `${this.config.apiUrl}/api/sync/pull?${params.toString()}`,
        { headers: this.headers },
      );

      if (!response.ok) {
        throw new Error(`Sync pull failed: ${response.status}`);
      }

      const data: PullResult = await response.json();
      this.state.lastSyncAt = data.serverTime;
      this.state.lastError = null;

      return data;
    } catch (err: any) {
      this.state.lastError = err.message;
      return null;
    } finally {
      this.state.isSyncing = false;
    }
  }

  // PUSH: Send local changes to server
  async push(changes: PushChange[]): Promise<PushResult | null> {
    if (this.state.isSyncing) return null;
    this.state.isSyncing = true;
    this.state.lastError = null;

    const ordersChanges = changes
      .filter((c) => c.entity === 'orders')
      .map((c) => ({ localId: c.localId, data: c.data, createdAtDevice: c.createdAtDevice }));

    const customersChanges = changes
      .filter((c) => c.entity === 'customers')
      .map((c) => ({
        localId: c.localId,
        operation: c.operation,
        data: c.data,
      }));

    try {
      const response = await fetch(`${this.config.apiUrl}/api/sync/push`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          deviceId: this.config.deviceId,
          changes: {
            orders: ordersChanges,
            customers: customersChanges,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Sync push failed: ${response.status}`);
      }

      const data: PushResult = await response.json();
      this.state.lastSyncAt = data.serverTime;
      this.state.pendingCount = Math.max(0, this.state.pendingCount - changes.length);
      this.state.lastError = null;

      return data;
    } catch (err: any) {
      this.state.lastError = err.message;
      return null;
    } finally {
      this.state.isSyncing = false;
    }
  }

  // Resolve sync conflict
  async resolveConflict(localId: string, resolution: 'use_server' | 'use_local', localData?: any) {
    const response = await fetch(`${this.config.apiUrl}/api/sync/resolve-conflict`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ localId, resolution, localData }),
    });

    if (!response.ok) {
      throw new Error(`Conflict resolution failed: ${response.status}`);
    }

    return response.json();
  }

  // Auto sync: pull then push
  async sync(pendingChanges: PushChange[]): Promise<{ pull: PullResult | null; push: PushResult | null }> {
    const pull = await this.pull();
    let push: PushResult | null = null;
    if (pendingChanges.length > 0) {
      push = await this.push(pendingChanges);
    }
    return { pull, push };
  }

  reset() {
    this.state = {
      lastSyncAt: null,
      isSyncing: false,
      pendingCount: 0,
      lastError: null,
    };
  }
}

// Factory
export function createSyncEngine(config: SyncConfig): SyncEngine {
  return new SyncEngine(config);
}
