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

function keyOf(value: string) {
  return value.toLowerCase().replace(/\s|_|\.|-|\(|\)|\//g, '');
}

function cell(row: Record<string, unknown>, names: string[]) {
  const keys = Object.keys(row);
  const normalizedNames = names.map(keyOf);
  const key = keys.find((item) => normalizedNames.some((name) => keyOf(item).includes(name)));
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
    finalOrderNo: cell(row, ['finalorderno', 'finalorder', 'orderno', 'saporderno', 'saporder', 'dbmsorderno', 'dbmsorder', 'salesorderno', 'salesorder']).toUpperCase(),
    partNo: normalizePartNo(cell(row, ['partno', 'partnumber', 'materialno', 'materialnumber', 'material', 'itemcode', 'itemno'])),
    billedQty: toNumber(cell(row, ['billedqty', 'billedquantity', 'billqty', 'qty', 'quantity', 'dispatchqty', 'invoiceqty'])),
    invoiceNo: cell(row, ['invoiceno', 'invoicenumber', 'dbmsinvoice', 'dbmsinvoiceno', 'billno', 'billingdoc']).toUpperCase(),
    invoiceDate: parseDate(cell(row, ['invoicedate', 'billdate', 'billingdate', 'dbmsinvoicedate'])),
    docketNo: cell(row, ['docketno', 'docketnumber', 'lrno', 'lrnumber', 'awb', 'awbno', 'waybill']).toUpperCase(),
    transportName: cell(row, ['transport', 'transporter', 'transportname', 'transportername', 'courier', 'carrier']),
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
