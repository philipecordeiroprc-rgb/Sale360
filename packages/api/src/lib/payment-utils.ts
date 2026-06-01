import { z } from 'zod';

// Portuguese UI labels → English DB codes
export const PAYMENT_METHOD_NORMALIZE: Record<string, string> = {
  Dinheiro: 'cash',
  Pix: 'pix',
  Debito: 'debit',
  'Débito': 'debit',
  Credito: 'credit',
  'Crédito': 'credit',
  Fiado: 'credit_store',
  'Voucher Refeição': 'meal_voucher',
  'Voucher Alimentação': 'food_voucher',
};

// English DB codes → Portuguese labels
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  pix: 'Pix',
  debit: 'Débito',
  credit: 'Crédito',
  credit_store: 'Fiado',
  meal_voucher: 'Voucher Refeição',
  food_voucher: 'Voucher Alimentação',
};

export function normalizePaymentMethod(method: string): string {
  // 1. Exact match in normalize map
  if (PAYMENT_METHOD_NORMALIZE[method]) return PAYMENT_METHOD_NORMALIZE[method];

  // 2. Case-insensitive match against normalize keys
  const lower = method.toLowerCase();
  for (const [key, value] of Object.entries(PAYMENT_METHOD_NORMALIZE)) {
    if (key.toLowerCase() === lower) return value;
  }

  // 3. Check if it's already a valid DB code (lowercase, matches a known label)
  if (PAYMENT_METHOD_LABELS[method]) return method;

  // 4. Case-insensitive match against known DB codes
  for (const code of Object.keys(PAYMENT_METHOD_LABELS)) {
    if (code.toLowerCase() === lower) return code;
  }

  // 5. Fallback: return as-is
  return method;
}

export function paymentLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] || method;
}

// Zod schema for a single payment entry
export const paymentEntrySchema = z.object({
  paymentMethod: z.string().min(1, 'Método de pagamento é obrigatório'),
  amount: z.number().positive('Valor do pagamento deve ser positivo'),
});

export type PaymentEntry = z.infer<typeof paymentEntrySchema>;

// Validate that payment amounts sum to the order total (within 1 cent tolerance)
export function validatePaymentTotal(
  payments: Array<{ amount: number }>,
  total: number,
  tolerance = 0.01,
): boolean {
  const sum = payments.reduce((s, p) => s + p.amount, 0);
  return Math.abs(sum - total) <= tolerance;
}

// Check if any payment in the array is a "fiado" (store credit) method
export function hasFiadoPayment(payments: Array<{ paymentMethod: string }>): boolean {
  return payments.some(p => p.paymentMethod === 'credit_store'
    || p.paymentMethod === 'Fiado');
}

// Calculate weighted average tax rate from split payments
// Each payment method has its own tax rate from PaymentMethodConfig
export async function getWeightedTaxRate(
  tenantId: string,
  payments: Array<{ paymentMethod: string; amount: number }>,
  total: number,
  getTaxRate: (tenantId: string, method: string) => Promise<number>,
): Promise<number> {
  if (payments.length === 0 || total === 0) return 0;

  let weightedRate = 0;
  for (const payment of payments) {
    const rate = await getTaxRate(tenantId, payment.paymentMethod);
    weightedRate += (rate * payment.amount) / total;
  }
  return Math.round(weightedRate * 100) / 100;
}
