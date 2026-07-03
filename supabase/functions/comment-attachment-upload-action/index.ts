import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'test_order_comment_attachments';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES_PER_COMMENT = 5;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/csv',
]);

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const clean = (value: unknown) => String(value ?? '').trim();

type Profile = { id: string; role: string; branch: string; is_active: boolean };
type OrderRow = { id: string; order_no: string; branch: string; approver_id: string | null };

function canAccessOrder(profile: Profile, order: OrderRow) {
  if (['developer', 'manager', 'admin'].includes(profile.role)) return true;
  if (profile.role === 'super') return true;
  if (profile.role === 'branch') return order.branch === profile.branch;
  return false;
}

function sanitizeFileName(name: string) {
  return clean(name)
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-zA-Z0-9._ -]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'attachment';
}

function timestampKey() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
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
  if (!['developer', 'manager', 'admin', 'super', 'branch'].includes(profile.role)) return json({ error: 'This role cannot upload attachments.' }, 403);

  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: 'Invalid form data.' }, 400);

  const orderId = clean(form.get('orderId'));
  const commentId = clean(form.get('commentId'));
  const file = form.get('file');
  if (!orderId || !commentId) return json({ error: 'Order and comment are required.' }, 400);
  if (!(file instanceof File)) return json({ error: 'Attachment file is required.' }, 400);
  if (file.size <= 0) return json({ error: 'Attachment file is empty.' }, 400);
  if (file.size > MAX_FILE_SIZE) return json({ error: 'Attachment must be 10 MB or smaller.' }, 400);
  if (!ALLOWED_MIME_TYPES.has(file.type)) return json({ error: 'This attachment file type is not allowed.' }, 400);

  const { data: order, error: orderError } = await adminClient
    .from('test_orders')
    .select('id, order_no, branch, approver_id')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) return json({ error: orderError.message }, 400);
  if (!order) return json({ error: 'Order not found.' }, 404);
  if (!canAccessOrder(profile as Profile, order as OrderRow)) return json({ error: 'You do not have access to this order.' }, 403);

  const { data: comment, error: commentError } = await adminClient
    .from('test_order_comments')
    .select('id, order_id')
    .eq('id', commentId)
    .eq('order_id', orderId)
    .maybeSingle();
  if (commentError) return json({ error: commentError.message }, 400);
  if (!comment) return json({ error: 'Comment not found for this order.' }, 404);

  const { count, error: countError } = await adminClient
    .from('test_order_comment_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('comment_id', commentId)
    .is('deleted_at', null);
  if (countError) return json({ error: countError.message }, 400);
  if ((count ?? 0) >= MAX_FILES_PER_COMMENT) return json({ error: `Only ${MAX_FILES_PER_COMMENT} files are allowed per comment.` }, 400);

  const safeFileName = sanitizeFileName(file.name);
  const objectPath = `orders/${orderId}/comments/${commentId}/${timestampKey()}_${crypto.randomUUID()}_${safeFileName}`;

  const { error: uploadError } = await adminClient.storage.from(BUCKET).upload(objectPath, file, { contentType: file.type, upsert: false });
  if (uploadError) return json({ error: uploadError.message }, 400);

  const { data: attachment, error: insertError } = await adminClient
    .from('test_order_comment_attachments')
    .insert({
      order_id: orderId,
      comment_id: commentId,
      bucket_name: BUCKET,
      object_path: objectPath,
      original_file_name: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      uploaded_by: profile.id,
    })
    .select('id, order_id, comment_id, original_file_name, mime_type, file_size_bytes, created_at')
    .single();

  if (insertError) {
    await adminClient.storage.from(BUCKET).remove([objectPath]);
    return json({ error: insertError.message }, 400);
  }

  await adminClient.from('test_order_events').insert({
    order_id: orderId,
    event_type: 'COMMENT_ATTACHMENT_ADDED',
    actor_id: profile.id,
    notes: `Attachment added to ${order.order_no}: ${file.name}`,
    metadata: { commentId, attachmentId: attachment.id, fileName: file.name },
  });

  return json({ attachment });
});
