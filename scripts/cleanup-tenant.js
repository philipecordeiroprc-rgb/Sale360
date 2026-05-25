#!/usr/bin/env node
// ============================================================
// Sale360 — Script de Limpeza de Dados por Tenant
// Uso: node scripts/cleanup-tenant.js <slug>
// Ex:  node scripts/cleanup-tenant.js dali-da-roca
// ============================================================

const { PrismaClient } = require('../packages/db/generated');
const p = new PrismaClient();

const slug = process.argv[2];
if (!slug) {
  console.error('Uso: node scripts/cleanup-tenant.js <slug>');
  console.error('Ex:  node scripts/cleanup-tenant.js dali-da-roca');
  process.exit(1);
}

async function cleanup() {
  // Find tenant
  const tenants = await p.$queryRaw`SELECT id, slug, "companyName" FROM tenants WHERE slug = ${slug}`;
  if (tenants.length === 0) {
    console.error('Tenant não encontrado: ' + slug);
    process.exit(1);
  }
  const tenant = tenants[0];
  console.log(`Tenant: ${tenant.companyName} (${tenant.id})`);
  console.log('ATENÇÃO: Isso vai apagar TODOS os dados de vendas, produtos, estoque, clientes, fornecedores, compras e cupons.');
  console.log('Usuários e configurações do catálogo serão MANTIDOS.\n');

  // Wait 3 seconds for user to cancel
  console.log('Iniciando em 3 segundos... (Ctrl+C para cancelar)');
  await new Promise(r => setTimeout(r, 3000));

  const TENANT = tenant.id;

  console.log('\n--- Removendo dados... ---\n');

  // 1. Leaf tables (dependent tables first)
  await p.$executeRaw`DELETE FROM credit_transactions WHERE "customerId" IN (SELECT id FROM customers WHERE "tenantId" = ${TENANT})`;
  console.log('OK CreditTransactions');

  await p.$executeRaw`DELETE FROM commission_items WHERE "tenantId" = ${TENANT}`;
  console.log('OK CommissionItems');

  await p.$executeRaw`DELETE FROM order_items WHERE "orderId" IN (SELECT id FROM orders WHERE "tenantId" = ${TENANT})`;
  console.log('OK OrderItems');

  await p.$executeRaw`DELETE FROM deliveries WHERE "orderId" IN (SELECT id FROM orders WHERE "tenantId" = ${TENANT})`;
  console.log('OK Deliveries');

  await p.$executeRaw`DELETE FROM command_items WHERE "commandId" IN (SELECT id FROM table_commands WHERE "tenantId" = ${TENANT})`;
  console.log('OK CommandItems');

  await p.$executeRaw`DELETE FROM coupon_products WHERE "couponId" IN (SELECT id FROM coupons WHERE "tenantId" = ${TENANT})`;
  console.log('OK CouponProducts');

  await p.$executeRaw`DELETE FROM coupon_categories WHERE "couponId" IN (SELECT id FROM coupons WHERE "tenantId" = ${TENANT})`;
  console.log('OK CouponCategories');

  await p.$executeRaw`DELETE FROM purchase_items WHERE "purchaseId" IN (SELECT id FROM purchases WHERE "tenantId" = ${TENANT})`;
  console.log('OK PurchaseItems');

  await p.$executeRaw`DELETE FROM inventory_movements WHERE "tenantId" = ${TENANT}`;
  console.log('OK InventoryMovements');

  await p.$executeRaw`DELETE FROM inventory_batches WHERE "tenantId" = ${TENANT}`;
  console.log('OK InventoryBatches');

  // 2. Parent tables
  await p.$executeRaw`DELETE FROM orders WHERE "tenantId" = ${TENANT}`;
  console.log('OK Orders (vendas)');

  await p.$executeRaw`DELETE FROM table_commands WHERE "tenantId" = ${TENANT}`;
  console.log('OK TableCommands (comandas)');

  await p.$executeRaw`DELETE FROM coupons WHERE "tenantId" = ${TENANT}`;
  console.log('OK Coupons (cupons)');

  await p.$executeRaw`DELETE FROM purchases WHERE "tenantId" = ${TENANT}`;
  console.log('OK Purchases (compras)');

  await p.$executeRaw`DELETE FROM cash_flows WHERE "tenantId" = ${TENANT}`;
  console.log('OK CashFlows');

  // 3. Customer / Supplier
  await p.$executeRaw`DELETE FROM customers WHERE "tenantId" = ${TENANT}`;
  console.log('OK Customers (clientes)');

  await p.$executeRaw`DELETE FROM suppliers WHERE "tenantId" = ${TENANT}`;
  console.log('OK Suppliers (fornecedores)');

  // 4. Product variations + products + categories
  await p.$executeRaw`DELETE FROM product_variations WHERE "productId" IN (SELECT id FROM products WHERE "tenantId" = ${TENANT})`;
  console.log('OK ProductVariations');

  await p.$executeRaw`DELETE FROM products WHERE "tenantId" = ${TENANT}`;
  console.log('OK Products (produtos)');

  await p.$executeRaw`DELETE FROM categories WHERE "tenantId" = ${TENANT}`;
  console.log('OK Categories');

  // 5. Verify
  const counts = await p.$queryRaw`
    SELECT 'orders' as t, count(*)::int as c FROM orders WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'products', count(*)::int FROM products WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'categories', count(*)::int FROM categories WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'customers', count(*)::int FROM customers WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'suppliers', count(*)::int FROM suppliers WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'coupons', count(*)::int FROM coupons WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'purchases', count(*)::int FROM purchases WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'inventory_batches', count(*)::int FROM inventory_batches WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'cash_flows', count(*)::int FROM cash_flows WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'inventory_movements', count(*)::int FROM inventory_movements WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'product_variations', count(*)::int FROM product_variations WHERE "productId" IN (SELECT id FROM products WHERE "tenantId" = ${TENANT})
    UNION ALL SELECT 'order_items', count(*)::int FROM order_items WHERE "orderId" IN (SELECT id FROM orders WHERE "tenantId" = ${TENANT})
    UNION ALL SELECT 'table_commands', count(*)::int FROM table_commands WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'command_items', count(*)::int FROM command_items WHERE "commandId" IN (SELECT id FROM table_commands WHERE "tenantId" = ${TENANT})
    UNION ALL SELECT 'coupon_products', count(*)::int FROM coupon_products WHERE "couponId" IN (SELECT id FROM coupons WHERE "tenantId" = ${TENANT})
    UNION ALL SELECT 'purchase_items', count(*)::int FROM purchase_items WHERE "purchaseId" IN (SELECT id FROM purchases WHERE "tenantId" = ${TENANT})
    UNION ALL SELECT 'credit_transactions', count(*)::int FROM credit_transactions WHERE "customerId" IN (SELECT id FROM customers WHERE "tenantId" = ${TENANT})
    UNION ALL SELECT 'deliveries', count(*)::int FROM deliveries WHERE "orderId" IN (SELECT id FROM orders WHERE "tenantId" = ${TENANT})
    UNION ALL SELECT 'commission_items', count(*)::int FROM commission_items WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'coupon_categories', count(*)::int FROM coupon_categories WHERE "couponId" IN (SELECT id FROM coupons WHERE "tenantId" = ${TENANT})
    UNION ALL SELECT 'payment_method_configs', count(*)::int FROM payment_method_configs WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'catalog_settings', count(*)::int FROM catalog_settings WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'tenant_users', count(*)::int FROM tenant_users WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'variation_templates', count(*)::int FROM variation_templates WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'devices', count(*)::int FROM devices WHERE "tenantId" = ${TENANT}
  `;

  console.log('\n--- Resumo Final ---');
  console.log('APAGADOS (devem estar 0):');
  const deleted = ['orders','products','categories','customers','suppliers','coupons','purchases',
    'inventory_batches','cash_flows','inventory_movements','product_variations','order_items',
    'table_commands','command_items','coupon_products','purchase_items','credit_transactions',
    'deliveries','commission_items','coupon_categories'];
  deleted.forEach(name => {
    const r = counts.find((c: any) => c.t === name);
    const status = r && r.c === 0 ? 'OK' : 'ERRO';
    console.log(`  ${status === 'OK' ? '✅' : '❌'} ${name.padEnd(25)}: ${r ? r.c : '?'}`);
  });

  console.log('\nMANTIDOS:');
  const kept = ['tenant_users','catalog_settings','payment_method_configs','devices','variation_templates'];
  kept.forEach(name => {
    const r = counts.find((c: any) => c.t === name);
    console.log(`  🔒 ${name.padEnd(25)}: ${r ? r.c : '?'}`);
  });

  console.log('\n🎉 Limpeza concluída!');
}

cleanup()
  .catch(e => { console.error('❌', e.message); process.exit(1); })
  .finally(() => p.$disconnect());
