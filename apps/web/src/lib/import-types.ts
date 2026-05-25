// ============================================================
// Sale360 — Import Types (frontend)
// ============================================================

export type ImportType = 'variationTemplates' | 'categories' | 'suppliers' | 'products' | 'productsVariations' | 'purchases';

export interface ImportConfig {
  type: ImportType;
  title: string;
  endpoint: string;
  templateFilename: string;
  templateLabel: string;
  sequenceNumber: number;
  dependencies: ImportType[];
  expectedColumns: string[];
  description: string;
  longDescription: string;
}

export interface ParsedRow {
  index: number;
  data: Record<string, string>;
  valid: boolean;
  errors: { column: string; message: string }[];
}

export interface ImportPreview {
  rows: ParsedRow[];
  totalRows: number;
  validRows: number;
  errorRows: number;
}

export interface ImportResult {
  imported: number;
  errors: { row: number; message: string }[];
  warnings: string[];
}
