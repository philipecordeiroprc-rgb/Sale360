-- Diagnóstico dos alertas da Fun Family
SELECT 'Lotes vencidos (critical):' AS info, COUNT(*) AS total
FROM inventory_batches
WHERE "tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y'
  AND "remainingQty" > 0
  AND "expiryDate" < NOW();

SELECT 'Lotes vencendo 7d (warning):' AS info, COUNT(*) AS total
FROM inventory_batches
WHERE "tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y'
  AND "remainingQty" > 0
  AND "expiryDate" >= NOW()
  AND "expiryDate" <= NOW() + INTERVAL '7 days';

SELECT 'Produtos stock < min (critical):' AS info, COUNT(*) AS total
FROM products
WHERE "tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y'
  AND active = true
  AND "lowStockAt" IS NOT NULL
  AND "lowStockAt" > 0
  AND "stockQty" < "lowStockAt";

SELECT 'Produtos stock = min (warning):' AS info, COUNT(*) AS total
FROM products
WHERE "tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y'
  AND active = true
  AND "lowStockAt" IS NOT NULL
  AND "lowStockAt" > 0
  AND "stockQty" = "lowStockAt";

-- Listar produtos com estoque abaixo do minimo
SELECT p.name, p."stockQty", p."lowStockAt",
  CASE WHEN p."lowStockAt" > 0
    THEN ROUND((p."stockQty"::numeric / p."lowStockAt"::numeric) * 100, 1)
    ELSE NULL
  END AS pct
FROM products p
WHERE p."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y'
  AND p.active = true
  AND p."lowStockAt" IS NOT NULL
  AND p."lowStockAt" > 0
  AND p."stockQty" < p."lowStockAt"
ORDER BY pct;
