import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { getOrderStatusLabel, normalizePartNo, toNumber } from '../lib/orderLogic';

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

async function recalculateOrderStatus(orderId: string) {
  const { data: items, error } = await supabase
    .from('test_order_items')
    .select('row_status, status, approval_status, qty, edited_qty, billed_qty')
    .eq('order_id', orderId);
  if (error) throw error;

  const label = getOrderStatusLabel(items ?? []);
  const status = label.toLowerCase().replace(/ /g, '_');
  const { error: updateError } = await supabase
    .from('test_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .like('order_no', 'TEST-%');
  if (updateError) throw updateError;
  return status;
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
  const result: StatusReportResult = { total: rows.length, updated: 0, skipped: 0, failed: 0, errors: [] };
  const touchedOrders = new Map<string, string>();
  for (const row of rows) {
    try {
      const { data: order, error: orderError } = await supabase
        .from('test_orders')
        .select('id, order_no')
        .or(`final_order_no.eq.${row.finalOrderNo},processing_reference.eq.${row.finalOrderNo},order_no.eq.${row.finalOrderNo}`)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order?.id) { result.skipped += 1; result.errors.push(`${row.finalOrderNo} / ${row.partNo}: order not found`); continue; }

      const updatePayload = {
        billed_qty: row.billedQty,
        dbms_invoice_no: row.invoiceNo || null,
        dbms_invoice_date: row.invoiceDate,
        docket_no: row.docketNo || null,
        transport_name: row.transportName || null,
        row_status: 'issued',
        updated_at: new Date().toISOString(),
      };
      const { data: updatedRows, error: itemError } = await supabase
        .from('test_order_items')
        .update(updatePayload)
        .eq('order_id', order.id)
        .eq('part_no', row.partNo)
        .select('id');
      if (itemError) throw itemError;
      if (!updatedRows?.length) { result.skipped += 1; result.errors.push(`${row.finalOrderNo} / ${row.partNo}: item row not found`); continue; }

      touchedOrders.set(order.id, order.order_no);
      await supabase.from('test_order_events').insert({ order_id: order.id, event_type: 'STATUS_REPORT_UPDATED', old_status: null, new_status: 'issued', notes: `Status report updated ${row.partNo} invoice ${row.invoiceNo || '-'}.` });
      result.updated += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(`${row.finalOrderNo} / ${row.partNo}: ${error instanceof Error ? error.message : 'failed'}`);
    }
  }

  for (const [orderId, orderNo] of touchedOrders.entries()) {
    try {
      const status = await recalculateOrderStatus(orderId);
      await supabase.from('test_order_events').insert({ order_id: orderId, event_type: 'ORDER_STATUS_RECALCULATED', old_status: null, new_status: status, notes: `Order ${orderNo} recalculated after status upload.` });
    } catch (error) {
      result.errors.push(`${orderNo}: status recalculation failed - ${error instanceof Error ? error.message : 'failed'}`);
    }
  }
  return result;
}
