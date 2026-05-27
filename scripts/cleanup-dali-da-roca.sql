-- ============================================================
-- Limpeza TOTAL da loja Dali da Roca
-- Tenant: cmpcsv29u0000kd30i9w2arj4
-- Mantem: usuarios, tenant_users, catalogos
-- ============================================================
BEGIN;

DO $$
DECLARE
  t_name TEXT;
BEGIN
  SELECT "companyName" INTO t_name FROM tenants WHERE id = 'cmpcsv29u0000kd30i9w2arj4';
  IF t_name IS NULL THEN
    RAISE EXCEPTION 'Tenant nao encontrado';
  END IF;
  RAISE NOTICE 'Limpando tenant: %', t_name;
END $$;

-- 1. Tabelas filhas sem tenantId (precisam ser deletadas antes das pais)
DELETE FROM command_items WHERE "commandId" IN (SELECT id FROM table_commands WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4');
DELETE FROM order_items WHERE "orderId" IN (SELECT id FROM orders WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4');
DELETE FROM coupon_products WHERE "couponId" IN (SELECT id FROM coupons WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4');
DELETE FROM coupon_categories WHERE "couponId" IN (SELECT id FROM coupons WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4');
DELETE FROM credit_transactions WHERE "customerId" IN (SELECT id FROM customers WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4');

-- 2. Tabelas com tenantId (ordem: filhos primeiro, pais depois)
DELETE FROM commission_items WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4';
DELETE FROM deliveries WHERE "orderId" IN (SELECT id FROM orders WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4');
DELETE FROM inventory_movements WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4';
DELETE FROM inventory_batches WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4';

-- Orders & table commands
DELETE FROM orders WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4';
DELETE FROM table_commands WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4';

-- Purchases (purchase_items cascade via FK)
DELETE FROM purchases WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4';

-- Products (product_variations cascade via FK)
DELETE FROM products WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4';

-- Coupons
DELETE FROM coupons WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4';

-- Categories
DELETE FROM categories WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4';

-- Suppliers
DELETE FROM suppliers WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4';

-- Customers
DELETE FROM customers WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4';

-- Variation templates (variation_dimensions cascade via FK)
DELETE FROM variation_templates WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4';

-- Configs
DELETE FROM devices WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4';
DELETE FROM integrations WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4';
DELETE FROM payment_method_configs WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4';
DELETE FROM cash_flows WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4';

-- 3. Verificacao final
SELECT 'ORDERS' as item, count(*) as remaining FROM orders WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4'
UNION ALL SELECT 'products', count(*) FROM products WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4'
UNION ALL SELECT 'purchases', count(*) FROM purchases WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4'
UNION ALL SELECT 'inventory_batches', count(*) FROM inventory_batches WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4'
UNION ALL SELECT 'inventory_movements', count(*) FROM inventory_movements WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4'
UNION ALL SELECT 'categories', count(*) FROM categories WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4'
UNION ALL SELECT 'suppliers', count(*) FROM suppliers WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4'
UNION ALL SELECT 'customers', count(*) FROM customers WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4'
UNION ALL SELECT 'coupons', count(*) FROM coupons WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4'
UNION ALL SELECT 'devices', count(*) FROM devices WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4'
UNION ALL SELECT 'variation_templates', count(*) FROM variation_templates WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4'
UNION ALL SELECT 'cash_flows', count(*) FROM cash_flows WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4'
UNION ALL SELECT 'TENANT_USERS (KEPT)', count(*) FROM tenant_users WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4'
UNION ALL SELECT 'CATALOG_SETTINGS (KEPT)', count(*) FROM catalog_settings WHERE "tenantId" = 'cmpcsv29u0000kd30i9w2arj4';

COMMIT;

-- Verificar que outras lojas estao intactas
SELECT t."companyName", count(o.id) as orders
FROM tenants t
LEFT JOIN orders o ON o."tenantId" = t.id
WHERE t.id != 'cmpcsv29u0000kd30i9w2arj4'
GROUP BY t.id, t."companyName";
