import { Banknote, CreditCard, User } from 'lucide-react';

// Portuguese UI labels → English DB codes
export const PAYMENT_METHOD_NORMALIZE: Record<string, string> = {
  Dinheiro: 'cash',
  Pix: 'pix',
  Debito: 'debit',
  Credito: 'credit',
  Fiado: 'credit_store',
};

// English DB codes → Portuguese labels
const LABEL_MAP: Record<string, string> = {
  credit_store: 'Fiado',
  cash: 'Dinheiro',
  pix: 'Pix',
  credit: 'Crédito',
  debit: 'Débito',
  Dinheiro: 'Dinheiro',
  Pix: 'Pix',
  Debito: 'Débito',
  Credito: 'Crédito',
  Fiado: 'Fiado',
};

export function paymentLabel(method: string | null | undefined): string {
  return LABEL_MAP[method || ''] || method || '—';
}

export function isFiado(method: string | null | undefined): boolean {
  return method === 'credit_store' || method === 'Fiado';
}

// All payment methods for PDV (includes Fiado)
export const PAYMENT_METHODS = [
  { id: 'Dinheiro', label: 'Dinheiro', icon: Banknote, color: 'bg-emerald-500' },
  { id: 'Pix', label: 'Pix', icon: CreditCard, color: 'bg-cyan-500' },
  { id: 'Debito', label: 'Débito', icon: CreditCard, color: 'bg-blue-500' },
  { id: 'Credito', label: 'Crédito', icon: CreditCard, color: 'bg-purple-500' },
  { id: 'Fiado', label: 'Fiado', icon: User, color: 'bg-amber-500', paymentStatus: 'PENDING' },
] as const;

// Payment methods for catalog confirmation (no Fiado)
export const CONFIRM_PAYMENT_METHODS = [
  { id: 'Dinheiro', label: 'Dinheiro', icon: Banknote, color: 'bg-emerald-500' },
  { id: 'Pix', label: 'Pix', icon: CreditCard, color: 'bg-cyan-500' },
  { id: 'Debito', label: 'Débito', icon: CreditCard, color: 'bg-blue-500' },
  { id: 'Credito', label: 'Crédito', icon: CreditCard, color: 'bg-purple-500' },
] as const;

export interface PaymentLine {
  methodId: string;
  amount: number;
}
