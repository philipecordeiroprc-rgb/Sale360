// Cleanup script for Dali da Roça tenant — remove all test data
const { PrismaClient } = require('../packages/db/generated');
const p = new PrismaClient();
const TENANT = 'cmpcsv29u0000kd30i9w2arj4';

async function cleanup() {
  console.log('Iniciando limpeza da loja Dali da Roca...\n');

  // 1. Leaf tables (no dependents)
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

  // 5. Variation dimensions + templates (imported during tests)
  await p.$executeRaw`DELETE FROM variation_dimensions WHERE "templateId" IN (SELECT id FROM variation_templates WHERE "tenantId" = ${TENANT})`;
  console.log('OK VariationDimensions');

  await p.$executeRaw`DELETE FROM variation_templates WHERE "tenantId" = ${TENANT}`;
  console.log('OK VariationTemplates');

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
  `;

  console.log('\nVerificacao pos-limpeza:');
  counts.forEach(r => console.log('  ' + r.t.padEnd(25) + ': ' + r.c));

  // Verify kept data
  const kept = await p.$queryRaw`
    SELECT 'users' as t, count(*)::int as c FROM tenant_users WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'catalog_settings', count(*)::int FROM catalog_settings WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'payment_methods', count(*)::int FROM payment_method_configs WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'devices', count(*)::int FROM devices WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'integrations', count(*)::int FROM integrations WHERE "tenantId" = ${TENANT}
    UNION ALL SELECT 'variation_templates', count(*)::int FROM variation_templates WHERE "tenantId" = ${TENANT}
  `;
  console.log('\nDados mantidos:');
  kept.forEach(r => console.log('  ' + r.t.padEnd(25) + ': ' + r.c));

  console.log('\nLimpaza concluida com sucesso!');
}

cleanup()
  .catch(e => { console.error('ERRO:', e.message); process.exit(1); })
  .finally(() => p.$disconnect());
