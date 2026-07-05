import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const normalize = (value: string) => value.trim().replace(/\s+/g, '').toUpperCase().replace(/[^A-Z0-9/_-]/g, '');
const num = (value: unknown) => {
  const parsed = Number(String(value ?? 0).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

type ItemRow = { id: string; order_id: string; qty: number | string | null; edited_qty: number | string | null; billed_qty: number | string | null; row_status: string | null };
type ChunkRow = { id: string; item_id: string; billed_qty: number | string | null; received_qty: number | string | null };

function effectiveQty(row: ItemRow) {
  const edited = row.edited_qty;
  if (edited !== null && edited !== undefined && edited !== '') return Math.max(0, num(edited));
  return Math.max(0, num(row.qty));
}

function normalizeStatus(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function itemStatus(item: ItemRow, billedTotal: number, receivedTotal: number) {
  const current = normalizeStatus(item.row_status);
  if (current === 'rejected') return 'rejected';
  const qty = effectiveQty(item);
  if (receivedTotal > 0) {
    if (qty <= 0 || receivedTotal >= qty) return 'received';
    return 'partially_received';
  }
  if (billedTotal > 0) {
    if (qty <= 0 || billedTotal >= qty) return 'dispatched';
    return 'partially_dispatched';
  }
  return 'processed';
}

function orderStatus(rows: Array<{ row_status: string | null }>) {
  const statuses = rows.map((row) => normalizeStatus(row.row_status)).filter(Boolean);
  if (!statuses.length) return 'processed';
  if (statuses.every((status) => status === 'received')) return 'received';
  if (statuses.some((status) => status === 'received' || status === 'partially_received')) return 'partially_received';
  if (statuses.every((status) => status === 'dispatched')) return 'dispatched';
  if (statuses.some((status) => status === 'dispatched' || status === 'partially_dispatched')) return 'partially_dispatched';
  if (statuses.every((status) => status === 'rejected')) return 'rejected';
  if (statuses.some((status) => status === 'rejected')) return 'partially_rejected';
  if (statuses.every((status) => status === 'processed')) return 'processed';
  if (statuses.some((status) => status === 'processed')) return 'processed';
  return statuses[0] || 'processed';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: 'Unauthorized' }, 401);
  const { data: profile } = await adminClient.from('test_profiles').select('id,role,is_active').eq('auth_user_id', userData.user.id).maybeSingle();
  if (!profile?.is_active || !['admin', 'developer'].includes(profile.role)) return json({ error: 'Only active admin or developer can receive dockets' }, 403);

  const body = await req.json().catch(() => ({}));
  const orderId = String(body.orderId ?? '');
  const docket = normalize(String(body.docketNo ?? ''));
  if (!orderId) return json({ error: 'Order id is required' }, 400);
  if (!docket) return json({ error: 'Docket or invoice number is required' }, 400);

  try {
    const { data: order, error: orderError } = await adminClient.from('test_orders').select('id,order_no,status').eq('id', orderId).like('order_no', 'TEST-%').maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json({ error: 'Test order not found' }, 404);
    if (order.status === 'received') return json({ error: 'Order is already fully received' }, 400);

    const receivedAt = new Date().toISOString();
    const { data: chunks, error: chunkError } = await adminClient
      .from('test_order_item_billings')
      .select('id, item_id, billed_qty, received_qty')
      .eq('order_id', order.id)
      .or(`docket_no.eq.${docket},invoice_no.eq.${docket}`);
    if (chunkError) throw chunkError;

    const chunkRows = (chunks ?? []) as ChunkRow[];
    if (!chunkRows.length) return json({ error: 'No billing chunk found for this docket or invoice' }, 404);

    for (const chunk of chunkRows) {
      const { error: updateChunkError } = await adminClient
        .from('test_order_item_billings')
        .update({ received_qty: num(chunk.billed_qty), received_at: receivedAt, received_by: profile.id, updated_at: receivedAt })
        .eq('id', chunk.id);
      if (updateChunkError) throw updateChunkError;
    }

    const itemIds = [...new Set(chunkRows.map((chunk) => chunk.item_id))];
    const { data: targetItems, error: targetError } = await adminClient
      .from('test_order_items')
      .select('id, order_id, qty, edited_qty, billed_qty, row_status')
      .eq('order_id', order.id)
      .in('id', itemIds);
    if (targetError) throw targetError;

    for (const item of (targetItems ?? []) as ItemRow[]) {
      const { data: itemChunks, error: itemChunkError } = await adminClient
        .from('test_order_item_billings')
        .select('billed_qty, received_qty')
        .eq('item_id', item.id);
      if (itemChunkError) throw itemChunkError;
      const billedTotal = (itemChunks ?? []).reduce((sum, row) => sum + num(row.billed_qty), 0);
      const receivedTotal = (itemChunks ?? []).reduce((sum, row) => sum + num(row.received_qty), 0);
      const nextItemStatus = itemStatus(item, billedTotal, receivedTotal);
      const { error: itemUpdateError } = await adminClient
        .from('test_order_items')
        .update({ billed_qty: billedTotal, row_status: nextItemStatus, received_date: receivedTotal > 0 ? receivedAt : null, updated_at: receivedAt })
        .eq('id', item.id);
      if (itemUpdateError) throw itemUpdateError;
    }

    const { data: allRows, error: rowsError } = await adminClient.from('test_order_items').select('row_status').eq('order_id', order.id);
    if (rowsError) throw rowsError;
    const nextOrderStatus = orderStatus(allRows ?? []);

    const { error: statusError } = await adminClient.from('test_orders').update({ status: nextOrderStatus, received_date: nextOrderStatus === 'received' ? receivedAt : null, updated_at: receivedAt }).eq('id', order.id).like('order_no', 'TEST-%');
    if (statusError) throw statusError;
    await adminClient.from('test_order_events').insert({ order_id: order.id, event_type: 'STATUS_UPDATED', old_status: order.status, new_status: nextOrderStatus, actor_id: profile.id, notes: `Received ${chunkRows.length} billing chunk(s) for docket/invoice ${docket}.`, metadata: { docket_no: docket, chunk_count: chunkRows.length, item_count: itemIds.length } });
    return json({ ok: true, status: nextOrderStatus, itemCount: itemIds.length, chunkCount: chunkRows.length });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Docket receive failed' }, 400);
  }
});
