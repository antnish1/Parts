import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { normalizePartNo, toNumber } from '../lib/orderLogic';

export type StatusReportResult = { total: number; updated: number; inserted: number; skipped: number; failed: number; errors: string[] };

export type StatusReportRow = {
  finalOrderNo: string;
  orderNo: string;
  customerPo: string;
  dealerCode: string;
  shipToParty: string;
  shipToName: string;
  orderType: string;
  orderQty: number;
  lineNo: string;
  partNo: string;
  materialDescription: string;
  billedQty: number;
  orderRegDate: string | null;
  invoiceNo: string;
  invoiceDate: string | null;
  docketNo: string;
  transportName: string;
  deliveryNo: string;
  transportMode: string;
  packingDetail: string;
  ewayBillNo: string;
  gstInvoiceNo: string;
  rawStatus: string;
  branchName: string;
};

function keyOf(value: string) {
  return value.toLowerCase().replace(/\s|_|\.|-|\(|\)|\/|&|:/g, '');
}

function cell(row: Record<string, unknown>, names: string[]) {
  const keys = Object.keys(row);
  const normalizedNames = names.map(keyOf);
  const exactKey = keys.find((item) => normalizedNames.includes(keyOf(item)));
  if (exactKey) return row[exactKey];
  const partialKey = keys.find((item) => normalizedNames.some((name) => keyOf(item).includes(name)));
  return partialKey ? row[partialKey] : '';
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

  const parts = text.split(/[/-]/).map((part) => part.trim());
  if (parts.length === 3) {
    const [first, second, third] = parts;
    if (first.length <= 2 && second.length <= 2) {
      const year = third.length === 2 ? `20${third}` : third;
      return `${year}-${second.padStart(2, '0')}-${first.padStart(2, '0')}`;
    }
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function parseDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseDelimitedText(text: string) {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return [];
  const firstLine = lines[0];
  const delimiter = (firstLine.match(/\t/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? '\t' : ',';
  const headers = parseDelimitedLine(firstLine, delimiter).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line, delimiter);
    return headers.reduce<Record<string, unknown>>((acc, header, index) => {
      acc[header || `Column ${index + 1}`] = values[index] ?? '';
      return acc;
    }, {});
  });
}

async function readStatusRows(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const isTextLike = ['csv', 'txt', 'tsv'].includes(extension) || file.type.startsWith('text/');
  if (isTextLike) {
    const text = await file.text();
    return parseDelimitedText(text);
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
}

export async function parseStatusReportFile(file: File): Promise<StatusReportRow[]> {
  const rows = await readStatusRows(file);
  return rows.map((row) => {
    const orderNo = cellText(row, ['order no', 'order number', 'orderno', 'sales order no', 'salesorderno']).toUpperCase();
    const customerPo = cellText(row, ['custpo', 'cust po', 'customer po', 'customerpo', 'customer purchase order']).toUpperCase();
    const partNo = normalizePartNo(cellText(row, ['material no', 'material number', 'materialno', 'materialnumber', 'part no', 'part number', 'partno', 'partnumber', 'item code', 'itemcode', 'item no', 'itemno']));

    return {
      finalOrderNo: orderNo,
      orderNo,
      customerPo,
      dealerCode: cellText(row, ['dealer code', 'dealercode']).toUpperCase(),
      shipToParty: cellText(row, ['ship to party', 'shiptoparty', 'ship to', 'shipto']).toUpperCase(),
      shipToName: cellText(row, ['name of ship to part', 'name of ship to party', 'ship to name', 'shiptoname', 'nameofshiptopart', 'nameofshiptoparty']),
      orderType: cellText(row, ['type', 'order type', 'ordertype']).toUpperCase(),
      orderQty: toNumber(cellText(row, ['order qty', 'order quantity', 'orderqty', 'orderquantity'])),
      lineNo: cellText(row, ['line no', 'line number', 'lineno', 'linenumber']).toUpperCase(),
      partNo,
      materialDescription: cellText(row, ['material description', 'materialdescription', 'part description', 'partdescription', 'description']),
      billedQty: toNumber(cellText(row, ['billed qty', 'billed quantity', 'billedqty', 'billedquantity', 'bill qty', 'billqty', 'invoice qty', 'invoiceqty', 'dispatch qty', 'dispatchqty'])),
      orderRegDate: parseDate(cell(row, ['order reg. dt', 'order reg dt', 'order reg date', 'orderregdt', 'orderregdate', 'reg dt', 'reg date', 'registration date', 'order registration date'])),
      invoiceNo: cellText(row, ['billno & image', 'billno image', 'billnoimage', 'billnoandimage', 'bill no', 'billno', 'invoice no', 'invoiceno', 'invoice number', 'dbms invoice', 'dbms invoice no', 'billing doc']).toUpperCase(),
      invoiceDate: parseDate(cell(row, ['billing dt', 'billing date', 'billingdt', 'billingdate', 'bill date', 'invoice date', 'dbms invoice date'])),
      docketNo: cellText(row, ['docket', 'docket no', 'docket number', 'docketno', 'docketnumber', 'lr no', 'lrno', 'awb no', 'awbno', 'waybill']).toUpperCase(),
      transportName: cellText(row, ['transport name', 'transportname', 'transport', 'transporter', 'transporter name', 'courier', 'carrier']),
      deliveryNo: cellText(row, ['delivery no', 'delivery number', 'deliveryno', 'deliverynumber', 'challan no', 'challanno', 'challan', 'delivery']).toUpperCase(),
      transportMode: cellText(row, ['transport mode', 'transportmode', 'mode']).toUpperCase(),
      packingDetail: cellText(row, ['packing detail', 'packingdetail', 'packing', 'packaging']),
      ewayBillNo: cellText(row, ['e-way bill no', 'eway bill no', 'ewaybillno', 'eway bill', 'ewaybill', 'eway']).toUpperCase(),
      gstInvoiceNo: cellText(row, ['gst invoice no', 'gstinvoiceno', 'gst invoice', 'gstinvoice', 'gst bill no', 'gstbillno']).toUpperCase(),
      rawStatus: cellText(row, ['status', 'order status', 'orderstatus', 'row status', 'rowstatus']),
      branchName: cellText(row, ['branch', 'branch name', 'branchname', 'plant', 'location', 'ship to party', 'shiptoparty']).toUpperCase(),
    };
  }).filter((row) => (row.orderNo || row.customerPo) && row.partNo);
}

export async function applyStatusReportRows(rows: StatusReportRow[]): Promise<StatusReportResult> {
  const { data, error } = await supabase.functions.invoke('status-report-action', { body: { rows } });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return {
    total: Number(data?.total ?? rows.length),
    updated: Number(data?.updated ?? 0),
    inserted: Number(data?.inserted ?? 0),
    skipped: Number(data?.skipped ?? 0),
    failed: Number(data?.failed ?? 0),
    errors: Array.isArray(data?.errors) ? data.errors : [],
  };
}
