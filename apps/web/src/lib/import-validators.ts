// ============================================================
// Sale360 — Import Validators (client-side)
// ============================================================
import type { ZodObject, ZodRawShape } from 'zod';
import type { ParsedRow, ImportType } from './import-types';
import {
  variationTemplateRowSchema,
  categoryRowSchema,
  supplierRowSchema,
  productSimpleRowSchema,
  productVariationRowSchema,
  purchaseRowSchema,
} from '@sale360/core';

/**
 * Clean Excel text-formula wrapper from CSV values.
 * Excel uses ="value" syntax to force text format (prevents scientific notation on barcodes).
 * This strips the wrapper, returning the raw inner value.
 */
export function cleanExcelValue(value: string): string {
  if (!value) return value;
  const trimmed = value.trim();
  if (trimmed.startsWith('="') && trimmed.endsWith('"')) {
    return trimmed.slice(2, -1);
  }
  return value;
}

/**
 * Clean all values in a parsed CSV row (handles Excel ="value" format and whitespace).
 */
export function cleanRowValues(row: Record<string, string>): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    cleaned[key] = cleanExcelValue(value);
  }
  return cleaned;
}

/** Convert Brazilian decimal string (25,90) to float (25.90) */
export function parseBrazilianDecimal(value: string): number {
  if (!value || value.trim() === '') return 0;
  const cleaned = value.trim().replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/** Convert "SIM"/"NÃO"/"" to boolean */
export function parseYesNo(value: string, defaultValue = true): boolean {
  if (!value || value.trim() === '') return defaultValue;
  const upper = value.trim().toUpperCase();
  return upper === 'SIM' || upper === 'S' || upper === 'YES' || upper === 'Y' || upper === 'TRUE';
}

/** Map import type to its Zod schema (fixed column validation only) */
function getSchemaForType(type: ImportType): ZodObject<ZodRawShape> | null {
  switch (type) {
    case 'variationTemplates': return variationTemplateRowSchema;
    case 'categories': return categoryRowSchema;
    case 'suppliers': return supplierRowSchema;
    case 'products': return productSimpleRowSchema;
    case 'productsVariations': return productVariationRowSchema;
    case 'purchases': return purchaseRowSchema;
    default: return null;
  }
}

/** Validate CSV rows against the appropriate schema */
export function validateRows(
  rows: Record<string, string>[],
  schema: ZodObject<ZodRawShape>,
): ParsedRow[] {
  return rows.map((row, index) => {
    // Clean Excel text-format wrappers (="value") before validation
    const cleaned = cleanRowValues(row);
    const result = schema.safeParse(cleaned);
    if (result.success) {
      return { index, data: cleaned, valid: true, errors: [] };
    }
    const fieldErrors = result.error.flatten().fieldErrors;
    const errors: { column: string; message: string }[] = [];
    for (const [column, messages] of Object.entries(fieldErrors)) {
      if (messages && Array.isArray(messages)) {
        for (const msg of messages) {
          errors.push({ column, message: msg });
        }
      }
    }
    return { index, data: cleaned, valid: false, errors };
  });
}

/** Validate CSV rows by import type */
export function validateImportRows(
  rows: Record<string, string>[],
  type: ImportType,
): ParsedRow[] {
  const schema = getSchemaForType(type);
  if (!schema) {
    return rows.map((row, index) => ({ index, data: row, valid: true, errors: [] }));
  }
  return validateRows(rows, schema);
}
