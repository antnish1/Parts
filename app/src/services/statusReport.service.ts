import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { normalizePartNo, toNumber } from '../lib/orderLogic';

export type StatusReportResult = { total: number; updated: number; skipped: number; failed: number; errors: string[] };

type StatusReportRow = {
  finalOrderNo: string;
  partNo: string;
  billedQty: number;
  invoiceNo: string;
  invoiceDate: string | null;
  docketNo: string;
  transportName: string;
};

function cell(row: Record<string, unknown>, names: string[]) {
  const keys = Object.keys(row);
  const key = keys.find((item) => names.some((name) => item.toLowerCase().replace(/\s|_|\./g, '').includes(name)));
  return key ? String(row[key] ?? '').trim() : '';
}

function parseDate(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  const parts = value.split(/[/-]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

export async function parseStatusReportFile(file: File): Promise<StatusReportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return rows.map((row) => ({
    finalOrderNo: cell(row, ['finalorderno', 'orderno', 'saporderno', 'dbmsorderno']).toUpperCase(),
    partNo: normalizePartNo(cell(row, ['partno', 'material', 'itemcode'])),
    billedQty: toNumber(cell(row, ['billedqty', 'billqty', 'qty'])),
    invoiceNo: cell(row, ['invoiceno', 'dbmsinvoice']).toUpperCase(),
    invoiceDate: parseDate(cell(row, ['invoicedate', 'billdate'])),
    docketNo: cell(row, ['docketno', 'lrno', 'awb']).toUpperCase(),
    transportName: cell(row, ['transport', 'transporter']),
  })).filter((row) => row.finalOrderNo && row.partNo);
}

export async function applyStatusReportRows(rows: StatusReportRow[]): Promise<StatusReportResult> {
  const { data, error } = await supabase.functions.invoke('status-report-action', { body: { rows } });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return {
    total: Number(data?.total ?? rows.length),
    updated: Number(data?.updated ?? 0),
    skipped: Number(data?.skipped ?? 0),
    failed: Number(data?.failed ?? 0),
    errors: Array.isArray(data?.errors) ? data.errors : [],
  };
}
