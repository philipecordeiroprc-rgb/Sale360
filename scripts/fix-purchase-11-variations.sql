-- ============================================================
-- Correção de dados: Compra #11 e variações duplicadas
-- ============================================================
-- Contexto: Compras criadas antes da normalização dos nomes de
-- variação (espaço → " / ") podem ter sido recebidas SEM
-- variationId nos purchaseItems. Ao dar entrada no estoque,
-- o backend não encontrava a variação correta (agora com "/")
-- e criava uma nova duplicada sem "/".
-- ============================================================

BEGIN;

-- 1. DIAGNÓSTICO: Identificar purchaseItems sem variationId
--    cujo productName referencia variação com espaço (não "/")
SELECT '=== DIAGNÓSTICO: Itens afetados ===' AS info;

SELECT
  pi.id AS purchase_item_id,
  pi."productName" AS purchase_product_name,
  pi."productId",
  pi."variationId" AS current_variation_id,
  pi.quantity,
  p.name AS product_name,
  p."orderNumber" AS purchase_number,
  pu.status AS purchase_status
FROM purchase_items pi
JOIN purchases pu ON pu.id = pi."purchaseId"
JOIN products p ON p.id = pi."productId"
WHERE pi."variationId" IS NULL
  AND pi."productName" LIKE '% - %'
ORDER BY pu."orderNumber", pi."productName";

-- 2. DIAGNÓSTICO: Variações duplicadas (mesmo produto, nomes com/sem "/")
SELECT '=== DIAGNÓSTICO: Variações potencialmente duplicadas ===' AS info;

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
ORDER BY p.name, v1.name;

-- 3. CORREÇÃO: Vincular purchaseItems à variação correta (com "/")
--    Para cada purchaseItem sem variationId, tentar achar a variação
--    com nome normalizado (espaço → " / ") e atualizar o vínculo.
--    ATENÇÃO: Execute o diagnóstico (passo 1 e 2) antes, revise os
--    resultados, e só então execute este UPDATE.

-- Extrair o nome da variação do productName e tentar a versão normalizada
UPDATE purchase_items pi
SET "variationId" = v_slash.id
FROM purchases pu,
     products p,
     product_variations v_slash
WHERE pi."purchaseId" = pu.id
  AND pi."productId" = p.id
  AND v_slash."productId" = p.id
  AND pi."variationId" IS NULL
  AND pi."productName" LIKE '% - %'
  -- Extrai parte da variação do productName (após " - ")
  AND v_slash.name = regexp_replace(
        split_part(pi."productName", ' - ', 2),
        ' ', ' / '
      )
  -- Garante que a variação normalizada existe e é diferente
  AND v_slash.name != split_part(pi."productName", ' - ', 2);

-- Verifica quantos foram corrigidos
SELECT 'Itens corrigidos (vinculados à variação correta):' AS info,
       COUNT(*) AS total
FROM purchase_items pi
WHERE pi."variationId" IS NOT NULL
  AND pi."productName" LIKE '% - %';

-- 4. CORREÇÃO: Migrar InventoryBatches da variação errada para a correta
--    Isso é necessário se a compra já foi recebida (RECEIVED)
--    e os batches foram criados na variação sem "/".

-- Primeiro, diagnosticar batches em variações sem "/" que têm equivalente com "/"
SELECT '=== DIAGNÓSTICO: Batches em variações sem "/" ===' AS info;

SELECT
  ib.id AS batch_id,
  ib."productId",
  ib."variationId" AS wrong_var_id,
  v_wrong.name AS wrong_var_name,
  ib.quantity,
  ib."remainingQty",
  v_correct.id AS correct_var_id,
  v_correct.name AS correct_var_name
FROM inventory_batches ib
JOIN product_variations v_wrong ON v_wrong.id = ib."variationId"
JOIN products p ON p.id = ib."productId"
JOIN product_variations v_correct ON v_correct."productId" = p.id
  AND v_correct.name = regexp_replace(v_wrong.name, ' ', ' / ')
WHERE v_wrong.name LIKE '% %'
  AND v_wrong.name NOT LIKE '% / %'
  AND v_correct.name != v_wrong.name;

-- Corrigir os batches: apontar para a variação correta
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
  AND v_correct.name != v_wrong.name;

-- 5. CORREÇÃO: Migrar InventoryMovements da variação errada para a correta
SELECT '=== DIAGNÓSTICO: Movements em variações sem "/" ===' AS info;

SELECT
  im.id AS movement_id,
  im.type,
  im.quantity,
  im."variationId" AS wrong_var_id,
  v_wrong.name AS wrong_var_name,
  v_correct.id AS correct_var_id,
  v_correct.name AS correct_var_name
FROM inventory_movements im
JOIN product_variations v_wrong ON v_wrong.id = im."variationId"
JOIN products p ON p.id = im."productId"
JOIN product_variations v_correct ON v_correct."productId" = p.id
  AND v_correct.name = regexp_replace(v_wrong.name, ' ', ' / ')
WHERE v_wrong.name LIKE '% %'
  AND v_wrong.name NOT LIKE '% / %'
  AND v_correct.name != v_wrong.name;

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
  AND v_correct.name != v_wrong.name;

-- 6. CORREÇÃO: Transferir stock das variações erradas para as corretas
--    e zerar stock das variações erradas
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
  AND v_wrong."stockQty" > 0;

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
  );

-- 7. CORREÇÃO: Atualizar productName nos purchaseItems para refletir
--    o nome da variação com "/"
UPDATE purchase_items pi
SET "productName" = p.name || ' - ' || pv.name
FROM products p, product_variations pv
WHERE pi."productId" = p.id
  AND pi."variationId" = pv.id
  AND pi."productName" LIKE '% - %'
  AND pi."productName" != (p.name || ' - ' || pv.name);

-- 8. LIMPEZA: Remover variações duplicadas (sem "/") que ficaram com stock 0
--    e sem batches/movements restantes
DELETE FROM product_variations
WHERE "stockQty" = 0
  AND name LIKE '% %'
  AND name NOT LIKE '% / %'
  AND id NOT IN (
    SELECT DISTINCT "variationId" FROM inventory_batches WHERE "variationId" IS NOT NULL
  )
  AND id NOT IN (
    SELECT DISTINCT "variationId" FROM inventory_movements WHERE "variationId" IS NOT NULL
  )
  AND id NOT IN (
    SELECT DISTINCT "variationId" FROM purchase_items WHERE "variationId" IS NOT NULL
  );

-- 9. VERIFICAÇÃO FINAL
SELECT '=== VERIFICAÇÃO FINAL ===' AS info;

SELECT 'Variações duplicadas restantes:' AS info, COUNT(*) AS total
FROM product_variations v1
JOIN products p ON p.id = v1."productId"
JOIN product_variations v2 ON v2."productId" = p.id
  AND v2.name = regexp_replace(v1.name, ' ', ' / ')
WHERE v1.name LIKE '% %'
  AND v1.name NOT LIKE '% / %'
  AND v2.name != v1.name;

SELECT 'PurchaseItems sem variationId:' AS info, COUNT(*) AS total
FROM purchase_items
WHERE "variationId" IS NULL
  AND "productName" LIKE '% - %';

-- ROLLBACK;  -- Descomente para desfazer
COMMIT;
