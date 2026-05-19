// ============================================================
// Sale360 Mobile — Local SQLite Database (Offline-first)
// ============================================================

import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('sale360_offline.db');

  // Enable WAL mode for performance
  await db.execAsync('PRAGMA journal_mode = WAL;');

  // Create local tables (mirror server schema)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      barcode TEXT,
      price REAL NOT NULL,
      cost_price REAL,
      stock_qty REAL NOT NULL DEFAULT 0,
      unit TEXT DEFAULT 'UN',
      image_url TEXT,
      category_id TEXT,
      category_name TEXT,
      is_fractional INTEGER DEFAULT 0,
      has_variations INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_variations (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price_modifier REAL DEFAULT 0,
      stock_qty REAL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      credit_balance REAL DEFAULT 0,
      document TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS local_orders (
      id TEXT PRIMARY KEY,
      local_id TEXT UNIQUE NOT NULL,
      order_data TEXT NOT NULL, -- JSON
      created_at_device TEXT NOT NULL,
      sync_status TEXT DEFAULT 'pending',
      synced_at TEXT,
      retries INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      payload TEXT NOT NULL,
      created_at_device TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_local_orders_sync ON local_orders(sync_status);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced);
  `);

  return db;
}

// --- Product Operations ---

export async function saveProductsLocally(
  database: SQLite.SQLiteDatabase,
  products: any[],
) {
  const stmt = await database.prepareAsync(
    `INSERT OR REPLACE INTO products
     (id, name, description, barcode, price, cost_price, stock_qty, unit,
      image_url, category_id, category_name,
      is_fractional, has_variations, active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const p of products) {
    await stmt.executeAsync([
      p.id, p.name, p.description || null, p.barcode || null,
      p.price, p.costPrice || null, p.stockQty, p.unit || 'UN',
      p.imageUrl || null, p.category?.id || null,
      p.category?.name || null,
      p.isFractional ? 1 : 0, p.hasVariations ? 1 : 0,
      p.active ? 1 : 0, p.updatedAt || new Date().toISOString(),
    ]);

    // Save variations
    if (p.variations?.length) {
      for (const v of p.variations) {
        await database.runAsync(
          `INSERT OR REPLACE INTO product_variations
           (id, product_id, name, price_modifier, stock_qty)
           VALUES (?, ?, ?, ?, ?)`,
          [v.id, p.id, v.name, v.priceModifier, v.stockQty],
        );
      }
    }
  }

  await stmt.finalizeAsync();
}

export async function searchLocalProducts(
  database: SQLite.SQLiteDatabase,
  search: string,
  categoryId?: string | null,
): Promise<any[]> {
  let query = `SELECT * FROM products WHERE active = 1`;
  const params: any[] = [];

  if (search) {
    query += ` AND (name LIKE ? OR barcode LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  if (categoryId) {
    query += ` AND category_id = ?`;
    params.push(categoryId);
  }

  query += ` ORDER BY name ASC LIMIT 100`;
  return database.getAllAsync(query, params);
}

export async function getLocalProductByBarcode(
  database: SQLite.SQLiteDatabase,
  barcode: string,
): Promise<any | null> {
  const result = await database.getFirstAsync(
    `SELECT p.*, pv.id as var_id, pv.name as var_name, pv.price_modifier as var_price_mod
     FROM products p
     LEFT JOIN product_variations pv ON pv.product_id = p.id
     WHERE p.barcode = ? OR pv.barcode = ?
     LIMIT 1`,
    [barcode, barcode],
  );
  return result || null;
}

// --- Customer Operations ---

export async function saveCustomersLocally(
  database: SQLite.SQLiteDatabase,
  customers: any[],
) {
  const stmt = await database.prepareAsync(
    `INSERT OR REPLACE INTO customers
     (id, name, phone, email, credit_balance, document, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const c of customers) {
    await stmt.executeAsync([
      c.id, c.name, c.phone || null, c.email || null,
      c.creditBalance || 0, c.document || null,
      c.updatedAt || new Date().toISOString(),
    ]);
  }

  await stmt.finalizeAsync();
}

export async function searchLocalCustomers(
  database: SQLite.SQLiteDatabase,
  search: string,
): Promise<any[]> {
  return database.getAllAsync(
    `SELECT * FROM customers
     WHERE name LIKE ? OR phone LIKE ?
     ORDER BY name ASC LIMIT 50`,
    [`%${search}%`, `%${search}%`],
  );
}

// --- Offline Order Storage ---

export async function saveLocalOrder(
  database: SQLite.SQLiteDatabase,
  localId: string,
  orderData: any,
) {
  await database.runAsync(
    `INSERT INTO local_orders (id, local_id, order_data, created_at_device, sync_status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [localId, localId, JSON.stringify(orderData), new Date().toISOString()],
  );
}

export async function getPendingOrders(
  database: SQLite.SQLiteDatabase,
): Promise<any[]> {
  return database.getAllAsync(
    `SELECT * FROM local_orders WHERE sync_status = 'pending'
     ORDER BY created_at_device ASC`,
  );
}

export async function markOrderSynced(
  database: SQLite.SQLiteDatabase,
  localId: string,
) {
  await database.runAsync(
    `UPDATE local_orders SET sync_status = 'synced', synced_at = ?
     WHERE local_id = ?`,
    [new Date().toISOString(), localId],
  );
}

// --- Sync Queue ---

export async function addToSyncQueue(
  database: SQLite.SQLiteDatabase,
  operation: string,
  entity: string,
  entityId: string | null,
  payload: any,
) {
  await database.runAsync(
    `INSERT INTO sync_queue (operation, entity, entity_id, payload, created_at_device)
     VALUES (?, ?, ?, ?, ?)`,
    [operation, entity, entityId, JSON.stringify(payload), new Date().toISOString()],
  );
}

export async function getPendingSyncItems(
  database: SQLite.SQLiteDatabase,
): Promise<any[]> {
  return database.getAllAsync(
    `SELECT * FROM sync_queue WHERE synced = 0 ORDER BY id ASC`,
  );
}

export async function markSyncItemDone(
  database: SQLite.SQLiteDatabase,
  id: number,
) {
  await database.runAsync(
    `UPDATE sync_queue SET synced = 1 WHERE id = ?`,
    [id],
  );
}

// --- Categories ---

export async function saveCategoriesLocally(
  database: SQLite.SQLiteDatabase,
  categories: any[],
) {
  const stmt = await database.prepareAsync(
    `INSERT OR REPLACE INTO categories (id, name, color, sort_order)
     VALUES (?, ?, ?, ?)`,
  );

  for (const c of categories) {
    await stmt.executeAsync([c.id, c.name, c.color || null, c.sortOrder || 0]);
  }

  await stmt.finalizeAsync();
}

export async function getLocalCategories(
  database: SQLite.SQLiteDatabase,
): Promise<any[]> {
  return database.getAllAsync(`SELECT * FROM categories ORDER BY sort_order ASC`);
}
