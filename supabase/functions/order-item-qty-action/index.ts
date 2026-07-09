import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function loginIdFromEmail(email: string | null | undefined) {
  const value = String(email ?? '').trim();
  return value.includes('@portal.local') ? value.split('@')[0].trim().toUpperCase() : '';
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

  let { data: profile, error: profileError } = await adminClient
    .from('portal_profiles')
    .select('id,role,is_active')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();
  if (profileError) return json({ error: profileError.message }, 400);

  const loginId = loginIdFromEmail(userData.user.email);
  if (!profile && loginId) {
    const { data: legacyProfile, error: legacyError } = await adminClient
      .from('portal_profiles')
      .select('id,role,is_active')
      .ilike('legacy_user_id', loginId)
      .maybeSingle();
    if (legacyError) return json({ error: legacyError.message }, 400);
    profile = legacyProfile;
  }

  if (!profile?.is_active || !['super', 'manager', 'developer'].includes(profile.role)) return json({ error: 'Access denied' }, 403);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');
  const itemId = String(body.itemId ?? '');
  if (!itemId) return json({ error: 'Item id is required' }, 400);

  const { data: item, error: itemError } = await adminClient.from('portal_order_items').select('id,order_id,dnp').eq('id', itemId).maybeSingle();
  if (itemError) return json({ error: itemError.message }, 400);
  if (!item) return json({ error: 'Item not found' }, 404);
  const { data: order, error: orderError } = await adminClient.from('portal_orders').select('id,order_no,status,approver_id').eq('id', item.order_id).maybeSingle();
  if (orderError) return json({ error: orderError.message }, 400);
  if (!order) return json({ error: 'Order not found' }, 404);
  if (profile.role === 'super' && order.approver_id !== profile.id) return json({ error: 'Selected approver only.' }, 403);

  try {
    if (action === 'set') {
      const qty = Number(body.qty);
      if (!Number.isInteger(qty) || qty < 0) return json({ error: 'Invalid quantity' }, 400);
      const editedValue = Number(item.dnp ?? 0) * qty;
      const { error } = await adminClient.from('portal_order_items').update({ edited_qty: qty, edited_value: editedValue }).eq('id', itemId);
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === 'reset') {
      const { error } = await adminClient.from('portal_order_items').update({ edited_qty: null, edited_value: null }).eq('id', itemId);
      if (error) throw error;
      return json({ ok: true });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Quantity update failed' }, 400);
  }
});
