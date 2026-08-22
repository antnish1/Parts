import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const fail = (message: string, code = 'PART_LOCATION_FAILED', status = 400) => json({ ok: false, error: message, code }, status);
const WRITE_ROLES = new Set(['manager', 'admin', 'developer']);

const clean = (value: unknown) => String(value ?? '').trim();
const normalizePartNo = (value: unknown) => clean(value).replace(/\s+/g, '').toUpperCase();
const normalizeLocation = (value: unknown) => clean(value).replace(/\s+/g, ' ').toUpperCase();

function errorMessage(error: unknown) {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? '');
  return String(error);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('Method not allowed.', 'METHOD_NOT_ALLOWED', 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData.user;
    if (userError || !user) return fail('Unauthorized. Please logout and login again.', 'UNAUTHORIZED', 401);

    const { data: profile } = await adminClient
      .from('portal_profiles')
      .select('id, role, is_active')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    const body = await req.json().catch(() => ({}));
    const action = clean(body.action).toLowerCase() || 'lookup';

    if (action === 'lookup') {
      const partNoNormalized = normalizePartNo(body.partNo);
      if (!partNoNormalized) return fail('Part number is required.', 'PART_NO_REQUIRED');

      const { data, error } = await adminClient
        .from('part_locations')
        .select('id, part_no, location, created_at, updated_at')
        .eq('part_no_normalized', partNoNormalized)
        .eq('is_active', true)
        .order('location', { ascending: true });

      if (error) throw error;
      return json({ ok: true, partNo: partNoNormalized, locations: data ?? [] });
    }

    if (action === 'suggest') {
      const term = clean(body.query);
      if (term.length < 1) return json({ ok: true, locations: [] });

      const { data, error } = await adminClient
        .from('part_locations')
        .select('location, location_normalized')
        .eq('is_active', true)
        .ilike('location', `%${term}%`)
        .order('location', { ascending: true })
        .limit(50);

      if (error) throw error;
      const seen = new Set<string>();
      const locations = (data ?? [])
        .filter((row) => {
          const key = String(row.location_normalized ?? '').trim();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 12)
        .map((row) => String(row.location));

      return json({ ok: true, locations });
    }

    const role = clean(profile?.role).toLowerCase();
    if (!profile?.is_active || !WRITE_ROLES.has(role)) {
      return fail('You do not have permission to maintain part locations.', 'FORBIDDEN', 403);
    }

    if (action === 'add') {
      const partNo = clean(body.partNo).toUpperCase();
      const partNoNormalized = normalizePartNo(partNo);
      const location = clean(body.location).replace(/\s+/g, ' ');
      const locationNormalized = normalizeLocation(location);
      if (!partNoNormalized) return fail('Part number is required.', 'PART_NO_REQUIRED');
      if (!locationNormalized) return fail('Location is required.', 'LOCATION_REQUIRED');

      const { data: existing, error: existingError } = await adminClient
        .from('part_locations')
        .select('id, part_no, location')
        .eq('part_no_normalized', partNoNormalized)
        .eq('location_normalized', locationNormalized)
        .eq('is_active', true)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) return fail('This location is already assigned to the part.', 'DUPLICATE_LOCATION', 409);

      const { data, error } = await adminClient
        .from('part_locations')
        .insert({
          part_no: partNo,
          part_no_normalized: partNoNormalized,
          location,
          location_normalized: locationNormalized,
          created_by: user.id,
          updated_by: user.id,
        })
        .select('id, part_no, location, created_at, updated_at')
        .single();

      if (error) throw error;
      return json({ ok: true, location: data });
    }

    if (action === 'deactivate') {
      const id = clean(body.id);
      if (!id) return fail('Location record id is required.', 'LOCATION_ID_REQUIRED');

      const { data, error } = await adminClient
        .from('part_locations')
        .update({ is_active: false, updated_by: user.id, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('is_active', true)
        .select('id, part_no, location')
        .maybeSingle();

      if (error) throw error;
      if (!data) return fail('Location record was not found or is already inactive.', 'LOCATION_NOT_FOUND', 404);
      return json({ ok: true, location: data });
    }

    return fail('Unsupported action.', 'UNSUPPORTED_ACTION');
  } catch (error) {
    return fail(errorMessage(error) || 'Part location action failed.', 'PART_LOCATION_FAILED', 500);
  }
});
