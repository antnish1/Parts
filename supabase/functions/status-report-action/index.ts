import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const clean = (value: unknown) => String(value ?? '').trim();
const normPart = (value: unknown) => clean(value).replace(/\s+/g, '').toUpperCase();
const normNo = (value: unknown) => clean(value).toUpperCase();
const num = (value: unknown) => {
  const parsed = Number(String(value ?? 0).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const closedRowStatuses = new Set(['received', 'issued', 'rejected']);

type ApplyReportRow = {
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

type Result = { total: number; updated: number; inserted: number; skipped: number; failed: number; errors: string[]; reportRows: ApplyReportRow[] };
type HeaderCandidate = { orderRegDate: string | null; value: string | null; dateValue: string | null; transport: string | null; docket: string | null };
type ItemRow = { id: string; order_id: string; part_no: string; qty: number | string | null; edited_qty: number | string | null; billed_qty: number | string | null; row_status: string | null };
type ChunkRow = { billed_qty: number | string | null; received_qty?: number | string | null; order_reg_date: string | null; invoice_no: string | null; billing_date: string | null; docket_no: string | null; transport_name: string | null };

function normalizeStatus(value: unknown) {
  const status = clean(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (!status) return '';
  if (status.includes('receiv')) return status.includes('partial') ? 'partially_received' : 'received';
  if (status.includes('reject')) return 'rejected';
  if (status.includes('partial') && (status.includes('dispatch') || status.includes('despatch'))) return 'partially_dispatched';
  if (status.includes('dispatch') || status.includes('despatch')) return 'dispatched';
  if (status.includes('issued')) return 'issued';
  if (status.includes('process')) return 'processed';
  if (status.includes('pending') && status.includes('manager')) return 'pending_manager_approval';
  if (status.includes('pending')) return 'pending_approval';
  if (status.includes('approved')) return 'approved';
  return status;
}

function effectiveQty(row: ItemRow) {
  const edited = row.edited_qty;
  if (edited !== null && edited !== undefined && edited !== '') return Math.max(0, num(edited));
  return Math.max(0, num(row.qty));
}

function resolveItemStatus(item: ItemRow, billedTotal: number, receivedTotal: number) {
  const current = normalizeStatus(item.row_status);
  if (current === 'rejected') return 'rejected';
  if (current === 'issued') return 'issued';
  const qty = effectiveQty(item);
  if (receivedTotal > 0) {
    if (qty <= 0 || receivedTotal >= qty) return 'received';
    return 'partially_received';
  }
  if (current === 'received') return 'received';
  if (billedTotal <= 0) return 'processed';
  if (qty <= 0) return 'dispatched';
  if (billedTotal >= qty) return 'dispatched';
  return 'partially_dispatched';
}

function deriveOrderStatus(rows: Array<{ row_status: string | null }>) {
  if (!rows.length) return 'processed';
  const statuses = rows.map((row) => normalizeStatus(row.row_status)).filter(Boolean);
  if (!statuses.length) return 'processed';

  if (statuses.every((status) => status === 'issued')) return 'issued';
  if (statuses.every((status) => status === 'received' || status === 'issued')) return statuses.includes('issued') ? 'issued' : 'received';
  if (statuses.some((status) => status === 'received' || status === 'issued' || status === 'partially_received')) return 'partially_received';
  if (statuses.every((status) => status === 'dispatched')) return 'dispatched';
  if (statuses.some((status) => status === 'dispatched' || status === 'partially_dispatched')) return 'partially_dispatched';
  if (statuses.every((status) => status === 'processed')) return 'processed';
  if (statuses.some((status) => status === 'processed')) return 'processed';
  if (statuses.every((status) => status === 'rejected')) return 'rejected';
  if (statuses.some((status) => status === 'rejected')) return 'partially_rejected';
  if (statuses.some((status) => status === 'pending_manager_approval')) return 'pending_manager_approval';
  if (statuses.some((status) => status === 'pending_approval')) return 'pending_approval';
  if (statuses.some((status) => status === 'approved')) return 'approved';
  return statuses[0] || 'processed';
}

function singleOrNull(values: unknown[]) {
  const unique = [...new Set(values.map((value) => clean(value)).filter(Boolean))];
  return unique.length === 1 ? unique[0] : null;
}

function idempotencyKey(parts: unknown[]) {
  return parts.map((part) => normNo(part)).join('|');
}

function baseReportRow(rawRow: Record<string, unknown>, finalOrderNo: string, partNo: string): ApplyReportRow {
  return {
    result: 'SKIPPED',
    reason: '',
    uploaded_order_no: finalOrderNo || '-',
    part_no: partNo || '-',
    billed_qty: num(rawRow.billedQty),
    invoice_no: normNo(rawRow.invoiceNo) || null,
    invoice_date: clean(rawRow.invoiceDate) || null,
    docket_no: normNo(rawRow.docketNo) || null,
    delivery_no: normNo(rawRow.deliveryNo) || null,
    transport_name: clean(rawRow.transportName) || null,
    transport_mode: normNo(rawRow.transportMode) || null,
    packing_detail: clean(rawRow.packingDetail) || null,
    eway_bill_no: normNo(rawRow.ewayBillNo) || null,
    gst_invoice_no: normNo(rawRow.gstInvoiceNo) || null,
    raw_status: clean(rawRow.rawStatus) || null,
    order_reg_date: clean(rawRow.orderRegDate) || null,
    branch_name: clean(rawRow.branchName) || null,
    line_no: clean(rawRow.lineNo) || null,
    material_description: clean(rawRow.materialDescription) || null,
    customer_po: clean(rawRow.customerPo) || null,
    dealer_code: clean(rawRow.dealerCode) || null,
    ship_to_party: clean(rawRow.shipToParty) || null,
    ship_to_name: clean(rawRow.shipToName) || null,
    order_type: clean(rawRow.orderType) || null,
    order_qty: num(rawRow.orderQty),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: 'Unauthorized' }, 401);
  const { data: profile, error: profileError } = await adminClient.from('portal_profiles').select('id,role,is_active').eq('auth_user_id', userData.user.id).maybeSingle();
  if (profileError) return json({ error: profileError.message }, 400);
  if (!profile?.is_active || !['admin', 'developer'].includes(profile.role)) return json({ error: 'Only active admin or developer can apply status reports' }, 403);

  const body = await req.json().catch(() => ({}));
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const result: Result = { total: rows.length, updated: 0, inserted: 0, skipped: 0, failed: 0, errors: [], reportRows: [] };
  const touchedOrders = new Map<string, string>();
  const headerCandidates = new Map<string, HeaderCandidate[]>();
  const now = new Date().toISOString();

  for (const rawRow of rows) {
    const finalOrderNo = normNo(rawRow.finalOrderNo);
    const partNo = normPart(rawRow.partNo);
    const reportRow = baseReportRow(rawRow as Record<string, unknown>, finalOrderNo, partNo);
    try {
      if (!finalOrderNo || !partNo) {
        result.skipped += 1;
        reportRow.result = 'SKIPPED';
        reportRow.reason = 'missing order or part';
        result.errors.push(`${finalOrderNo || '-'} / ${partNo || '-'}: ${reportRow.reason}`);
        result.reportRows.push(reportRow);
        continue;
      }
      const { data: orders, error: orderError } = await adminClient
        .from('portal_orders')
        .select('id,order_no,status,branch')
        .or(`final_order_no.eq.${finalOrderNo},processing_reference.eq.${finalOrderNo},order_no.eq.${finalOrderNo}`)
        .limit(2);
      if (orderError) throw orderError;
      if (!orders?.length) {
        result.skipped += 1;
        reportRow.result = 'SKIPPED';
        reportRow.reason = 'order not found';
        result.errors.push(`${finalOrderNo} / ${partNo}: ${reportRow.reason}`);
        result.reportRows.push(reportRow);
        continue;
      }
      if (orders.length > 1) {
        result.skipped += 1;
        reportRow.result = 'SKIPPED';
        reportRow.reason = 'multiple orders matched';
        result.errors.push(`${finalOrderNo} / ${partNo}: ${reportRow.reason}`);
        result.reportRows.push(reportRow);
        continue;
      }
      const order = orders[0];
      reportRow.order_id = order.id;
      reportRow.matched_order_no = order.order_no;
      reportRow.previous_order_status = order.status;

      const { data: currentItems, error: currentError } = await adminClient
        .from('portal_order_items')
        .select('id, order_id, part_no, qty, edited_qty, billed_qty, row_status')
        .eq('order_id', order.id)
        .eq('part_no', partNo)
        .order('created_at', { ascending: true });
      if (currentError) throw currentError;
      if (!currentItems?.length) {
        result.skipped += 1;
        reportRow.result = 'SKIPPED';
        reportRow.reason = 'item row not found';
        result.errors.push(`${finalOrderNo} / ${partNo}: ${reportRow.reason}`);
        result.reportRows.push(reportRow);
        continue;
      }

      const activeItem = (currentItems as ItemRow[]).find((item) => !closedRowStatuses.has(normalizeStatus(item.row_status))) ?? null;
      if (!activeItem) {
        result.skipped += 1;
        reportRow.result = 'SKIPPED';
        reportRow.reason = 'item is fully received, issued, or rejected';
        result.errors.push(`${finalOrderNo} / ${partNo}: ${reportRow.reason}`);
        result.reportRows.push(reportRow);
        continue;
      }

      reportRow.item_id = activeItem.id;
      reportRow.previous_item_status = activeItem.row_status;
      reportRow.previous_billed_qty = num(activeItem.billed_qty);
      reportRow.effective_item_qty = effectiveQty(activeItem);

      const billingPayload = {
        order_id: order.id,
        item_id: activeItem.id,
        order_no: order.order_no,
        part_no: partNo,
        billed_qty: num(rawRow.billedQty),
        billing_date: clean(rawRow.invoiceDate) || null,
        order_reg_date: clean(rawRow.orderRegDate) || null,
        delivery_no: normNo(rawRow.deliveryNo) || null,
        invoice_no: normNo(rawRow.invoiceNo) || null,
        docket_no: normNo(rawRow.docketNo) || null,
        transport_name: clean(rawRow.transportName) || null,
        transport_mode: normNo(rawRow.transportMode) || null,
        packing_detail: clean(rawRow.packingDetail) || null,
        eway_bill_no: normNo(rawRow.ewayBillNo) || null,
        gst_invoice_no: normNo(rawRow.gstInvoiceNo) || null,
        raw_status: clean(rawRow.rawStatus) || null,
        idempotency_key: idempotencyKey([activeItem.id, finalOrderNo, partNo, rawRow.billedQty, rawRow.invoiceDate, rawRow.deliveryNo, rawRow.invoiceNo, rawRow.docketNo]),
        source: 'status_report_upload',
        created_by: profile.id,
        updated_at: now,
      };

      const { error: billingError } = await adminClient
        .from('portal_order_item_billings')
        .upsert([billingPayload], { onConflict: 'idempotency_key' });
      if (billingError) throw billingError;
      result.inserted += 1;

      const { data: chunks, error: chunkReadError } = await adminClient
        .from('portal_order_item_billings')
        .select('billed_qty, received_qty, order_reg_date, invoice_no, billing_date, docket_no, transport_name')
        .eq('item_id', activeItem.id);
      if (chunkReadError) throw chunkReadError;

      const chunkRows = (chunks ?? []) as ChunkRow[];
      const billedTotal = chunkRows.reduce((sum, row) => sum + num(row.billed_qty), 0);
      const receivedTotal = chunkRows.reduce((sum, row) => sum + num(row.received_qty), 0);
      const nextRowStatus = resolveItemStatus(activeItem, billedTotal, receivedTotal);
      const itemUpdate = {
        billed_qty: billedTotal,
        received_date: receivedTotal > 0 ? now : null,
        order_reg_date: singleOrNull(chunkRows.map((row) => row.order_reg_date)),
        dbms_invoice_no: singleOrNull(chunkRows.map((row) => row.invoice_no)),
        dbms_invoice_date: singleOrNull(chunkRows.map((row) => row.billing_date)),
        docket_no: singleOrNull(chunkRows.map((row) => row.docket_no)),
        transport_name: singleOrNull(chunkRows.map((row) => row.transport_name)),
        row_status: nextRowStatus,
        updated_at: now,
      };

      const { error: itemError } = await adminClient.from('portal_order_items').update(itemUpdate).eq('id', activeItem.id);
      if (itemError) throw itemError;

      reportRow.result = 'SUCCESS';
      reportRow.reason = 'billing chunk applied and item status recalculated';
      reportRow.current_item_status = nextRowStatus;
      reportRow.current_billed_qty = billedTotal;
      result.reportRows.push(reportRow);

      touchedOrders.set(order.id, order.order_no);
      const existingHeaders = headerCandidates.get(order.id) ?? [];
      existingHeaders.push({ orderRegDate: itemUpdate.order_reg_date, value: itemUpdate.dbms_invoice_no, dateValue: itemUpdate.dbms_invoice_date, docket: itemUpdate.docket_no, transport: itemUpdate.transport_name });
      headerCandidates.set(order.id, existingHeaders);

      await adminClient.from('portal_order_events').insert({
        order_id: order.id,
        event_type: 'STATUS_REPORT_UPDATED',
        old_status: order.status,
        new_status: nextRowStatus,
        actor_id: profile.id,
        notes: `Status upload added billing chunk for ${partNo}. Total billed ${billedTotal}, total received ${receivedTotal}.`,
        metadata: { part_no: partNo, chunk: billingPayload, billed_qty_total: billedTotal, received_qty_total: receivedTotal, row_status: nextRowStatus },
      });
      result.updated += 1;
    } catch (error) {
      result.failed += 1;
      reportRow.result = 'FAILED';
      reportRow.reason = error instanceof Error ? error.message : 'failed';
      result.errors.push(`${finalOrderNo || '-'} / ${partNo || '-'}: ${reportRow.reason}`);
      result.reportRows.push(reportRow);
    }
  }

  for (const [orderId, orderNo] of touchedOrders.entries()) {
    try {
      const { data: items, error: itemError } = await adminClient
        .from('portal_order_items')
        .select('row_status, order_reg_date, dbms_invoice_no, dbms_invoice_date, docket_no, transport_name')
        .eq('order_id', orderId);
      if (itemError) throw itemError;
      const itemRows = items ?? [];
      const nextStatus = deriveOrderStatus(itemRows);
      const updatePayload = {
        status: nextStatus,
        order_reg_date: singleOrNull(itemRows.map((item) => item.order_reg_date)),
        dbms_invoice_no: singleOrNull(itemRows.map((item) => item.dbms_invoice_no)),
        dbms_invoice_date: singleOrNull(itemRows.map((item) => item.dbms_invoice_date)),
        docket_no: singleOrNull(itemRows.map((item) => item.docket_no)),
        transport_name: singleOrNull(itemRows.map((item) => item.transport_name)),
        updated_at: now,
      };
      const { error: statusError } = await adminClient.from('portal_orders').update(updatePayload).eq('id', orderId);
      if (statusError) throw statusError;
      result.reportRows.filter((row) => row.order_id === orderId).forEach((row) => { row.current_order_status = nextStatus; });
      await adminClient.from('portal_order_events').insert({
        order_id: orderId,
        event_type: 'ORDER_STATUS_RECALCULATED',
        old_status: null,
        new_status: nextStatus,
        actor_id: profile.id,
        notes: `Order ${orderNo} recalculated after status upload. Billing chunks are stored separately for docket-wise tracking.`,
        metadata: { header_candidates: headerCandidates.get(orderId) ?? [], synced_header: updatePayload },
      });
    } catch (error) {
      const reason = `status recalculation failed - ${error instanceof Error ? error.message : 'failed'}`;
      result.errors.push(`${orderNo}: ${reason}`);
      result.reportRows.filter((row) => row.order_id === orderId).forEach((row) => { row.reason = `${row.reason}; ${reason}`; });
    }
  }

  return json(result);
});
