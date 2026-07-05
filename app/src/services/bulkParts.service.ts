import * as XLSX from 'xlsx';
import { normalizePartNo } from '../lib/orderLogic';
import { lookupTestPartsByNos, type TestPart } from './testPart.service';

export type BulkPartResult = {
  rows: Array<{ partNo: string; qty: number; description: string; dnp: string; isUnknown?: boolean }>;
  success: number;
  failed: number;
  merged: number;
  unknown: number;
  unknownParts: string[];
  detectedPartColumn: number;
  detectedQtyColumn: number;
  totalSourceRows: number;
};

const PART_HEADERS = ['materialno', 'materialnumber', 'partno', 'partnumber', 'itemcode', 'itemno', 'material'];
const QTY_HEADERS = ['billedqty', 'billedquantity', 'qty', 'quantity', 'orderqty', 'orderedqty', 'billqty'];

function normalizeHeader(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function findHeaderIndex(headers: Array<string | number>, names: string[]) {
  const normalized = headers.map(normalizeHeader);
  return normalized.findIndex((header) => names.includes(header));
}

function looksLikePartNo(value: unknown) {
  return /^[A-Z0-9]+\/[A-Z0-9]+$/i.test(String(value ?? '').trim());
}

function parseQty(value: unknown) {
  if (typeof value === 'number') return value;
  const cleaned = String(value ?? '').replace(/,/g, '').trim();
  return Number(cleaned);
}

function getColumnIndexes(rawRows: Array<Array<string | number>>, hasHeader: boolean) {
  const firstRow = rawRows[0] ?? [];
  const headerPartIndex = findHeaderIndex(firstRow, PART_HEADERS);
  const headerQtyIndex = findHeaderIndex(firstRow, QTY_HEADERS);
  if (headerPartIndex >= 0 || headerQtyIndex >= 0) {
    return {
      partIndex: headerPartIndex >= 0 ? headerPartIndex : 0,
      qtyIndex: headerQtyIndex >= 0 ? headerQtyIndex : 1,
      skipFirstRow: true,
    };
  }

  const sampleRows = rawRows.slice(hasHeader ? 1 : 0, Math.min(rawRows.length, 12));
  let bestPartIndex = 0;
  let bestQtyIndex = 1;
  let bestScore = -1;
  for (let partIndex = 0; partIndex < 8; partIndex += 1) {
    for (let qtyIndex = 0; qtyIndex < 8; qtyIndex += 1) {
      if (partIndex === qtyIndex) continue;
      const score = sampleRows.reduce((sum, row) => {
        const partOk = looksLikePartNo(row[partIndex]) ? 1 : 0;
        const qty = parseQty(row[qtyIndex]);
        const qtyOk = Number.isFinite(qty) && qty > 0 ? 1 : 0;
        return sum + partOk + qtyOk;
      }, 0);
      if (score > bestScore) {
        bestScore = score;
        bestPartIndex = partIndex;
        bestQtyIndex = qtyIndex;
      }
    }
  }

  return { partIndex: bestPartIndex, qtyIndex: bestQtyIndex, skipFirstRow: hasHeader };
}

export async function parseBulkPartsFile(file: File, hasHeader: boolean, parts?: TestPart[]): Promise<BulkPartResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Array<string | number>>(sheet, { header: 1, defval: '' });
  const { partIndex, qtyIndex, skipFirstRow } = getColumnIndexes(rawRows, hasHeader);
  const sourceRows = skipFirstRow ? rawRows.slice(1) : rawRows;
  const merged = new Map<string, number>();
  let failed = 0;

  sourceRows.forEach((row) => {
    const partNo = normalizePartNo(String(row[partIndex] ?? ''));
    const qty = parseQty(row[qtyIndex]);
    if (!partNo || !Number.isFinite(qty) || qty <= 0) {
      failed += 1;
      return;
    }
    merged.set(partNo, (merged.get(partNo) ?? 0) + qty);
  });

  const masterParts = parts ?? await lookupTestPartsByNos([...merged.keys()]);
  const masterByPartNo = new Map(masterParts.map((part) => [normalizePartNo(part.part_no), part]));
  const rows: BulkPartResult['rows'] = [];
  const unknownParts: string[] = [];

  merged.forEach((qty, partNo) => {
    if (!Number.isInteger(qty)) {
      failed += 1;
      return;
    }
    const master = masterByPartNo.get(partNo);
    if (!master) unknownParts.push(partNo);
    rows.push({
      partNo,
      qty,
      description: master?.description || `Part ${partNo} - not found in master`,
      dnp: master?.dnp != null ? String(master.dnp) : '0',
      isUnknown: !master,
    });
  });

  return {
    rows,
    success: rows.length,
    failed,
    merged: Math.max(0, sourceRows.length - failed - merged.size),
    unknown: unknownParts.length,
    unknownParts,
    detectedPartColumn: partIndex + 1,
    detectedQtyColumn: qtyIndex + 1,
    totalSourceRows: sourceRows.length,
  };
}
