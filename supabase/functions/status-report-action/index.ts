import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const clean = (value: unknown) => String(value ?? '').trim();
const normPart = (value: unknown) => clean(value).replace(/\s+/g, '').toUpperCase();
const normNo = (value: unknown) => clean(value).toUpperCase();
const num = (value: unknown) => Number(value ?? 0);

type Result = { total: number; updated: number; skipped: number; failed: number; errors: string[] };
type HeaderCandidate = { orderRegDate: string | null; value: string | null; dateValue: string | null; transport: string | null; docket: string | null };

function deriveStatus(rows: Array<{ row_status: string | null }>) {
  if (!rows.length) return 'processed';
  const statuses = rows.map((row) => row.row_status ?? '').filter(Boolean);
  const received = statuses.filter((status) => status === 'received').length;
  const issued = statuses.filter((status) => status === 'issued').length;
  const rejected = statuses.filter((status) => status === 'rejected').length;
  if (rejected === rows.length) return 'rejected';
  if (received === rows.length) return 'received';
  if (received > 0) return 'partially_received';
  if (issued === rows.length) return 'issued';
  if (issued > 0) return 'partially_dispatched';
  return 'processed';
}

function singleOrNull(values: unknown[]) {
  const unique = [...new Set(values.map((value) => clean(value)).filter(Boolean))];
  return unique.length === 1 ? unique[0] : null;
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
  const { data: profile, error: profileError } = await adminClient.from('test_profiles').select('id,role,is_active').eq('auth_user_id', userData.user.id).maybeSingle();
  if (profileError) return json({ error: profileError.message }, 400);
  if (!profile?.is_active || !['admin', 'developer'].includes(profile.role)) return json({ error: 'Only active admin or developer can apply status reports' }, 403);

  const body = await req.json().catch(() => ({}));
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const result: Result = { total: rows.length, updated: 0, skipped: 0, failed: 0, errors: [] };
  const touchedOrders = new Map<string, string>();
  const headerCandidates = new Map<string, HeaderCandidate[]>();
  const now = new Date().toISOString();

  for (const rawRow of rows) {
    const finalOrderNo = normNo(rawRow.finalOrderNo);
    const partNo = normPart(rawRow.partNo);
    try {
      if (!finalOrderNo || !partNo) { result.skipped += 1; result.errors.push(`${finalOrderNo || '-'} / ${partNo || '-'}: missing order or part`); continue; }
      const { data: orders, error: orderError } = await adminClient
        .from('test_orders')
        .select('id,order_no,status')
        .or(`final_order_no.eq.${finalOrderNo},processing_reference.eq.${finalOrderNo},order_no.eq.${finalOrderNo}`)
        .like('order_no', 'TEST-%')
        .limit(2);
      if (orderError) throw orderError;
      if (!orders?.length) { result.skipped += 1; result.errors.push(`${finalOrderNo} / ${partNo}: order not found`); continue; }
      if (orders.length > 1) { result.skipped += 1; result.errors.push(`${finalOrderNo} / ${partNo}: multiple orders matched`); continue; }
      const order = orders[0];

      const { data: currentItems, error: currentError } = await adminClient.from('test_order_items').select('id,row_status').eq('order_id', order.id).eq('part_no', partNo);
      if (currentError) throw currentError;
      if (!currentItems?.length) { result.skipped += 1; result.errors.push(`${finalOrderNo} / ${partNo}: item row not found`); continue; }
      if (currentItems.every((item) => item.row_status === 'received')) { result.skipped += 1; result.errors.push(`${finalOrderNo} / ${partNo}: item already received`); continue; }

      const payload = {
        billed_qty: num(rawRow.billedQty),
        order_reg_date: clean(rawRow.orderRegDate) || null,
        dbms_invoice_no: normNo(rawRow.invoiceNo) || null,
        dbms_invoice_date: clean(rawRow.invoiceDate) || null,
        docket_no: normNo(rawRow.docketNo) || null,
        transport_name: clean(rawRow.transportName) || null,
        row_status: 'issued',
        updated_at: now,
      };
      const targetIds = currentItems.filter((item) => item.row_status !== 'received').map((item) => item.id);
      const { error: itemError } = await adminClient.from('test_order_items').update(payload).in('id', targetIds);
      if (itemError) throw itemError;

      touchedOrders.set(order.id, order.order_no);
      const existingHeaders = headerCandidates.get(order.id) ?? [];
      existingHeaders.push({ orderRegDate: payload.order_reg_date, value: payload.dbms_invoice_no, dateValue: payload.dbms_invoice_date, docket: payload.docket_no, transport: payload.transport_name });
      headerCandidates.set(order.id, existingHeaders);
      await adminClient.from('test_order_events').insert({
        order_id: order.id,
        event_type: 'STATUS_REPORT_UPDATED',
        old_status: order.status,
        new_status: 'issued',
        actor_id: profile.id,
        notes: `Status report updated ${partNo} bill ${payload.dbms_invoice_no || '-'}.`,
        metadata: { part_no: partNo, billed_qty: payload.billed_qty, order_reg_date: payload.order_reg_date, bill_no: payload.dbms_invoice_no, billing_date: payload.dbms_invoice_date, docket_no: payload.docket_no, transport_name: payload.transport_name },
      });
      result.updated += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(`${finalOrderNo || '-'} / ${partNo || '-'}: ${error instanceof Error ? error.message : 'failed'}`);
    }
  }

  for (const [orderId, orderNo] of touchedOrders.entries()) {
    try {
      const { data: items, error: itemError } = await adminClient
        .from('test_order_items')
        .select('row_status, order_reg_date, dbms_invoice_no, dbms_invoice_date, docket_no, transport_name')
        .eq('order_id', orderId);
      if (itemError) throw itemError;
      const itemRows = items ?? [];
      const nextStatus = deriveStatus(itemRows);
      const updatePayload = {
        status: nextStatus,
        order_reg_date: singleOrNull(itemRows.map((item) => item.order_reg_date)),
        dbms_invoice_no: singleOrNull(itemRows.map((item) => item.dbms_invoice_no)),
        dbms_invoice_date: singleOrNull(itemRows.map((item) => item.dbms_invoice_date)),
        docket_no: singleOrNull(itemRows.map((item) => item.docket_no)),
        transport_name: singleOrNull(itemRows.map((item) => item.transport_name)),
        updated_at: now,
      };
      const { error: statusError } = await adminClient.from('test_orders').update(updatePayload).eq('id', orderId).like('order_no', 'TEST-%');
      if (statusError) throw statusError;
      await adminClient.from('test_order_events').insert({
        order_id: orderId,
        event_type: 'ORDER_STATUS_RECALCULATED',
        old_status: null,
        new_status: nextStatus,
        actor_id: profile.id,
        notes: `Order ${orderNo} recalculated after status upload. Header fields synced when bill/docket values are unique.`,
        metadata: { header_candidates: headerCandidates.get(orderId) ?? [], synced_header: updatePayload },
      });
    } catch (error) {
      result.errors.push(`${orderNo}: status recalculation failed - ${error instanceof Error ? error.message : 'failed'}`);
    }
  }

  return json(result);
});
