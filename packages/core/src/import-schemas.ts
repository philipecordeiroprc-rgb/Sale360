// ============================================================
// Sale360 — Import Schemas (shared Zod validation)
// ============================================================
import { z } from 'zod';

// --- CSV Row Schemas (matches template columns) ---

export const variationTemplateRowSchema = z.object({
  'Nome do Template': z.string().min(1, 'Nome do template é obrigatório'),
  'Dim 1 - Tipo': z.enum(['TAMANHO_LETRA', 'TAMANHO_NUMERO', 'COR', 'VOLUME', 'PESO', 'PERSONALIZADO'], {
    errorMap: () => ({ message: 'Tipo inválido. Use: TAMANHO_LETRA, TAMANHO_NUMERO, COR, VOLUME, PESO, PERSONALIZADO' }),
  }),
  'Dim 1 - Rótulo': z.string().min(1, 'Rótulo da Dim 1 é obrigatório'),
  'Dim 1 - Opções': z.string().min(1, 'Opções da Dim 1 são obrigatórias'),
  'Dim 2 - Tipo': z.string().optional(),
  'Dim 2 - Rótulo': z.string().optional(),
  'Dim 2 - Opções': z.string().optional(),
});

export const categoryRowSchema = z.object({
  Nome: z.string().min(1, 'Nome é obrigatório'),
  'Cor (hex)': z.string().optional(),
  Ordem: z.string().optional(),
  'Template de Variação': z.string().optional(),
});

export const supplierRowSchema = z.object({
  Nome: z.string().min(1, 'Nome é obrigatório'),
  CNPJ: z.string().optional(),
  IE: z.string().optional(),
  Email: z.string().optional(),
  Telefone: z.string().optional(),
  WhatsApp: z.string().optional(),
  Contato: z.string().optional(),
  Endereço: z.string().optional(),
  Número: z.string().optional(),
  Complemento: z.string().optional(),
  Bairro: z.string().optional(),
  Cidade: z.string().optional(),
  Estado: z.string().optional(),
  CEP: z.string().optional(),
  Observações: z.string().optional(),
  Ativo: z.string().optional(),
});

export const productSimpleRowSchema = z.object({
  Nome: z.string().min(1, 'Nome é obrigatório'),
  Descrição: z.string().optional(),
  SKU: z.string().optional(),
  'Código de Barras': z.string().optional(),
  Categoria: z.string().optional(),
  'Preço de Venda': z.string().min(1, 'Preço de Venda é obrigatório'),
  'Custo Unitário': z.string().optional(),
  'Custo Operacional': z.string().optional(),
  'Taxa (%)': z.string().optional(),
  'Estoque Inicial': z.string().optional(),
  'Estoque Mínimo': z.string().optional(),
  Unidade: z.string().optional(),
  Ativo: z.string().optional(),
  Fracionado: z.string().optional(),
});

export const productVariationRowSchema = z.object({
  'Nome do Produto': z.string().min(1, 'Nome do Produto é obrigatório'),
  Categoria: z.string().optional(),
  'Preço Base': z.string().min(1, 'Preço Base é obrigatório'),
  Qtd: z.string().min(1, 'Qtd é obrigatória'),
  'Preço Extra': z.string().optional(),
  SKU: z.string().optional(),
  'Código de Barras': z.string().optional(),
  'Estoque Mínimo': z.string().optional(),
});

export const purchaseRowSchema = z.object({
  'Nº Pedido': z.string().min(1, 'Nº Pedido é obrigatório'),
  Fornecedor: z.string().min(1, 'Fornecedor é obrigatório'),
  Produto: z.string().min(1, 'Produto é obrigatório'),
  Variação: z.string().optional(),
  Quantidade: z.string().min(1, 'Quantidade é obrigatória'),
  'Custo Unitário': z.string().min(1, 'Custo Unitário é obrigatório'),
  'Preço de Venda': z.string().optional(),
  'Data Recebimento': z.string().min(1, 'Data de Recebimento é obrigatória'),
  Status: z.string().optional(),
  Observação: z.string().optional(),
});

// --- API Request Schemas ---

export const importRequestSchema = z.object({
  rows: z.array(z.record(z.string(), z.string())).min(1, 'Nenhuma linha para importar'),
  mode: z.enum(['simple', 'variations']).optional(),
  dim1Label: z.string().optional(),
  dim2Label: z.string().optional(),
});

// --- Import Result Types ---

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportResult {
  imported: number;
  errors: ImportError[];
  warnings: string[];
}
