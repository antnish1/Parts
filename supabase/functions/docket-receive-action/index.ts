import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const normalize = (value: string) => value.trim().replace(/\s+/g, '').toUpperCase().replace(/[^A-Z0-9/_-]/g, '');

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
  const { data: profile } = await adminClient.from('test_profiles').select('role,is_active').eq('auth_user_id', userData.user.id).maybeSingle();
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

    const { data: matchedRows, error: matchError } = await adminClient.from('test_order_items').select('id').eq('order_id', order.id).or(`docket_no.eq.${docket},dbms_invoice_no.eq.${docket}`);
    if (matchError) throw matchError;
    const targetIds = (matchedRows ?? []).map((row) => row.id);
    if (targetIds.length === 0) return json({ error: 'No item rows found for this docket or invoice' }, 404);

    const receivedAt = new Date().toISOString();
    const { error: itemError } = await adminClient.from('test_order_items').update({ row_status: 'received', received_date: receivedAt, updated_at: receivedAt }).in('id', targetIds);
    if (itemError) throw itemError;

    const { data: items, error: itemsError } = await adminClient.from('test_order_items').select('row_status').eq('order_id', order.id);
    if (itemsError) throw itemsError;
    const rows = items ?? [];
    const receivedCount = rows.filter((row) => row.row_status === 'received').length;
    const issuedCount = rows.filter((row) => row.row_status === 'issued').length;
    let nextStatus = 'issued';
    if (rows.length > 0 && receivedCount === rows.length) nextStatus = 'received';
    else if (receivedCount > 0) nextStatus = 'partially_received';
    else if (issuedCount > 0) nextStatus = 'issued';

    const { error: statusError } = await adminClient.from('test_orders').update({ status: nextStatus, updated_at: receivedAt }).eq('id', order.id).like('order_no', 'TEST-%');
    if (statusError) throw statusError;
    await adminClient.from('test_order_events').insert({ order_id: order.id, event_type: 'STATUS_UPDATED', old_status: order.status, new_status: nextStatus, notes: `Marked ${targetIds.length} item row(s) received for docket/invoice ${docket}.`, metadata: { docket_no: docket, item_count: targetIds.length } });
    return json({ ok: true, status: nextStatus, itemCount: targetIds.length });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Docket receive failed' }, 400);
  }
});
