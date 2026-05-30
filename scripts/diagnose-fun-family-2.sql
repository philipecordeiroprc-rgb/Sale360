-- Ver compra #11 e seus items
SELECT
  pu."orderNumber",
  pu.status,
  pu."createdAt",
  pi.id AS item_id,
  pi."productName",
  pi."variationId",
  pi.quantity,
  pv.name AS variation_name,
  pv."stockQty" AS var_stock
FROM purchases pu
JOIN purchase_items pi ON pi."purchaseId" = pu.id
JOIN products p ON p.id = pi."productId"
LEFT JOIN product_variations pv ON pv.id = pi."variationId"
WHERE pu."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y'
  AND pu."orderNumber" = 11
ORDER BY pi."productName";

-- Ver batches/movements ligados à compra #11
SELECT
  ib.id AS batch_id,
  ib."productId",
  ib."variationId",
  pv.name AS var_name,
  ib.quantity,
  ib."remainingQty"
FROM inventory_batches ib
LEFT JOIN product_variations pv ON pv.id = ib."variationId"
WHERE ib."purchaseItemId" IN (
  SELECT pi.id FROM purchase_items pi
  JOIN purchases pu ON pu.id = pi."purchaseId"
  WHERE pu."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y'
    AND pu."orderNumber" = 11
);

-- Ver se há movimentos de inventário relacionados
SELECT
  im.id,
  im.type,
  im."variationId",
  pv.name AS var_name,
  im.quantity,
  im."purchaseId"
FROM inventory_movements im
LEFT JOIN product_variations pv ON pv.id = im."variationId"
WHERE im."purchaseId" IN (
  SELECT id FROM purchases pu
  WHERE pu."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y'
    AND pu."orderNumber" = 11
);
