-- ============================================================
-- Normalização de nomes de variação: espaço → " / "
-- ============================================================
-- Contexto: Variações criadas pelo NewProductPurchaseWizard
-- e CSV import usavam espaço como separador entre dimensões.
-- Os demais caminhos usam " / ". Este script unifica tudo.
-- ============================================================

BEGIN;

-- 1. PREVIEW: quantas variações serão afetadas
SELECT 'Serão corrigidas:' AS info, COUNT(*) AS total
FROM product_variations
WHERE name LIKE '% %'
  AND name NOT LIKE '% / %'
  AND "productId" IN (
    SELECT p.id
    FROM products p
    JOIN categories c ON c.id = p."categoryId"
    JOIN variation_templates vt ON vt.id = c."variationTemplateId"
    JOIN variation_dimensions vd ON vd."templateId" = vt.id
    GROUP BY p.id
    HAVING COUNT(DISTINCT vd.id) >= 2
  );

-- 2. Listar as variações que serão alteradas (review antes de aplicar)
SELECT
  v.id,
  v.name AS nome_atual,
  regexp_replace(v.name, ' ', ' / ') AS novo_nome,
  p.name AS produto
FROM product_variations v
JOIN products p ON p.id = v."productId"
WHERE v.name LIKE '% %'
  AND v.name NOT LIKE '% / %'
  AND v."productId" IN (
    SELECT p2.id
    FROM products p2
    JOIN categories c ON c.id = p2."categoryId"
    JOIN variation_templates vt ON vt.id = c."variationTemplateId"
    JOIN variation_dimensions vd ON vd."templateId" = vt.id
    GROUP BY p2.id
    HAVING COUNT(DISTINCT vd.id) >= 2
  )
ORDER BY p.name, v.name;

-- 3. APLICAR correção
-- ATENÇÃO: Verifique a lista acima antes de commitar.
-- Se houver valores de dimensão com espaços naturais (ex: "Extra Grande"),
-- pode ocorrer falso-positivo. Nesse caso, corrija manualmente.
UPDATE product_variations
SET name = regexp_replace(name, ' ', ' / ')
WHERE name LIKE '% %'
  AND name NOT LIKE '% / %'
  AND "productId" IN (
    SELECT p.id
    FROM products p
    JOIN categories c ON c.id = p."categoryId"
    JOIN variation_templates vt ON vt.id = c."variationTemplateId"
    JOIN variation_dimensions vd ON vd."templateId" = vt.id
    GROUP BY p.id
    HAVING COUNT(DISTINCT vd.id) >= 2
  );

-- 4. Verificar resultado
SELECT 'Após correção - variações com espaço (sem /):' AS info, COUNT(*) AS total
FROM product_variations
WHERE name LIKE '% %'
  AND name NOT LIKE '% / %'
  AND "productId" IN (
    SELECT p.id
    FROM products p
    JOIN categories c ON c.id = p."categoryId"
    JOIN variation_templates vt ON vt.id = c."variationTemplateId"
    JOIN variation_dimensions vd ON vd."templateId" = vt.id
    GROUP BY p.id
    HAVING COUNT(DISTINCT vd.id) >= 2
  );

-- ROLLBACK;  -- Descomente esta linha se quiser desfazer
COMMIT;
