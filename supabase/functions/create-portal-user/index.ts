import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const roles = ['branch', 'admin', 'super', 'manager', 'viewer', 'developer'];

type Payload = {
  email?: string;
  password?: string;
  fullName?: string;
  branch?: string;
  role?: string;
  loginId?: string;
};

function normalizeLoginId(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

  const { data: callerProfile, error: profileError } = await adminClient
    .from('portal_profiles')
    .select('role, is_active')
    .eq('auth_user_id', sessionData.user.id)
    .maybeSingle();
  if (profileError) return json({ error: profileError.message }, 500);
  if (callerProfile?.role !== 'developer' || callerProfile?.is_active !== true) return json({ error: 'Only active developer users can create portal users.' }, 403);

  const body = await req.json() as Payload;
  const loginId = normalizeLoginId(String(body.loginId ?? ''));
  const email = loginId ? `${loginId.toLowerCase()}@portal.local` : String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '').trim();
  const fullName = String(body.fullName ?? '').trim();
  const branch = String(body.branch ?? '').trim();
  const role = String(body.role ?? '').trim();

  if (!email || !password || !fullName || !branch || !role) return json({ error: 'User ID or email, password, name, branch and role are required.' }, 400);
  if (!roles.includes(role)) return json({ error: 'Invalid role.' }, 400);
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);

  if (loginId) {
    const { data: existingLogin, error: loginError } = await adminClient
      .from('portal_profiles')
      .select('id')
      .ilike('legacy_user_id', loginId)
      .limit(1);
    if (loginError) return json({ error: loginError.message }, 400);
    if (existingLogin?.length) return json({ error: 'This User ID is already assigned. Please use another User ID.' }, 400);
  }

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (authError || !authData.user) {
    return json({ error: authError?.message ?? 'User creation failed. If this Auth user was already created without profile, delete it from Supabase Authentication and create it again.' }, 400);
  }

  const { error: insertError } = await adminClient.from('portal_profiles').insert({
    auth_user_id: authData.user.id,
    full_name: fullName,
    branch,
    role,
    legacy_user_id: loginId || email,
    legacy_name: fullName,
    is_active: true,
  });
  if (insertError) {
    await adminClient.auth.admin.deleteUser(authData.user.id);
    return json({ error: `Profile creation failed, so Auth user was rolled back. ${insertError.message}` }, 400);
  }

  return json({ ok: true, userId: authData.user.id, loginId: loginId || null });
});
