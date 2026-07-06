import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function nextStatus(rows: Array<{ row_status: string | null }>) {
  if (!rows.length) return 'processed';
  const s = rows.map((row) => row.row_status ?? '');
  const received = s.filter((x) => x === 'received').length;
  const issued = s.filter((x) => x === 'issued').length;
  const rejected = s.filter((x) => x === 'rejected').length;
  if (rejected === rows.length) return 'rejected';
  if (received === rows.length) return 'received';
  if (received > 0) return 'partially_received';
  if (issued === rows.length) return 'issued';
  if (issued > 0) return 'partially_dispatched';
  return 'processed';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, service);
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: 'Unauthorized' }, 401);
  const { data: profile } = await admin.from('portal_profiles').select('id,role,is_active').eq('auth_user_id', userData.user.id).maybeSingle();
  if (!profile?.is_active || !['admin', 'developer'].includes(profile.role)) return json({ error: 'Only active admin or developer can issue items' }, 403);

  const body = await req.json().catch(() => ({}));
  const orderId = String(body.orderId ?? '');
  const itemIds = Array.isArray(body.itemIds) ? body.itemIds.map((id) => String(id)).filter(Boolean) : [];
  const invoiceNo = String(body.invoiceNo ?? '').trim().toUpperCase();
  const invoiceDate = String(body.invoiceDate ?? '').trim();
  const docketNo = String(body.docketNo ?? '').trim().toUpperCase();
  const transportName = String(body.transportName ?? '').trim();
  if (!orderId) return json({ error: 'Order id is required' }, 400);
  if (!invoiceNo) return json({ error: 'Invoice number is required' }, 400);
  if (!invoiceDate) return json({ error: 'Invoice date is required' }, 400);
  if (itemIds.length === 0) return json({ error: 'Select at least one item row to issue' }, 400);

  try {
    const { data: order, error: orderError } = await admin.from('portal_orders').select('id,order_no,status,order_for').eq('id', orderId).maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json({ error: 'Portal order not found' }, 404);
    if (order.order_for !== 'Customer') return json({ error: 'Only customer orders can be marked issued' }, 400);
    const { data: selected, error: selectedError } = await admin.from('portal_order_items').select('id,row_status').eq('order_id', order.id).in('id', itemIds);
    if (selectedError) throw selectedError;
    const targetIds = (selected ?? []).filter((row) => row.row_status !== 'received' && row.row_status !== 'issued').map((row) => row.id);
    if (targetIds.length === 0) return json({ error: 'Selected item rows are already received or issued, or were not found' }, 400);
    const now = new Date().toISOString();
    const { error: issueError } = await admin.from('portal_order_items').update({ dbms_invoice_no: invoiceNo, dbms_invoice_date: invoiceDate, docket_no: docketNo || null, transport_name: transportName || null, row_status: 'issued', updated_at: now }).in('id', targetIds);
    if (issueError) throw issueError;
    const { data: allRows, error: rowsError } = await admin.from('portal_order_items').select('row_status').eq('order_id', order.id);
    if (rowsError) throw rowsError;
    const status = nextStatus(allRows ?? []);
    const { error: orderUpdateError } = await admin.from('portal_orders').update({ status, updated_at: now }).eq('id', order.id);
    if (orderUpdateError) throw orderUpdateError;
    await admin.from('portal_order_events').insert({ order_id: order.id, event_type: 'ORDER_ISSUED', old_status: order.status, new_status: status, actor_id: profile.id, notes: `Issued ${targetIds.length} selected item row(s) with invoice ${invoiceNo}.` });
    return json({ ok: true, status, itemCount: targetIds.length });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Selected item issue failed' }, 400);
  }
});
