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
  const { data: profile } = await adminClient.from('test_profiles').select('id,full_name,role,is_active').eq('auth_user_id', userData.user.id).maybeSingle();
  if (!profile?.is_active || !['super', 'manager', 'developer'].includes(profile.role)) return json({ error: 'Only active approver can perform this action' }, 403);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');
  const orderId = String(body.orderId ?? '');
  const { data: order, error: orderError } = await adminClient
    .from('test_orders')
    .select('id,order_no,status,approver_id')
    .eq('id', orderId)
    .like('order_no', 'TEST-%')
    .maybeSingle();
  if (orderError) return json({ error: orderError.message }, 400);
  if (!order) return json({ error: 'Test order not found' }, 404);

  const { data: approver } = order.approver_id
    ? await adminClient.from('test_profiles').select('id,full_name,role').eq('id', order.approver_id).maybeSingle()
    : { data: null };
  const now = new Date().toISOString();

  async function event(eventType: string, newStatus: string, notes: string) {
    const { error } = await adminClient.from('test_order_events').insert({ order_id: order.id, event_type: eventType, old_status: order.status, new_status: newStatus, actor_id: profile.id, notes });
    if (error) throw error;
  }

  async function updateOrder(status: string, approvalStatus: string) {
    const { error } = await adminClient.from('test_orders').update({ status, approval_status: approvalStatus, updated_at: now }).eq('id', order.id).like('order_no', 'TEST-%');
    if (error) throw error;
  }

  async function updateItems(rowStatus: string) {
    const { error } = await adminClient.from('test_order_items').update({ row_status: rowStatus, updated_at: now }).eq('order_id', order.id);
    if (error) throw error;
  }

  function isSelectedApprover() {
    return order.approver_id && order.approver_id === profile.id;
  }

  async function approveByManager(eventType = 'MANAGER_APPROVED') {
    if (!['manager', 'developer'].includes(profile.role)) return json({ error: 'Only manager or developer can approve this order' }, 403);
    await updateOrder('approved', 'approved');
    await updateItems('approved');
    await event(eventType, 'approved', `Manager approved order item rows. Original approver: ${approver?.full_name || '-'}.`);
    return json({ ok: true });
  }

  async function rejectByManager() {
    if (!['manager', 'developer'].includes(profile.role)) return json({ error: 'Only manager or developer can reject this order' }, 403);
    await updateOrder('rejected', 'rejected');
    await updateItems('rejected');
    await event('MANAGER_REJECTED', 'rejected', `Manager rejected order item rows. Original approver: ${approver?.full_name || '-'}.`);
    return json({ ok: true });
  }

  try {
    if (action === 'approve') {
      if (profile.role === 'manager') return await approveByManager('MANAGER_DIRECT_APPROVED');
      if (profile.role !== 'developer' && !isSelectedApprover()) return json({ error: 'Only the selected super approver can approve this order.' }, 403);
      await updateOrder('pending_manager_approval', 'pending_manager_approval');
      await updateItems('pending_manager_approval');
      await event('SUPER_APPROVED_PENDING_MANAGER', 'pending_manager_approval', `Approved by ${profile.full_name || 'super'}; pending manager approval.`);
      return json({ ok: true });
    }
    if (action === 'reject') {
      if (profile.role === 'manager' || profile.role === 'developer') return await rejectByManager();
      if (profile.role === 'super' && !isSelectedApprover()) return json({ error: 'Only the selected super approver can reject this order.' }, 403);
      await updateOrder('rejected', 'rejected');
      await updateItems('rejected');
      await event('ORDER_REJECTED', 'rejected', 'Order item rows rejected.');
      return json({ ok: true });
    }
    if (action === 'forward_manager') {
      if (profile.role !== 'developer' && !isSelectedApprover()) return json({ error: 'Only the selected super approver can forward this order to manager.' }, 403);
      const managerName = String(body.managerName ?? 'Manager').trim() || 'Manager';
      await updateOrder('pending_manager_approval', 'pending_manager_approval');
      await updateItems('pending_manager_approval');
      await event('SUPER_FORWARDED_MANAGER', 'pending_manager_approval', `Forwarded to ${managerName}.`);
      return json({ ok: true });
    }
    if (action === 'manager_approve') {
      return await approveByManager('MANAGER_APPROVED');
    }
    if (action === 'manager_reject') {
      return await rejectByManager();
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Approval action failed' }, 400);
  }
});
