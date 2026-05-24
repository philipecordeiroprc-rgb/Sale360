const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'https://sale360.jvp.app';
const EMAIL = 'philipecordeiroprc@gmail.com';
const PASSWORD = 'admin123';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'manual', 'screenshots');

async function screenshot(page, name) {
  await page.waitForTimeout(1200); // Let UI settle
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, name),
    fullPage: false,
  });
  console.log(`   ✅ ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // ========================================
  // 1. LOGIN PAGE
  // ========================================
  console.log('🔑 Login page...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await screenshot(page, '01_login.png');

  // Fill and submit login
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/select-store', { timeout: 15000 });
  await page.waitForTimeout(1000);
  console.log('✅ Logged in → select-store');

  // ========================================
  // 2. SELECT STORE PAGE
  // ========================================
  await screenshot(page, '02_select_store.png');

  // ========================================
  // 3. SELECT A STORE (click first store card)
  // ========================================
  console.log('🏪 Selecting store...');
  // Click the first store link/card (not the admin button)
  const storeLink = page.locator('a[href*="/dashboard"]').first();
  const storeCard = page.locator('a').filter({ hasText: /Dali da Roça|Fun Family/i }).first();

  if (await storeCard.count() > 0) {
    await storeCard.click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.waitForTimeout(1500);
    console.log('✅ Store selected → dashboard');
  } else {
    // fallback: try navigating directly with store cookie
    console.log('⚠️ No store card found, trying direct navigation');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);
  }

  // ========================================
  // 4. PDV PAGES (inside store)
  // ========================================
  const pdvPages = [
    { name: '03_dashboard', url: '/dashboard', label: 'Dashboard' },
    { name: '04_orders', url: '/orders', label: 'Vendas' },
    { name: '05_products', url: '/products', label: 'Produtos' },
    { name: '06_inventory', url: '/inventory', label: 'Estoque' },
    { name: '07_purchases', url: '/purchases', label: 'Compras' },
    { name: '08_suppliers', url: '/suppliers', label: 'Fornecedores' },
    { name: '09_customers', url: '/customers', label: 'Clientes' },
    { name: '10_coupons', url: '/coupons', label: 'Cupons' },
    { name: '11_finance', url: '/finance', label: 'Financeiro' },
    { name: '12_indicators', url: '/indicadores', label: 'Indicadores' },
    { name: '13_settings', url: '/settings', label: 'Configurações' },
  ];

  for (const { name, url, label } of pdvPages) {
    console.log(`📸 ${label}`);
    try {
      await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle', timeout: 20000 });
      await screenshot(page, `${name}.png`);
    } catch (e) {
      console.log(`   ⚠️ ${e.message?.slice(0, 80)}`);
    }
  }

  // ========================================
  // 5. PRODUCT DETAIL (expand variations)
  // ========================================
  console.log('📸 Product detail with variations...');
  try {
    await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);
    // Click first expand/collapse button or product row
    const expandBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    const anyRow = page.locator('tr, [role="row"]').first();
    if (await anyRow.count() > 0) {
      await anyRow.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05b_product_detail.png') });
      console.log('   ✅ 05b_product_detail.png');
    }
  } catch (e) {
    console.log(`   ⚠️ Product detail: ${e.message?.slice(0, 60)}`);
  }

  // ========================================
  // 6. INVENTORY BATCHES (expand)
  // ========================================
  console.log('📸 Inventory batches...');
  try {
    await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);
    // Try to expand any expandable row
    const anyBtn = page.locator('tr button, td button').first();
    if (await anyBtn.count() > 0) {
      await anyBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06b_inventory_batches.png') });
      console.log('   ✅ 06b_inventory_batches.png');
    }
  } catch (e) {
    console.log(`   ⚠️ Inventory batches: ${e.message?.slice(0, 60)}`);
  }

  // ========================================
  // 7. NEW SALE MODAL
  // ========================================
  console.log('📸 New sale modal...');
  try {
    await page.goto(`${BASE_URL}/orders`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);
    const novaVendaBtn = page.locator('button, a', { hasText: /Nova Venda|PDV/i });
    if (await novaVendaBtn.count() > 0) {
      await novaVendaBtn.first().click();
      await page.waitForTimeout(1200);
      await screenshot(page, '04b_new_sale_modal.png');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      // Try the PDV/pos page
      await page.goto(`${BASE_URL}/pos`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1500);
      await screenshot(page, '04b_pos_page.png');
    }
  } catch (e) {
    console.log(`   ⚠️ New sale: ${e.message?.slice(0, 60)}`);
  }

  // ========================================
  // 8. ADMIN PANEL (go back to select-store, click admin)
  // ========================================
  console.log('📸 Admin panel...');
  try {
    // Go to select-store, click "Administrar Plataforma"
    await page.goto(`${BASE_URL}/select-store`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);

    const adminBtn = page.locator('a, button', { hasText: /Administrar Plataforma/i });
    if (await adminBtn.count() > 0) {
      await adminBtn.first().click();
      await page.waitForTimeout(2000);
      await screenshot(page, '14_admin_tenants.png');
    }

    // Admin users page
    await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);
    await screenshot(page, '15_admin_users.png');

    // Admin plans/subscriptions page
    await page.goto(`${BASE_URL}/admin/subscriptions`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);
    await screenshot(page, '15b_admin_subscriptions.png');
  } catch (e) {
    console.log(`   ⚠️ Admin: ${e.message?.slice(0, 60)}`);
  }

  // ========================================
  // 9. PUBLIC CATALOG
  // ========================================
  console.log('📸 Public catalog...');
  try {
    await page.goto(`${BASE_URL}/c/dali-da-roca`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);
    await screenshot(page, '16_catalog.png');

    // Also capture catalog on mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/c/dali-da-roca`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);
    await screenshot(page, '16b_catalog_mobile.png');
  } catch (e) {
    console.log(`   ⚠️ Catalog: ${e.message?.slice(0, 60)}`);
  }

  await browser.close();
  console.log('\n🏁 All screenshots captured!');
})();
