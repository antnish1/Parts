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

const closedStatuses = new Set(['received', 'issued', 'rejected']);
type Result = { total: number; updated: number; inserted: number; skipped: number; failed: number; errors: string[] };
type ItemRow = { id: string; order_id: string; part_no: string; qty: number | string | null; edited_qty: number | string | null; billed_qty: number | string | null; row_status: string | null };
type ChunkRow = { billed_qty: number | string | null; received_qty?: number | string | null; order_reg_date: string | null; invoice_no: string | null; billing_date: string | null; docket_no: string | null; transport_name: string | null };

function status(value: unknown) {
  const text = clean(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (text.includes('reject')) return 'rejected';
  if (text.includes('issued')) return 'issued';
  if (text.includes('receiv')) return text.includes('partial') ? 'partially_received' : 'received';
  if (text.includes('partial') && text.includes('dispatch')) return 'partially_dispatched';
  if (text.includes('dispatch')) return 'dispatched';
  if (text.includes('process')) return 'processed';
  if (text.includes('pending') && text.includes('manager')) return 'pending_manager_approval';
  if (text.includes('pending')) return 'pending_approval';
  if (text.includes('approved')) return 'approved';
  return text;
}

function effectiveQty(row: ItemRow) {
  if (row.edited_qty !== null && row.edited_qty !== undefined && row.edited_qty !== '') return Math.max(0, num(row.edited_qty));
  return Math.max(0, num(row.qty));
}

function nextItemStatus(item: ItemRow, billed: number, received: number) {
  const current = status(item.row_status);
  if (current === 'rejected' || current === 'issued') return current;
  const qty = effectiveQty(item);
  if (received > 0) return qty <= 0 || received >= qty ? 'received' : 'partially_received';
  if (current === 'received') return 'received';
  if (billed <= 0) return 'processed';
  return qty <= 0 || billed >= qty ? 'dispatched' : 'partially_dispatched';
}

function nextOrderStatus(rows: Array<{ row_status: string | null }>) {
  const list = rows.map((row) => status(row.row_status)).filter(Boolean);
  if (!list.length) return 'processed';
  if (list.every((s) => s === 'issued')) return 'issued';
  if (list.every((s) => s === 'received' || s === 'issued')) return list.includes('issued') ? 'issued' : 'received';
  if (list.some((s) => s === 'received' || s === 'issued' || s === 'partially_received')) return 'partially_received';
  if (list.every((s) => s === 'dispatched')) return 'dispatched';
  if (list.some((s) => s === 'dispatched' || s === 'partially_dispatched')) return 'partially_dispatched';
  if (list.every((s) => s === 'rejected')) return 'rejected';
  if (list.some((s) => s === 'pending_manager_approval')) return 'pending_manager_approval';
  if (list.some((s) => s === 'pending_approval')) return 'pending_approval';
  if (list.some((s) => s === 'approved')) return 'approved';
  return list[0] || 'processed';
}

function single(values: unknown[]) {
  const unique = [...new Set(values.map((value) => clean(value)).filter(Boolean))];
  return unique.length === 1 ? unique[0] : null;
}

function key(parts: unknown[]) {
  return parts.map((part) => normNo(part)).join('|');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: 'Unauthorized' }, 401);
  const { data: profile } = await admin.from('portal_profiles').select('id,role,is_active').eq('auth_user_id', userData.user.id).maybeSingle();
  if (!profile?.is_active || !['admin', 'developer'].includes(profile.role)) return json({ error: 'Access denied' }, 403);

  const body = await req.json().catch(() => ({}));
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const result: Result = { total: rows.length, updated: 0, inserted: 0, skipped: 0, failed: 0, errors: [] };
  const touched = new Map<string, string>();
  const now = new Date().toISOString();

  for (const raw of rows) {
    const orderNo = normNo(raw.finalOrderNo);
    const partNo = normPart(raw.partNo);
    try {
      if (!orderNo || !partNo) { result.skipped += 1; continue; }
      const { data: orders, error: orderError } = await admin.from('portal_orders').select('id,order_no,status').or(`final_order_no.eq.${orderNo},processing_reference.eq.${orderNo},order_no.eq.${orderNo}`).limit(2);
      if (orderError) throw orderError;
      if (!orders?.length || orders.length > 1) { result.skipped += 1; result.errors.push(`${orderNo} / ${partNo}: order match issue`); continue; }
      const order = orders[0];

      const { data: items, error: itemFindError } = await admin.from('portal_order_items').select('id, order_id, part_no, qty, edited_qty, billed_qty, row_status').eq('order_id', order.id).eq('part_no', partNo).order('created_at', { ascending: true });
      if (itemFindError) throw itemFindError;
      const item = ((items ?? []) as ItemRow[]).find((row) => !closedStatuses.has(status(row.row_status))) ?? null;
      if (!item) { result.skipped += 1; result.errors.push(`${orderNo} / ${partNo}: item closed or missing`); continue; }

      const payload = {
        order_id: order.id,
        item_id: item.id,
        order_no: order.order_no,
        part_no: partNo,
        billed_qty: num(raw.billedQty),
        billing_date: clean(raw.invoiceDate) || null,
        order_reg_date: clean(raw.orderRegDate) || null,
        delivery_no: normNo(raw.deliveryNo) || null,
        invoice_no: normNo(raw.invoiceNo) || null,
        docket_no: normNo(raw.docketNo) || null,
        transport_name: clean(raw.transportName) || null,
        transport_mode: normNo(raw.transportMode) || null,
        packing_detail: clean(raw.packingDetail) || null,
        eway_bill_no: normNo(raw.ewayBillNo) || null,
        gst_invoice_no: normNo(raw.gstInvoiceNo) || null,
        raw_status: clean(raw.rawStatus) || null,
        idempotency_key: key([item.id, orderNo, partNo, raw.billedQty, raw.invoiceDate, raw.deliveryNo, raw.invoiceNo, raw.docketNo]),
        source: 'status_report_upload',
        created_by: profile.id,
        updated_at: now,
      };

      const { error: billingError } = await admin.from('portal_order_item_billings').upsert([payload], { onConflict: 'idempotency_key' });
      if (billingError) throw billingError;
      result.inserted += 1;

      const { data: chunks, error: chunkError } = await admin.from('portal_order_item_billings').select('billed_qty, received_qty, order_reg_date, invoice_no, billing_date, docket_no, transport_name').eq('item_id', item.id);
      if (chunkError) throw chunkError;
      const chunkRows = (chunks ?? []) as ChunkRow[];
      const billedTotal = chunkRows.reduce((sum, row) => sum + num(row.billed_qty), 0);
      const receivedTotal = chunkRows.reduce((sum, row) => sum + num(row.received_qty), 0);
      const rowStatus = nextItemStatus(item, billedTotal, receivedTotal);
      const itemUpdate = { billed_qty: billedTotal, received_date: receivedTotal > 0 ? now : null, order_reg_date: single(chunkRows.map((row) => row.order_reg_date)), dbms_invoice_no: single(chunkRows.map((row) => row.invoice_no)), dbms_invoice_date: single(chunkRows.map((row) => row.billing_date)), docket_no: single(chunkRows.map((row) => row.docket_no)), transport_name: single(chunkRows.map((row) => row.transport_name)), row_status: rowStatus, updated_at: now };
      const { error: itemUpdateError } = await admin.from('portal_order_items').update(itemUpdate).eq('id', item.id);
      if (itemUpdateError) throw itemUpdateError;
      touched.set(order.id, order.order_no);
      await admin.from('portal_order_events').insert({ order_id: order.id, event_type: 'STATUS_REPORT_UPDATED', old_status: order.status, new_status: rowStatus, actor_id: profile.id, notes: `Billing updated for ${partNo}.` });
      result.updated += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(`${orderNo || '-'} / ${partNo || '-'}: ${error instanceof Error ? error.message : 'failed'}`);
    }
  }

  for (const [orderId, orderNo] of touched.entries()) {
    try {
      const { data: items, error } = await admin.from('portal_order_items').select('row_status, order_reg_date, dbms_invoice_no, dbms_invoice_date, docket_no, transport_name').eq('order_id', orderId);
      if (error) throw error;
      const orderStatus = nextOrderStatus(items ?? []);
      const updatePayload = { status: orderStatus, order_reg_date: single((items ?? []).map((item) => item.order_reg_date)), dbms_invoice_no: single((items ?? []).map((item) => item.dbms_invoice_no)), dbms_invoice_date: single((items ?? []).map((item) => item.dbms_invoice_date)), docket_no: single((items ?? []).map((item) => item.docket_no)), transport_name: single((items ?? []).map((item) => item.transport_name)), updated_at: now };
      const { error: updateError } = await admin.from('portal_orders').update(updatePayload).eq('id', orderId);
      if (updateError) throw updateError;
      await admin.from('portal_order_events').insert({ order_id: orderId, event_type: 'ORDER_STATUS_RECALCULATED', old_status: null, new_status: orderStatus, actor_id: profile.id, notes: `Order ${orderNo} recalculated.` });
    } catch (error) {
      result.errors.push(`${orderNo}: recalculation failed - ${error instanceof Error ? error.message : 'failed'}`);
    }
  }

  return json(result);
});
