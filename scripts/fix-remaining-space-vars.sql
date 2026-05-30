-- Corrigir variações com espaço restantes que não tinham equivalente com "/"
-- Tenant: Fun Family
BEGIN;

-- Diagnóstico: variações com espaço que sobraram
SELECT 'Antes: variações com espaço restantes' AS info;
SELECT pv.id, pv.name, pv."stockQty", p.name AS product_name
FROM product_variations pv
JOIN products p ON p.id = pv."productId"
WHERE pv.name LIKE '% %'
  AND pv.name NOT LIKE '% / %'
  AND p."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y'
ORDER BY p.name, pv.name;

-- Renomear: substituir espaço por " / " para padronizar
UPDATE product_variations pv
SET name = regexp_replace(pv.name, ' ', ' / ')
FROM products p
WHERE pv."productId" = p.id
  AND pv.name LIKE '% %'
  AND pv.name NOT LIKE '% / %'
  AND p."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y';

-- Atualizar productName nos purchaseItems para refletir novo nome
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

-- Verificação final
SELECT 'Depois: variações com espaço restantes' AS info;
SELECT COUNT(*) AS total
FROM product_variations pv
JOIN products p ON p.id = pv."productId"
WHERE pv.name LIKE '% %'
  AND pv.name NOT LIKE '% / %'
  AND p."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y';

-- Status final do CONJUNTO HEXA
SELECT pv.name AS variation, pv."stockQty" AS stock
FROM product_variations pv
JOIN products p ON p.id = pv."productId"
WHERE p."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y'
  AND p.name = 'CONJUNTO HEXA'
ORDER BY pv.name;

SELECT p.name, p."stockQty" AS total_stock
FROM products p
WHERE p."tenantId" = 'cmpbh7yfp0000uylo0bdk6o7y'
  AND p.name = 'CONJUNTO HEXA';

COMMIT;
