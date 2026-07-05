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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: sessionData, error: sessionError } = await userClient.auth.getUser();
  if (sessionError || !sessionData.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { data: callerProfile, error: profileError } = await adminClient
    .from('test_profiles')
    .select('role, is_active')
    .eq('auth_user_id', sessionData.user.id)
    .maybeSingle();
  if (profileError) return new Response(JSON.stringify({ error: profileError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (callerProfile?.role !== 'developer' || callerProfile?.is_active !== true) return new Response(JSON.stringify({ error: 'Only active developer users can create portal users.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const body = await req.json() as Payload;
  const loginId = normalizeLoginId(String(body.loginId ?? ''));
  const email = String(body.email ?? '').trim().toLowerCase() || (loginId ? `${loginId.toLowerCase()}@portal.local` : '');
  const password = String(body.password ?? '');
  const fullName = String(body.fullName ?? '').trim();
  const branch = String(body.branch ?? '').trim();
  const role = String(body.role ?? '').trim();

  if (!email || !password || !fullName || !branch || !role) return new Response(JSON.stringify({ error: 'Email, password, name, branch and role are required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (!roles.includes(role)) return new Response(JSON.stringify({ error: 'Invalid role.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (password.length < 8) return new Response(JSON.stringify({ error: 'Password must be at least 8 characters.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (authError || !authData.user) return new Response(JSON.stringify({ error: authError?.message ?? 'User creation failed.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { error: insertError } = await adminClient.from('test_profiles').insert({ auth_user_id: authData.user.id, full_name: fullName, branch, role, login_id: loginId || null, is_active: true });
  if (insertError) return new Response(JSON.stringify({ error: insertError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify({ ok: true, userId: authData.user.id, loginId: loginId || null }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
