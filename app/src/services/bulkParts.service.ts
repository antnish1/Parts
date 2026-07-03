import * as XLSX from 'xlsx';
import { normalizePartNo } from '../lib/orderLogic';
import type { TestPart } from './testPart.service';

export type BulkPartResult = {
  rows: Array<{ partNo: string; qty: number; description: string; dnp: string; isUnknown?: boolean }>;
  success: number;
  failed: number;
  merged: number;
  unknown: number;
  unknownParts: string[];
};

function normalizeHeader(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function findHeaderIndex(headers: Array<string | number>, names: string[]) {
  const normalized = headers.map(normalizeHeader);
  return normalized.findIndex((header) => names.includes(header));
}

function getColumnIndexes(rawRows: Array<Array<string | number>>, hasHeader: boolean) {
  if (!hasHeader || rawRows.length === 0) return { partIndex: 0, qtyIndex: 1 };
  const headers = rawRows[0] ?? [];
  const partIndex = findHeaderIndex(headers, ['materialno', 'materialnumber', 'partno', 'partnumber', 'itemcode', 'itemno']);
  const qtyIndex = findHeaderIndex(headers, ['billedqty', 'billedquantity', 'qty', 'quantity', 'orderqty', 'orderedqty']);
  return {
    partIndex: partIndex >= 0 ? partIndex : 0,
    qtyIndex: qtyIndex >= 0 ? qtyIndex : 1,
  };
}

export async function parseBulkPartsFile(file: File, hasHeader: boolean, parts: TestPart[]): Promise<BulkPartResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Array<string | number>>(sheet, { header: 1, defval: '' });
  const { partIndex, qtyIndex } = getColumnIndexes(rawRows, hasHeader);
  const sourceRows = hasHeader ? rawRows.slice(1) : rawRows;
  const merged = new Map<string, number>();
  let failed = 0;

  sourceRows.forEach((row) => {
    const partNo = normalizePartNo(String(row[partIndex] ?? ''));
    const qty = Number(row[qtyIndex] ?? 0);
    if (!partNo || !Number.isFinite(qty) || qty <= 0) {
      failed += 1;
      return;
    }
    merged.set(partNo, (merged.get(partNo) ?? 0) + qty);
  });

  const rows: BulkPartResult['rows'] = [];
  const unknownParts: string[] = [];
  merged.forEach((qty, partNo) => {
    if (!Number.isInteger(qty)) {
      failed += 1;
      return;
    }
    const master = parts.find((part) => normalizePartNo(part.part_no) === partNo);
    if (!master) unknownParts.push(partNo);
    rows.push({
      partNo,
      qty,
      description: master?.description || `Part ${partNo} - not found in master`,
      dnp: master?.dnp != null ? String(master.dnp) : '0',
      isUnknown: !master,
    });
  });

  return { rows, success: rows.length, failed, merged: sourceRows.length - merged.size - failed, unknown: unknownParts.length, unknownParts };
}
