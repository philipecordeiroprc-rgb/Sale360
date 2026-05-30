-- ============================================================
-- Correção: Compra #11 - Variações "CONJUNTO HEXA"
-- Tenant: Fun Family (cmpbh7yfp0000uylo0bdk6o7y)
-- ============================================================
-- Problema: Compra #11 usou variações com espaço ("10 Azul")
-- em vez das variações corretas com "/" ("10 / Azul").
-- Causa: stock nas variações erradas, variações corretas vazias.
-- ============================================================

BEGIN;

-- 1. Migrar InventoryBatches: apontar para variação correta (com "/")
UPDATE inventory_batches ib
SET "variationId" = v_correct.id
FROM product_variations v_wrong,
     products p,
     product_variations v_correct
WHERE ib."variationId" = v_wrong.id
  AND v_wrong."productId" = p.id
  AND v_correct."productId" = p.id
  AND v_correct.name = regexp_replace(v_wrong.name, ' ', ' / ')
  AND v_wrong.name LIKE '% %'
  AND v_wrong.name NOT LIKE '% / %'
  AND v_correct.name != v_wrong.name
  AND p."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y';

-- 2. Migrar InventoryMovements: apontar para variação correta (com "/")
UPDATE inventory_movements im
SET "variationId" = v_correct.id
FROM product_variations v_wrong,
     products p,
     product_variations v_correct
WHERE im."variationId" = v_wrong.id
  AND v_wrong."productId" = p.id
  AND v_correct."productId" = p.id
  AND v_correct.name = regexp_replace(v_wrong.name, ' ', ' / ')
  AND v_wrong.name LIKE '% %'
  AND v_wrong.name NOT LIKE '% / %'
  AND v_correct.name != v_wrong.name
  AND p."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y';

-- 3. Transferir stock das variações erradas para as corretas
UPDATE product_variations v_correct
SET "stockQty" = v_correct."stockQty" + v_wrong."stockQty"
FROM product_variations v_wrong,
     products p
WHERE v_wrong."productId" = p.id
  AND v_correct."productId" = p.id
  AND v_correct.name = regexp_replace(v_wrong.name, ' ', ' / ')
  AND v_wrong.name LIKE '% %'
  AND v_wrong.name NOT LIKE '% / %'
  AND v_correct.name != v_wrong.name
  AND v_wrong."stockQty" > 0
  AND p."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y';

-- 4. Atualizar purchaseItems: apontar para variação correta
UPDATE purchase_items pi
SET "variationId" = v_correct.id
FROM purchases pu,
     product_variations v_wrong,
     products p,
     product_variations v_correct
WHERE pi."variationId" = v_wrong.id
  AND pi."purchaseId" = pu.id
  AND v_wrong."productId" = p.id
  AND v_correct."productId" = p.id
  AND v_correct.name = regexp_replace(v_wrong.name, ' ', ' / ')
  AND v_wrong.name LIKE '% %'
  AND v_wrong.name NOT LIKE '% / %'
  AND v_correct.name != v_wrong.name
  AND pu."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y';

-- 5. Atualizar productName nos purchaseItems para refletir nome com "/"
UPDATE purchase_items pi
SET "productName" = p.name || ' - ' || pv.name
FROM purchases pu,
     products p,
     product_variations pv
WHERE pi."productId" = p.id
  AND pi."variationId" = pv.id
  AND pi."purchaseId" = pu.id
  AND pi."productName" LIKE '% - %'
  AND pi."productName" != (p.name || ' - ' || pv.name)
  AND pu."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y';

-- 6. Zerar stock das variações erradas (não devem mais ter stock)
UPDATE product_variations
SET "stockQty" = 0
WHERE name LIKE '% %'
  AND name NOT LIKE '% / %'
  AND id IN (
    SELECT v_wrong.id
    FROM product_variations v_wrong
    JOIN products p ON p.id = v_wrong."productId"
    JOIN product_variations v_correct ON v_correct."productId" = p.id
      AND v_correct.name = regexp_replace(v_wrong.name, ' ', ' / ')
    WHERE v_correct.name != v_wrong.name
      AND p."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y'
  );

-- 7. Atualizar stock do produto (recalcular soma das variações corretas)
UPDATE products p
SET "stockQty" = (
  SELECT COALESCE(SUM(pv."stockQty"), 0)
  FROM product_variations pv
  WHERE pv."productId" = p.id
)
WHERE p."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y'
  AND p."hasVariations" = true;

-- 8. Remover variações duplicadas (sem "/") que ficaram com stock 0
--    e sem referências em batches, movements, ou purchase items
DELETE FROM product_variations
WHERE "stockQty" = 0
  AND name LIKE '% %'
  AND name NOT LIKE '% / %'
  AND "productId" IN (
    SELECT id FROM products WHERE "tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y'
  )
  AND id NOT IN (
    SELECT DISTINCT "variationId" FROM inventory_batches WHERE "variationId" IS NOT NULL
  )
  AND id NOT IN (
    SELECT DISTINCT "variationId" FROM inventory_movements WHERE "variationId" IS NOT NULL
  )
  AND id NOT IN (
    SELECT DISTINCT "variationId" FROM purchase_items WHERE "variationId" IS NOT NULL
  );

-- 9. Verificação final
SELECT '=== VERIFICAÇÃO FINAL ===' AS info;

-- Variações duplicadas restantes
SELECT 'Duplicadas restantes:' AS info, COUNT(*) AS total
FROM product_variations v1
JOIN products p ON p.id = v1."productId"
JOIN product_variations v2 ON v2."productId" = p.id
  AND v2.name = regexp_replace(v1.name, ' ', ' / ')
WHERE v1.name LIKE '% %'
  AND v1.name NOT LIKE '% / %'
  AND v2.name != v1.name
  AND p."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y';

-- Stock final das variações do CONJUNTO HEXA
SELECT
  pv.name AS variation,
  pv."stockQty" AS stock,
  pv.id
FROM product_variations pv
JOIN products p ON p.id = pv."productId"
WHERE p."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y'
  AND p.name = 'CONJUNTO HEXA'
ORDER BY pv.name;

-- Stock total do produto
SELECT p.name, p."stockQty" AS total_stock
FROM products p
WHERE p."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y'
  AND p.name = 'CONJUNTO HEXA';

COMMIT;
