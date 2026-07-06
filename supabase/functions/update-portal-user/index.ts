import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const roles = ['branch', 'admin', 'super', 'manager', 'viewer', 'developer'];

type Payload = {
  profileId?: string;
  fullName?: string;
  branch?: string;
  role?: string;
  loginId?: string;
  isActive?: boolean;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function normalizeLoginId(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: sessionData, error: sessionError } = await userClient.auth.getUser();
  if (sessionError || !sessionData.user) return json({ error: 'Unauthorized' }, 401);

  const { data: callerProfile, error: callerError } = await adminClient
    .from('portal_profiles')
    .select('role, is_active')
    .eq('auth_user_id', sessionData.user.id)
    .maybeSingle();
  if (callerError) return json({ error: callerError.message }, 500);
  if (callerProfile?.role !== 'developer' || callerProfile?.is_active !== true) return json({ error: 'Only active developer users can edit portal users.' }, 403);

  const body = await req.json() as Payload;
  const profileId = String(body.profileId ?? '').trim();
  const fullName = String(body.fullName ?? '').trim();
  const branch = String(body.branch ?? '').trim();
  const role = String(body.role ?? '').trim();
  const loginId = normalizeLoginId(String(body.loginId ?? ''));
  const isActive = body.isActive !== false;

  if (!profileId || !fullName || !branch || !role) return json({ error: 'Profile ID, name, branch and role are required.' }, 400);
  if (!roles.includes(role)) return json({ error: 'Invalid role.' }, 400);

  const { data: existingProfile, error: profileError } = await adminClient
    .from('portal_profiles')
    .select('id, auth_user_id')
    .eq('id', profileId)
    .maybeSingle();
  if (profileError) return json({ error: profileError.message }, 500);
  if (!existingProfile) return json({ error: 'Profile was not found.' }, 404);

  if (loginId) {
    const { data: duplicateLogin, error: loginError } = await adminClient
      .from('portal_profiles')
      .select('id')
      .ilike('legacy_user_id', loginId)
      .neq('id', profileId)
      .limit(1);
    if (loginError) return json({ error: loginError.message }, 400);
    if (duplicateLogin?.length) return json({ error: 'This User ID is already assigned. Please use another User ID.' }, 400);
  }

  const { data: updatedProfile, error: updateError } = await adminClient
    .from('portal_profiles')
    .update({ full_name: fullName, legacy_name: fullName, branch, role, legacy_user_id: loginId || null, is_active: isActive })
    .eq('id', profileId)
    .select('id, auth_user_id, full_name, branch, role, login_id:legacy_user_id, is_active')
    .maybeSingle();
  if (updateError) return json({ error: updateError.message }, 400);
  if (!updatedProfile) return json({ error: 'Profile update did not affect any row.' }, 400);

  if (updatedProfile.auth_user_id) {
    const userUpdate: Record<string, unknown> = {
      user_metadata: { full_name: fullName, branch, role, login_id: loginId || null, legacy_user_id: loginId || null },
    };
    if (loginId) userUpdate.email = `${loginId.toLowerCase()}@portal.local`;

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(updatedProfile.auth_user_id, userUpdate);
    if (authUpdateError) return json({ error: `Profile was updated but Auth update failed: ${authUpdateError.message}` }, 400);
  }

  return json({ ok: true, profile: updatedProfile });
});
