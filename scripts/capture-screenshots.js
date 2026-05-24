const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'https://sale360.jvp.app';
const EMAIL = 'philipecordeiroprc@gmail.com';
const PASSWORD = 'admin123';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'manual', 'screenshots');

async function screenshot(page, name) {
  await page.waitForTimeout(1500);
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
  // 3. SELECT "Dali da Roça" STORE
  // ========================================
  console.log('🏪 Selecting Dali da Roça...');
  // Store cards are <button> elements containing the company name
  const storeBtn = page.locator('button').filter({ hasText: 'Dali da Roça' }).first();
  if (await storeBtn.count() > 0) {
    await storeBtn.click();
    // switchTenant makes API call then router.push('/dashboard')
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.waitForTimeout(2000);
    console.log('✅ Store selected → dashboard');
  } else {
    console.log('⚠️ Dali da Roça not found, trying first store button');
    // Try any button with a Store icon inside
    const anyStoreBtn = page.locator('button:has(svg.lucide-store)').first();
    if (await anyStoreBtn.count() > 0) {
      await anyStoreBtn.click();
      await page.waitForURL('**/dashboard', { timeout: 20000 });
      await page.waitForTimeout(2000);
      console.log('✅ Store selected');
    } else {
      console.log('❌ No store buttons found!');
      // Debug: print page content
      console.log('Page URL:', page.url());
      const text = await page.locator('body').innerText();
      console.log('Page text:', text.slice(0, 300));
    }
  }

  // ========================================
  // 4. ALL PDV PAGES
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
    console.log(`📸 ${label} (${url})`);
    try {
      await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle', timeout: 20000 });
      await screenshot(page, `${name}.png`);
    } catch (e) {
      console.log(`   ⚠️ ${e.message?.slice(0, 80)}`);
      try { await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`) }); } catch {}
    }
  }

  // ========================================
  // 5. PRODUCT DETAIL PAGE
  // ========================================
  console.log('📸 Product detail with variations...');
  try {
    await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);
    // Try to find and click product row to expand
    const productRow = page.locator('tr, [role="row"]').nth(1); // first data row
    if (await productRow.count() > 0) {
      await productRow.click();
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05b_product_detail.png') });
    console.log('   ✅ 05b_product_detail.png');
  } catch (e) {
    console.log(`   ⚠️ Product detail: ${e.message?.slice(0, 60)}`);
  }

  // ========================================
  // 6. INVENTORY WITH BATCHES EXPANDED
  // ========================================
  console.log('📸 Inventory batches...');
  try {
    await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);
    // Try clicking any expand/chevron button
    const expandBtn = page.locator('tr button, td button, [aria-expanded]').first();
    if (await expandBtn.count() > 0) {
      await expandBtn.click();
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06b_inventory_batches.png') });
    console.log('   ✅ 06b_inventory_batches.png');
  } catch (e) {
    console.log(`   ⚠️ Inventory batches: ${e.message?.slice(0, 60)}`);
  }

  // ========================================
  // 7. POS / NEW SALE PAGE
  // ========================================
  console.log('📸 POS / New sale...');
  try {
    await page.goto(`${BASE_URL}/orders`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);
    const novaVendaBtn = page.locator('button, a', { hasText: /Nova Venda|Novo Pedido|PDV/i });
    if (await novaVendaBtn.count() > 0) {
      await novaVendaBtn.first().click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04b_new_sale_modal.png') });
      console.log('   ✅ 04b_new_sale_modal.png');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      // Try POS page directly
      await page.goto(`${BASE_URL}/pos`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04b_pos_page.png') });
      console.log('   ✅ 04b_pos_page.png');
    }
  } catch (e) {
    console.log(`   ⚠️ New sale: ${e.message?.slice(0, 60)}`);
  }

  // ========================================
  // 8. ADMIN PANEL
  // ========================================
  console.log('📸 Admin panel...');
  try {
    await page.goto(`${BASE_URL}/select-store`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);

    const adminBtn = page.locator('button', { hasText: /Administrar Plataforma/i }).first();
    if (await adminBtn.count() > 0) {
      await adminBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_admin_tenants.png') });
      console.log('   ✅ 14_admin_tenants.png');
    } else {
      console.log('   ⚠️ Admin button not found');
    }

    await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15_admin_users.png') });
    console.log('   ✅ 15_admin_users.png');

    await page.goto(`${BASE_URL}/admin/subscriptions`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15b_admin_subscriptions.png') });
    console.log('   ✅ 15b_admin_subscriptions.png');
  } catch (e) {
    console.log(`   ⚠️ Admin: ${e.message?.slice(0, 60)}`);
  }

  // ========================================
  // 9. PUBLIC CATALOG (Dali da Roça)
  // ========================================
  console.log('📸 Public catalog...');
  try {
    await page.goto(`${BASE_URL}/c/dali-da-roca`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);
    await screenshot(page, '16_catalog.png');

    // Mobile viewport
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
