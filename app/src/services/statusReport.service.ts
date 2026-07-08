import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { normalizePartNo, toNumber } from '../lib/orderLogic';

export type StatusReportPreviewRow = {
  status: 'matched' | 'skipped' | 'failed';
  action: string;
  orderNo: string;
  partNo: string;
  reason: string;
  billedQty?: number;
  itemQty?: number;
  currentBilledQty?: number;
  currentRowStatus?: string | null;
  matchCount?: number;
  activeMatchCount?: number;
  warning?: string;
};

export type StatusReportApplyReportRow = {
  result: 'SUCCESS' | 'SKIPPED' | 'FAILED';
  reason: string;
  order_id?: string;
  item_id?: string;
  uploaded_order_no: string;
  matched_order_no?: string;
  part_no: string;
  billed_qty: number;
  previous_item_status?: string | null;
  current_item_status?: string | null;
  previous_order_status?: string | null;
  current_order_status?: string | null;
  previous_billed_qty?: number;
  current_billed_qty?: number;
  effective_item_qty?: number;
  invoice_no?: string | null;
  invoice_date?: string | null;
  docket_no?: string | null;
  delivery_no?: string | null;
  transport_name?: string | null;
  transport_mode?: string | null;
  packing_detail?: string | null;
  eway_bill_no?: string | null;
  gst_invoice_no?: string | null;
  raw_status?: string | null;
  order_reg_date?: string | null;
  branch_name?: string | null;
  line_no?: string | null;
  material_description?: string | null;
  customer_po?: string | null;
  dealer_code?: string | null;
  ship_to_party?: string | null;
  ship_to_name?: string | null;
  order_type?: string | null;
  order_qty?: number;
};

export type StatusReportResult = {
  total: number;
  updated: number;
  inserted: number;
  skipped: number;
  failed: number;
  errors: string[];
  previewRows?: StatusReportPreviewRow[];
  reportRows?: StatusReportApplyReportRow[];
};

export type StatusReportRow = {
  finalOrderNo: string;
  partNo: string;
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
  lineNo: string;
  materialDescription: string;
  customerPo: string;
  dealerCode: string;
  shipToParty: string;
  shipToName: string;
  orderType: string;
  orderQty: number;
};

type PreviewOrder = { id: string; order_no: string | null; status: string | null; branch: string | null };
type PreviewItem = { id: string; order_id: string; part_no: string | null; qty: number | string | null; edited_qty: number | string | null; billed_qty: number | string | null; row_status: string | null };

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

function normalizeStatusResult(data: unknown, rowCount: number): StatusReportResult {
  const value = data as Partial<StatusReportResult> | null | undefined;
  return {
    total: Number(value?.total ?? rowCount),
    updated: Number(value?.updated ?? 0),
    inserted: Number(value?.inserted ?? 0),
    skipped: Number(value?.skipped ?? 0),
    failed: Number(value?.failed ?? 0),
    errors: Array.isArray(value?.errors) ? value.errors : [],
    previewRows: Array.isArray(value?.previewRows) ? value.previewRows : undefined,
    reportRows: Array.isArray(value?.reportRows) ? value.reportRows : undefined,
  };
}

function statusFunctionError(error: unknown, fallback: string) {
  if (!error) return fallback;
  const anyError = error as { message?: string; context?: { status?: number; statusText?: string }; details?: string };
  const status = anyError.context?.status;
  const statusText = anyError.context?.statusText;
  const message = anyError.message || fallback;
  if (status) return `${message} (${status}${statusText ? ` ${statusText}` : ''})`;
  return message;
}

function normalizeStatus(value: unknown) {
  const status = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!status) return '';
  if (status.includes('receiv')) return status.includes('partial') ? 'partially_received' : 'received';
  if (status.includes('reject')) return 'rejected';
  if (status.includes('issued')) return 'issued';
  if (status.includes('dispatch') || status.includes('despatch')) return status.includes('partial') ? 'partially_dispatched' : 'dispatched';
  if (status.includes('process')) return 'processed';
  if (status.includes('approved')) return 'approved';
  return status;
}

function effectiveQty(row: PreviewItem) {
  if (row.edited_qty !== null && row.edited_qty !== undefined && row.edited_qty !== '') return Math.max(0, toNumber(row.edited_qty));
  return Math.max(0, toNumber(row.qty));
}

function isClosedStatus(value: unknown) {
  return ['received', 'issued', 'rejected'].includes(normalizeStatus(value));
}

function safeFilename(value: string) {
  return value.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'status_report';
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
    deliveryNo: cellText(row, ['deliveryno', 'deliverynumber', 'challanno', 'challan', 'delivery']).toUpperCase(),
    transportMode: cellText(row, ['transportmode', 'mode']).toUpperCase(),
    packingDetail: cellText(row, ['packingdetail', 'packing', 'packaging']),
    ewayBillNo: cellText(row, ['ewaybillno', 'ewaybill', 'eway']).toUpperCase(),
    gstInvoiceNo: cellText(row, ['gstinvoiceno', 'gstinvoice', 'gstbillno']).toUpperCase(),
    rawStatus: cellText(row, ['status', 'orderstatus', 'rowstatus']),
    branchName: cellText(row, ['branch', 'branchname', 'plant', 'location', 'shiptoparty']),
    lineNo: cellText(row, ['lineno', 'linenumber', 'line']),
    materialDescription: cellText(row, ['materialdescription', 'partdescription', 'description']),
    customerPo: cellText(row, ['custpo', 'customerpo', 'customerpurchaseorder']).toUpperCase(),
    dealerCode: cellText(row, ['dealercode', 'dealer']).toUpperCase(),
    shipToParty: cellText(row, ['shiptoparty', 'shipto']).toUpperCase(),
    shipToName: cellText(row, ['nameofshiptopart', 'nameofshiptoparty', 'shiptoname']),
    orderType: cellText(row, ['type', 'ordertype']).toUpperCase(),
    orderQty: toNumber(cellText(row, ['orderqty', 'orderquantity'])),
  })).filter((row) => row.finalOrderNo && row.partNo);
}

async function findPreviewOrders(orderNo: string) {
  const { data, error } = await supabase
    .from('portal_orders')
    .select('id,order_no,status,branch')
    .or(`final_order_no.eq.${orderNo},processing_reference.eq.${orderNo},order_no.eq.${orderNo}`)
    .limit(2);
  if (error) throw error;
  return (data ?? []) as PreviewOrder[];
}

async function findPreviewItems(orderId: string, partNo: string) {
  const { data, error } = await supabase
    .from('portal_order_items')
    .select('id,order_id,part_no,qty,edited_qty,billed_qty,row_status')
    .eq('order_id', orderId)
    .eq('part_no', partNo)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PreviewItem[];
}

export async function previewStatusReportRows(rows: StatusReportRow[]): Promise<StatusReportResult> {
  const previewRows: StatusReportPreviewRow[] = [];
  const errors: string[] = [];
  let updated = 0;
  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  const orderCache = new Map<string, PreviewOrder[]>();
  const itemCache = new Map<string, PreviewItem[]>();

  for (const row of rows) {
    const finalOrderNo = row.finalOrderNo.trim().toUpperCase();
    const partNo = normalizePartNo(row.partNo);
    try {
      if (!finalOrderNo || !partNo) {
        skipped += 1;
        const reason = 'missing order or part';
        errors.push(`${finalOrderNo || '-'} / ${partNo || '-'}: ${reason}`);
        previewRows.push({ status: 'skipped', action: 'skip', orderNo: finalOrderNo || '-', partNo: partNo || '-', reason });
        continue;
      }

      let orders = orderCache.get(finalOrderNo);
      if (!orders) {
        orders = await findPreviewOrders(finalOrderNo);
        orderCache.set(finalOrderNo, orders);
      }

      if (!orders.length) {
        skipped += 1;
        const reason = 'order not found';
        errors.push(`${finalOrderNo} / ${partNo}: ${reason}`);
        previewRows.push({ status: 'skipped', action: 'skip', orderNo: finalOrderNo, partNo, reason });
        continue;
      }
      if (orders.length > 1) {
        skipped += 1;
        const reason = 'multiple orders matched';
        errors.push(`${finalOrderNo} / ${partNo}: ${reason}`);
        previewRows.push({ status: 'skipped', action: 'skip', orderNo: finalOrderNo, partNo, reason, matchCount: orders.length });
        continue;
      }

      const order = orders[0];
      const itemKey = `${order.id}|${partNo}`;
      let items = itemCache.get(itemKey);
      if (!items) {
        items = await findPreviewItems(order.id, partNo);
        itemCache.set(itemKey, items);
      }

      if (!items.length) {
        skipped += 1;
        const reason = 'item row not found';
        errors.push(`${finalOrderNo} / ${partNo}: ${reason}`);
        previewRows.push({ status: 'skipped', action: 'skip', orderNo: finalOrderNo, partNo, reason });
        continue;
      }

      const activeItems = items.filter((item) => !isClosedStatus(item.row_status));
      const activeItem = activeItems[0] ?? null;
      if (!activeItem) {
        skipped += 1;
        const reason = 'item is fully received, issued, or rejected';
        errors.push(`${finalOrderNo} / ${partNo}: ${reason}`);
        previewRows.push({ status: 'skipped', action: 'skip', orderNo: finalOrderNo, partNo, reason, matchCount: items.length, activeMatchCount: 0 });
        continue;
      }

      inserted += 1;
      updated += 1;
      previewRows.push({
        status: 'matched',
        action: 'would_insert_billing_chunk',
        orderNo: order.order_no || finalOrderNo,
        partNo,
        reason: 'Matched by Order No + Part No. Preview only; no database write done.',
        billedQty: row.billedQty,
        itemQty: effectiveQty(activeItem),
        currentBilledQty: toNumber(activeItem.billed_qty),
        currentRowStatus: activeItem.row_status,
        matchCount: items.length,
        activeMatchCount: activeItems.length,
        warning: activeItems.length > 1 ? 'More than one active item row matched. Current apply logic would use the first active row.' : undefined,
      });
    } catch (error) {
      failed += 1;
      const reason = error instanceof Error ? error.message : 'preview failed';
      errors.push(`${finalOrderNo || '-'} / ${partNo || '-'}: ${reason}`);
      previewRows.push({ status: 'failed', action: 'error', orderNo: finalOrderNo || '-', partNo: partNo || '-', reason });
    }
  }

  return {
    total: rows.length,
    updated,
    inserted,
    skipped,
    failed,
    errors: errors.slice(0, 100),
    previewRows,
  };
}

export async function applyStatusReportRows(rows: StatusReportRow[]): Promise<StatusReportResult> {
  const { data, error } = await supabase.functions.invoke('status-report-action', { body: { rows } });
  if (error) throw new Error(statusFunctionError(error, 'Status upload failed.'));
  if (data?.error) throw new Error(String(data.error));
  return normalizeStatusResult(data, rows.length);
}

export function downloadStatusReportResultExcel(result: StatusReportResult, sourceRows: StatusReportRow[], sourceFileName: string) {
  const reportRows = result.reportRows ?? [];
  const now = new Date();
  const generatedAt = now.toLocaleString('en-IN');
  const summaryRows = [
    ['Generated At', generatedAt],
    ['Source File', sourceFileName || 'status-report.xlsx'],
    ['Total Rows', result.total],
    ['Successful Rows', reportRows.filter((row) => row.result === 'SUCCESS').length || result.updated],
    ['Skipped Rows', reportRows.filter((row) => row.result === 'SKIPPED').length || result.skipped],
    ['Failed Rows', reportRows.filter((row) => row.result === 'FAILED').length || result.failed],
    ['Billing Chunks', result.inserted],
    ['Item Rows Updated', result.updated],
  ];

  const detailRows = (reportRows.length ? reportRows : sourceRows.map((row): StatusReportApplyReportRow => ({
    result: 'FAILED',
    reason: 'Detailed server report was not returned. Deploy latest status-report-action function.',
    uploaded_order_no: row.finalOrderNo,
    part_no: row.partNo,
    billed_qty: row.billedQty,
    invoice_no: row.invoiceNo,
    invoice_date: row.invoiceDate,
    docket_no: row.docketNo,
    delivery_no: row.deliveryNo,
    transport_name: row.transportName,
    transport_mode: row.transportMode,
    packing_detail: row.packingDetail,
    eway_bill_no: row.ewayBillNo,
    gst_invoice_no: row.gstInvoiceNo,
    raw_status: row.rawStatus,
    order_reg_date: row.orderRegDate,
    branch_name: row.branchName,
    line_no: row.lineNo,
    material_description: row.materialDescription,
    customer_po: row.customerPo,
    dealer_code: row.dealerCode,
    ship_to_party: row.shipToParty,
    ship_to_name: row.shipToName,
    order_type: row.orderType,
    order_qty: row.orderQty,
  }))).map((row, index) => ({
    'Sr No': index + 1,
    Result: row.result,
    Reason: row.reason,
    'Uploaded Order No': row.uploaded_order_no,
    'Matched Order No': row.matched_order_no ?? '',
    'Part No': row.part_no,
    'Line No': row.line_no ?? '',
    'Material Description': row.material_description ?? '',
    'Billed Qty': row.billed_qty,
    'Order Qty': row.order_qty ?? '',
    'Effective Item Qty': row.effective_item_qty ?? '',
    'Previous Billed Qty': row.previous_billed_qty ?? '',
    'Current Billed Qty': row.current_billed_qty ?? '',
    'Previous Item Status': row.previous_item_status ?? '',
    'Current Item Status': row.current_item_status ?? '',
    'Previous Order Status': row.previous_order_status ?? '',
    'Current Order Status': row.current_order_status ?? '',
    'Order Reg Date': row.order_reg_date ?? '',
    'Invoice No': row.invoice_no ?? '',
    'Invoice Date': row.invoice_date ?? '',
    'Docket No': row.docket_no ?? '',
    'Delivery No': row.delivery_no ?? '',
    'Transport Name': row.transport_name ?? '',
    'Transport Mode': row.transport_mode ?? '',
    'Packing Detail': row.packing_detail ?? '',
    'E-Way Bill No': row.eway_bill_no ?? '',
    'GST Invoice No': row.gst_invoice_no ?? '',
    'Raw Report Status': row.raw_status ?? '',
    'Customer PO': row.customer_po ?? '',
    'Dealer Code': row.dealer_code ?? '',
    'Ship To Party': row.ship_to_party ?? '',
    'Ship To Name': row.ship_to_name ?? '',
    'Order Type': row.order_type ?? '',
    Branch: row.branch_name ?? '',
    'Portal Order ID': row.order_id ?? '',
    'Portal Item ID': row.item_id ?? '',
  }));

  const wb = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  const detailsSheet = XLSX.utils.json_to_sheet(detailRows);
  summarySheet['!cols'] = [{ wch: 24 }, { wch: 36 }];
  detailsSheet['!cols'] = Object.keys(detailRows[0] ?? { Result: '' }).map((key) => ({ wch: Math.min(Math.max(key.length + 4, 14), 34) }));
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
  XLSX.utils.book_append_sheet(wb, detailsSheet, 'Upload Report');
  XLSX.writeFile(wb, `${safeFilename(sourceFileName)}_status_upload_report_${now.toISOString().slice(0, 10)}.xlsx`);
}
