const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'https://sale360.jvp.app';
const EMAIL = 'philipecordeiroprc@gmail.com';
const PASSWORD = 'admin123';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'manual', 'screenshots');

const PAGES = [
  { name: '01_login', url: '/login', label: 'Login', group: 'geral' },
  { name: '02_select_store', url: '/select-store', label: 'Selecionar Loja', group: 'geral' },
  { name: '03_dashboard', url: '/dashboard', label: 'Dashboard', group: 'pdv' },
  { name: '04_orders', url: '/orders', label: 'Vendas', group: 'pdv' },
  { name: '05_products', url: '/products', label: 'Produtos', group: 'pdv' },
  { name: '06_inventory', url: '/inventory', label: 'Estoque', group: 'pdv' },
  { name: '07_purchases', url: '/purchases', label: 'Compras', group: 'pdv' },
  { name: '08_suppliers', url: '/suppliers', label: 'Fornecedores', group: 'pdv' },
  { name: '09_customers', url: '/customers', label: 'Clientes', group: 'pdv' },
  { name: '10_coupons', url: '/coupons', label: 'Cupons', group: 'pdv' },
  { name: '11_finance', url: '/finance', label: 'Financeiro', group: 'pdv' },
  { name: '12_indicators', url: '/indicadores', label: 'Indicadores', group: 'pdv' },
  { name: '13_settings', url: '/settings', label: 'Configurações', group: 'pdv' },
  { name: '14_admin_tenants', url: '/admin', label: 'Admin - Lojas', group: 'admin' },
  { name: '15_admin_users', url: '/admin/users', label: 'Admin - Usuários', group: 'admin' },
  { name: '16_catalog', url: '/c/dali-da-roca', label: 'Catálogo Público', group: 'catalog' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // 1. Login
  console.log('🔑 Fazendo login...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/select-store', { timeout: 15000 });
  console.log('✅ Login OK - redirecionado para select-store');

  // 2. Take screenshots
  for (const { name, url, label } of PAGES) {
    console.log(`📸 ${label} (${url})`);
    try {
      await page.goto(`${BASE_URL}${url}`, {
        waitUntil: 'networkidle',
        timeout: 20000,
      });
      await page.waitForTimeout(1500); // Wait for animations
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${name}.png`),
        fullPage: false,
      });
      console.log(`   ✅ ${name}.png`);
    } catch (e) {
      console.log(`   ⚠️ Erro: ${e.message?.slice(0, 80)}`);
      // Take screenshot of whatever is visible even on error
      try {
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${name}.png`),
          fullPage: false,
        });
      } catch {}
    }
  }

  // 3. Vendas - create sale modal (if there's a "Nova Venda" button)
  console.log('📸 Tentando capturar modal de nova venda...');
  try {
    await page.goto(`${BASE_URL}/orders`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);
    const novaVendaBtn = page.locator('button, a', { hasText: /Nova Venda/i });
    if (await novaVendaBtn.count() > 0) {
      await novaVendaBtn.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '04b_new_sale_modal.png'),
        fullPage: false,
      });
      console.log('   ✅ 04b_new_sale_modal.png');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  } catch (e) {
    console.log(`   ⚠️ Modal de venda: ${e.message?.slice(0, 60)}`);
  }

  // 4. Product detail with variations expanded
  console.log('📸 Capturando detalhes de produto...');
  try {
    await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);
    // Try to click on a product row or expand button
    const expandBtn = page.locator('button[aria-label*="expand"], button:has(svg.lucide-chevron-down), tr button').first();
    if (await expandBtn.count() > 0) {
      await expandBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '05b_product_detail.png'),
        fullPage: false,
      });
      console.log('   ✅ 05b_product_detail.png');
    }
  } catch (e) {
    console.log(`   ⚠️ Produto detalhe: ${e.message?.slice(0, 60)}`);
  }

  // 5. Inventory with batches expanded
  console.log('📸 Capturando lotes de estoque...');
  try {
    await page.goto(`${BASE_URL}/inventory`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);
    const expandBtn = page.locator('button:has(svg), tr button').first();
    if (await expandBtn.count() > 0) {
      await expandBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '06b_inventory_batches.png'),
        fullPage: false,
      });
      console.log('   ✅ 06b_inventory_batches.png');
    }
  } catch (e) {
    console.log(`   ⚠️ Lotes estoque: ${e.message?.slice(0, 60)}`);
  }

  // 6. Admin - subscription/plans page
  console.log('📸 Capturando admin planos...');
  try {
    // First go back to admin mode
    await page.goto(`${BASE_URL}/select-store`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1000);
    const adminBtn = page.locator('a, button', { hasText: /Administrar Plataforma/i });
    if (await adminBtn.count() > 0) {
      await adminBtn.first().click();
      await page.waitForURL('**/admin**', { timeout: 10000 });
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '14_admin_tenants.png'),
        fullPage: false,
      });
      console.log('   ✅ 14_admin_tenants.png (atualizado)');
    }
  } catch (e) {
    console.log(`   ⚠️ Admin: ${e.message?.slice(0, 60)}`);
  }

  await browser.close();
  console.log('\n🏁 Screenshots concluídos!');
})();
