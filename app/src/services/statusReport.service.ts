import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { normalizePartNo, toNumber } from '../lib/orderLogic';

export type StatusReportResult = { total: number; updated: number; skipped: number; failed: number; errors: string[] };

type StatusReportRow = {
  finalOrderNo: string;
  partNo: string;
  billedQty: number;
  orderRegDate: string | null;
  invoiceNo: string;
  invoiceDate: string | null;
  docketNo: string;
  transportName: string;
};

function keyOf(value: string) {
  return value.toLowerCase().replace(/\s|_|\.|-|\(|\)|\/|&/g, '');
}

function cell(row: Record<string, unknown>, names: string[]) {
  const keys = Object.keys(row);
  const normalizedNames = names.map(keyOf);
  const key = keys.find((item) => normalizedNames.some((name) => keyOf(item).includes(name)));
  return key ? row[key] : '';
}

function cellText(row: Record<string, unknown>, names: string[]) {
  return String(cell(row, names) ?? '').trim();
}

function excelSerialDateToIso(value: number) {
  const utc = Date.UTC(1899, 11, 30) + Math.round(value) * 24 * 60 * 60 * 1000;
  return new Date(utc).toISOString().slice(0, 10);
}

function parseDate(value: unknown) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && Number.isFinite(value) && value > 20000) return excelSerialDateToIso(value);

  const text = String(value).trim();
  if (!text) return null;
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 20000) return excelSerialDateToIso(numeric);

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  const parts = text.split(/[/-]/);
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
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
  return rows.map((row) => ({
    finalOrderNo: cellText(row, ['orderno', 'order']).toUpperCase(),
    partNo: normalizePartNo(cellText(row, ['materialno', 'materialnumber', 'partno', 'partnumber', 'material', 'itemcode', 'itemno'])),
    billedQty: toNumber(cellText(row, ['billedqty', 'billedquantity', 'billqty', 'qty', 'quantity', 'dispatchqty', 'invoiceqty'])),
    orderRegDate: parseDate(cell(row, ['orderregdt', 'orderregdate', 'regdt', 'regdate', 'registrationdate', 'orderregistrationdate'])),
    invoiceNo: cellText(row, ['billnoimage', 'billnoandimage', 'billno', 'invoiceno', 'invoicenumber', 'dbmsinvoice', 'dbmsinvoiceno', 'billingdoc']).toUpperCase(),
    invoiceDate: parseDate(cell(row, ['billingdt', 'billingdate', 'billdate', 'invoicedate', 'dbmsinvoicedate'])),
    docketNo: cellText(row, ['docket', 'docketno', 'docketnumber', 'lrno', 'lrnumber', 'awb', 'awbno', 'waybill']).toUpperCase(),
    transportName: cellText(row, ['transportname', 'transport', 'transporter', 'transportername', 'courier', 'carrier']),
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
