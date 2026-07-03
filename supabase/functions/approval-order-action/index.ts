import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
  if (!profile?.is_active || !['super', 'manager', 'developer'].includes(profile.role)) return json({ error: 'Only active approver can perform this action' }, 403);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');
  const orderId = String(body.orderId ?? '');
  const { data: order, error: orderError } = await adminClient.from('test_orders').select('id,order_no,status').eq('id', orderId).like('order_no', 'TEST-%').maybeSingle();
  if (orderError) return json({ error: orderError.message }, 400);
  if (!order) return json({ error: 'Test order not found' }, 404);
  const now = new Date().toISOString();

  async function event(eventType: string, newStatus: string, notes: string) {
    const { error } = await adminClient.from('test_order_events').insert({ order_id: order.id, event_type: eventType, old_status: order.status, new_status: newStatus, notes });
    if (error) throw error;
  }

  try {
    if (action === 'approve') {
      await adminClient.from('test_orders').update({ status: 'approved', approval_status: 'approved', updated_at: now }).eq('id', order.id).like('order_no', 'TEST-%');
      await adminClient.from('test_order_items').update({ row_status: 'approved', updated_at: now }).eq('order_id', order.id).in('row_status', ['pending_approval', 'pending_manager_approval']);
      await event('ORDER_APPROVED', 'approved', 'Order item rows approved.');
      return json({ ok: true });
    }
    if (action === 'reject') {
      await adminClient.from('test_orders').update({ status: 'rejected', approval_status: 'rejected', updated_at: now }).eq('id', order.id).like('order_no', 'TEST-%');
      await adminClient.from('test_order_items').update({ row_status: 'rejected', updated_at: now }).eq('order_id', order.id).in('row_status', ['pending_approval', 'pending_manager_approval', 'approved']);
      await event('ORDER_REJECTED', 'rejected', 'Order item rows rejected.');
      return json({ ok: true });
    }
    if (action === 'forward_manager') {
      if (!['super', 'developer'].includes(profile.role)) return json({ error: 'Only super or developer can forward to manager' }, 403);
      const managerName = String(body.managerName ?? 'Manager').trim() || 'Manager';
      await adminClient.from('test_orders').update({ status: 'pending_manager_approval', approval_status: 'pending_manager_approval', updated_at: now }).eq('id', order.id).like('order_no', 'TEST-%');
      await adminClient.from('test_order_items').update({ row_status: 'pending_manager_approval', updated_at: now }).eq('order_id', order.id).in('row_status', ['pending_approval', 'approved']);
      await event('SUPER_FORWARDED_MANAGER', 'pending_manager_approval', `Forwarded to ${managerName}.`);
      return json({ ok: true });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Approval action failed' }, 400);
  }
});
