import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
  const { data: profile } = await admin.from('test_profiles').select('role,is_active,full_name').eq('auth_user_id', userData.user.id).maybeSingle();
  if (!profile?.is_active || !['super', 'manager', 'developer'].includes(profile.role)) return json({ error: 'Only active approvers can perform review actions' }, 403);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');
  const orderId = String(body.orderId ?? '');
  const itemId = String(body.itemId ?? '');
  const now = new Date().toISOString();

  try {
    if (action === 'zero_item') {
      if (!itemId) return json({ error: 'Item id is required' }, 400);
      const { data: item, error: itemError } = await admin.from('test_order_items').select('id,order_id,part_no').eq('id', itemId).maybeSingle();
      if (itemError) throw itemError;
      if (!item) return json({ error: 'Item row not found' }, 404);
      const { data: order, error: orderError } = await admin.from('test_orders').select('id,order_no,status').eq('id', item.order_id).like('order_no', 'TEST-%').maybeSingle();
      if (orderError) throw orderError;
      if (!order) return json({ error: 'Test order not found' }, 404);
      const { error } = await admin.from('test_order_items').update({ edited_qty: 0, edited_value: 0, updated_at: now }).eq('id', item.id);
      if (error) throw error;
      await admin.from('test_order_events').insert({ order_id: order.id, event_type: 'REVIEW_QTY_ZEROED', old_status: order.status, new_status: order.status, notes: `${profile.full_name || profile.role} set ${item.part_no} review quantity to 0.` });
      return json({ ok: true });
    }

    if (!orderId) return json({ error: 'Order id is required' }, 400);
    const { data: order, error: orderError } = await admin.from('test_orders').select('id,order_no,status').eq('id', orderId).like('order_no', 'TEST-%').maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json({ error: 'Test order not found' }, 404);

    if (action === 'accept_edits') {
      await admin.from('test_order_events').insert({ order_id: order.id, event_type: 'REVIEW_EDITS_ACCEPTED', old_status: order.status, new_status: order.status, notes: `${profile.full_name || profile.role} accepted saved review quantities.` });
      return json({ ok: true });
    }

    if (action === 'approve_original') {
      const { error: itemError } = await admin.from('test_order_items').update({ edited_qty: null, edited_value: null, row_status: 'approved', updated_at: now }).eq('order_id', order.id);
      if (itemError) throw itemError;
      const { error: orderUpdateError } = await admin.from('test_orders').update({ status: 'approved', approval_status: 'approved', updated_at: now }).eq('id', order.id).like('order_no', 'TEST-%');
      if (orderUpdateError) throw orderUpdateError;
      await admin.from('test_order_events').insert({ order_id: order.id, event_type: 'REVIEW_ORIGINAL_APPROVED', old_status: order.status, new_status: 'approved', notes: `${profile.full_name || profile.role} approved with original quantities.` });
      return json({ ok: true, status: 'approved' });
    }

    return json({ error: 'Unknown review action' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Review action failed' }, 400);
  }
});
