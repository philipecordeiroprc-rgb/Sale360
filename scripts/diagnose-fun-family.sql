-- Diagnóstico: purchaseItems sem variationId na Fun Family
SELECT
  pi.id AS purchase_item_id,
  pi."productName" AS purchase_product_name,
  pi."productId",
  pi."variationId" AS current_variation_id,
  pi.quantity,
  p.name AS product_name,
  pu."orderNumber" AS purchase_number,
  pu.status AS purchase_status
FROM purchase_items pi
JOIN purchases pu ON pu.id = pi."purchaseId"
JOIN products p ON p.id = pi."productId"
WHERE pi."variationId" IS NULL
  AND pi."productName" LIKE '% - %'
  AND pu."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y'
ORDER BY pu."orderNumber", pi."productName";

-- Diagnóstico: variações duplicadas (com/sem "/") na Fun Family
SELECT
  p.id AS product_id,
  p.name AS product_name,
  v1.id AS var_id_space,
  v1.name AS var_name_space,
  v1."stockQty" AS stock_space,
  v2.id AS var_id_slash,
  v2.name AS var_name_slash,
  v2."stockQty" AS stock_slash
FROM product_variations v1
JOIN products p ON p.id = v1."productId"
JOIN product_variations v2 ON v2."productId" = p.id
  AND v2.name = regexp_replace(v1.name, ' ', ' / ')
WHERE v1.name LIKE '% %'
  AND v1.name NOT LIKE '% / %'
  AND v2.name != v1.name
  AND p."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y'
ORDER BY p.name, v1.name;
