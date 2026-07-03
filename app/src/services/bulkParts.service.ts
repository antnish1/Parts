import * as XLSX from 'xlsx';
import { normalizePartNo } from '../lib/orderLogic';
import type { TestPart } from './testPart.service';

export type BulkPartResult = {
  rows: Array<{ partNo: string; qty: number; description: string; dnp: string }>;
  success: number;
  failed: number;
  merged: number;
};

export async function parseBulkPartsFile(file: File, hasHeader: boolean, parts: TestPart[]): Promise<BulkPartResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Array<string | number>>(sheet, { header: 1, defval: '' });
  const sourceRows = hasHeader ? rawRows.slice(1) : rawRows;
  const merged = new Map<string, number>();
  let failed = 0;

  sourceRows.forEach((row) => {
    const partNo = normalizePartNo(String(row[0] ?? ''));
    const qty = Number(row[1] ?? 0);
    if (!partNo || !Number.isFinite(qty) || qty <= 0) {
      failed += 1;
      return;
    }
    merged.set(partNo, (merged.get(partNo) ?? 0) + qty);
  });

  const rows: BulkPartResult['rows'] = [];
  merged.forEach((qty, partNo) => {
    const master = parts.find((part) => normalizePartNo(part.part_no) === partNo);
    if (!master || !Number.isInteger(qty)) {
      failed += 1;
      return;
    }
    rows.push({
      partNo,
      qty,
      description: master.description ?? '',
      dnp: master.dnp != null ? String(master.dnp) : '0',
    });
  });

  return { rows, success: rows.length, failed, merged: sourceRows.length - merged.size };
}
