import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SIGNED_URL_SECONDS = 300;
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const clean = (value: unknown) => String(value ?? '').trim();

type Profile = { id: string; role: string; branch: string; is_active: boolean };
type OrderRow = { id: string; branch: string; approver_id: string | null };

function canAccessOrder(profile: Profile, order: OrderRow) {
  if (['developer', 'manager', 'admin', 'viewer'].includes(profile.role)) return true;
  if (profile.role === 'super') return true;
  if (profile.role === 'branch') return order.branch === profile.branch;
  return false;
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

  const { data: profile, error: profileError } = await adminClient
    .from('test_profiles')
    .select('id, role, branch, is_active')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();
  if (profileError) return json({ error: profileError.message }, 400);
  if (!profile?.is_active) return json({ error: 'Active profile is required.' }, 403);

  const body = await req.json().catch(() => ({}));
  const attachmentId = clean(body.attachmentId);
  if (!attachmentId) return json({ error: 'Attachment is required.' }, 400);

  const { data: attachment, error: attachmentError } = await adminClient
    .from('test_order_comment_attachments')
    .select('id, order_id, bucket_name, object_path, original_file_name, deleted_at')
    .eq('id', attachmentId)
    .maybeSingle();
  if (attachmentError) return json({ error: attachmentError.message }, 400);
  if (!attachment || attachment.deleted_at) return json({ error: 'Attachment not found.' }, 404);

  const { data: order, error: orderError } = await adminClient
    .from('test_orders')
    .select('id, branch, approver_id')
    .eq('id', attachment.order_id)
    .maybeSingle();
  if (orderError) return json({ error: orderError.message }, 400);
  if (!order) return json({ error: 'Order not found.' }, 404);
  if (!canAccessOrder(profile as Profile, order as OrderRow)) return json({ error: 'You do not have access to this attachment.' }, 403);

  const { data: signed, error: signedError } = await adminClient.storage
    .from(attachment.bucket_name)
    .createSignedUrl(attachment.object_path, SIGNED_URL_SECONDS, { download: attachment.original_file_name });
  if (signedError) return json({ error: signedError.message }, 400);

  return json({ signedUrl: signed.signedUrl, expiresIn: SIGNED_URL_SECONDS, fileName: attachment.original_file_name });
});
