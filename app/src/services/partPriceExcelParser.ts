import * as XLSX from 'xlsx';

export type ParsedPartPriceRow = {
  source_row: number;
  part_no: string;
  part_no_normalized: string;
  description: string | null;
  dnp: number | null;
  rtl: number | null;
  mrp: number | null;
  hsn: string | null;
  gst: number | null;
  cat1: string | null;
  cat2: string | null;
};

export type PartPriceValidationIssue = {
  row: number;
  partNo: string;
  message: string;
};

export type ParsedPartPriceFile = {
  totalRows: number;
  validRows: ParsedPartPriceRow[];
  invalidRows: number;
  duplicateRows: number;
  issues: PartPriceValidationIssue[];
};

const REQUIRED_HEADERS = ['Material', 'Description', 'DNP', 'RTL', 'MRP', 'HSN', 'GST', 'Cat 1', 'Cat 2'];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

export function normalizePartNumber(value: unknown) {
  return clean(value).replace(/\s+/g, '').toUpperCase();
}

function readColumn(row: Record<string, unknown>, aliases: string[]) {
  const wanted = aliases.map(normalizeHeader);
  const key = Object.keys(row).find((item) => wanted.includes(normalizeHeader(item)));
  return key ? row[key] : '';
}

function parseNullableNumber(value: unknown) {
  const raw = clean(value).replace(/₹/g, '').replace(/,/g, '').replace(/%/g, '');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function parsePartPriceExcel(file: File): Promise<ParsedPartPriceFile> {
  const workbook = XLSX.read(await file.arrayBuffer());
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('The workbook does not contain any sheets.');

  const sheet = workbook.Sheets[firstSheetName];
  const headerRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, range: 0, blankrows: false, defval: '' });
  const header = (headerRows[0] ?? []).map((value) => clean(value));
  const normalizedHeaders = new Set(header.map(normalizeHeader));
  const missingHeaders = REQUIRED_HEADERS.filter((name) => !normalizedHeaders.has(normalizeHeader(name)));
  if (missingHeaders.length) {
    throw new Error(`Price list is missing required column(s): ${missingHeaders.join(', ')}.`);
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
  const validRows: ParsedPartPriceRow[] = [];
  const issues: PartPriceValidationIssue[] = [];
  const seen = new Map<string, number>();
  let duplicateRows = 0;

  rawRows.forEach((row, index) => {
    const sourceRow = index + 2;
    const sourcePartNo = clean(readColumn(row, ['Material', 'Part No', 'PartNo']));
    const partNo = normalizePartNumber(sourcePartNo);
    const description = clean(readColumn(row, ['Description'])) || null;
    const dnp = parseNullableNumber(readColumn(row, ['DNP']));
    const rtl = parseNullableNumber(readColumn(row, ['RTL']));
    const mrp = parseNullableNumber(readColumn(row, ['MRP']));
    const hsn = clean(readColumn(row, ['HSN'])) || null;
    const gstRaw = readColumn(row, ['GST']);
    const gst = parseNullableNumber(gstRaw);
    const cat1 = clean(readColumn(row, ['Cat 1', 'Cat1'])) || null;
    const cat2 = clean(readColumn(row, ['Cat 2', 'Cat2'])) || null;

    if (!partNo) {
      issues.push({ row: sourceRow, partNo: sourcePartNo, message: 'Material / Part Number is blank.' });
      return;
    }

    if (dnp === null || rtl === null || mrp === null) {
      issues.push({ row: sourceRow, partNo, message: 'DNP, RTL and MRP must contain valid numeric values.' });
      return;
    }

    if (gstRaw !== '' && gst === null) {
      issues.push({ row: sourceRow, partNo, message: 'GST must be numeric when provided.' });
      return;
    }

    const previousRow = seen.get(partNo);
    if (previousRow) {
      duplicateRows += 1;
      issues.push({ row: sourceRow, partNo, message: `Duplicate normalized part number. First occurrence is row ${previousRow}.` });
      return;
    }
    seen.set(partNo, sourceRow);

    validRows.push({
      source_row: sourceRow,
      part_no: partNo,
      part_no_normalized: partNo,
      description,
      dnp,
      rtl,
      mrp,
      hsn,
      gst,
      cat1,
      cat2,
    });
  });

  return {
    totalRows: rawRows.length,
    validRows,
    invalidRows: issues.length - duplicateRows,
    duplicateRows,
    issues,
  };
}
