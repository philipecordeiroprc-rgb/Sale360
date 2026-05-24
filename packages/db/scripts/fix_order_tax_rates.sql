-- ============================================================================
-- fix_order_tax_rates.sql
-- Corrige taxRate dos OrderItems antigos que ficaram com 0/NULL
-- por causa do bug de mismatch de idioma nos métodos de pagamento.
--
-- Contexto: O web frontend enviava paymentMethod em português
-- (Credito, Debito, Dinheiro, Pix, Fiado) mas a API buscava no
-- PaymentMethodConfig usando esses valores sem normalizar.
-- A tabela PaymentMethodConfig armazena chaves em inglês
-- (credit, debit, cash, pix, credit_store).
--
-- Rode este script UMA VEZ no banco de produção.
-- ============================================================================

BEGIN;

-- Preview: quantos itens serão afetados (descomente para verificar antes)
-- SELECT COUNT(*) AS affected_items
-- FROM order_items oi
-- JOIN orders o ON o.id = oi."orderId"
-- WHERE (oi."taxRate" IS NULL OR oi."taxRate" = 0)
--   AND oi."productId" IS NOT NULL
--   AND o."paymentMethod" IS NOT NULL
--   AND o.status != 'CANCELLED';

-- Update: corrige taxRate nos OrderItems
UPDATE order_items oi
SET "taxRate" = pmc."taxRate"
FROM orders o
JOIN "PaymentMethodConfig" pmc
  ON pmc."tenantId" = o."tenantId"
  AND pmc."paymentMethod" = CASE o."paymentMethod"
    WHEN 'Dinheiro' THEN 'cash'
    WHEN 'Pix' THEN 'pix'
    WHEN 'Debito' THEN 'debit'
    WHEN 'Credito' THEN 'credit'
    WHEN 'Fiado' THEN 'credit_store'
    ELSE o."paymentMethod"  -- mobile já envia em inglês, mantém como está
  END
WHERE oi."orderId" = o.id
  AND (oi."taxRate" IS NULL OR oi."taxRate" = 0)
  AND oi."productId" IS NOT NULL
  AND o."paymentMethod" IS NOT NULL
  AND o.status != 'CANCELLED';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO PÓS-CORREÇÃO
-- ════════════════════════════════════════════════════════════════════════════

-- Itens que ainda estão sem taxa (devem ser zero se tudo correu bem)
SELECT COUNT(*) AS remaining_zero_tax
FROM order_items oi
JOIN orders o ON o.id = oi."orderId"
WHERE (oi."taxRate" IS NULL OR oi."taxRate" = 0)
  AND oi."productId" IS NOT NULL
  AND o."paymentMethod" IS NOT NULL
  AND o.status != 'CANCELLED';

-- Resumo por método de pagamento (para conferir)
SELECT
  o."paymentMethod",
  COUNT(DISTINCT o.id) AS total_orders,
  ROUND(AVG(oi."taxRate"::numeric), 2) AS avg_tax_rate,
  SUM(oi.total::numeric) AS total_sales,
  SUM(oi.total::numeric * (oi."taxRate"::numeric / 100)) AS total_tax_loss
FROM order_items oi
JOIN orders o ON o.id = oi."orderId"
WHERE oi."productId" IS NOT NULL
  AND o.status != 'CANCELLED'
  AND o."paymentMethod" IS NOT NULL
GROUP BY o."paymentMethod"
ORDER BY total_sales DESC;
