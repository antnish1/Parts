import { supabase } from '../lib/supabase';

type ProfileRow = { id?: string | null; role: string | null; branch: string | null; is_active: boolean | null };

export function normalizeBranchKey(value: string | null | undefined) {
  return (value || '').trim().replace(/[\s_-]+/g, '').toUpperCase();
}

function normalizeRole(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

function toList(values: Set<string>) {
  return [...values].map((value) => value.trim()).filter(Boolean);
}

function loginIdFromEmail(email: string | null | undefined) {
  const value = email ?? '';
  return value.includes('@portal.local') ? value.split('@')[0].trim().toUpperCase() : '';
}

export async function getCurrentPortalProfile(): Promise<ProfileRow | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return null;

  const { data: profile, error: profileError } = await supabase
    .from('portal_profiles')
    .select('id, role, branch, is_active')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (profileError) {
    console.warn('Portal profile lookup failed.', profileError.message);
  }

  if (profile) return profile as ProfileRow;

  const loginId = loginIdFromEmail(sessionData.session?.user?.email);
  if (!loginId) return null;

  const { data: loginProfile, error: loginProfileError } = await supabase
    .from('portal_profiles')
    .select('id, role, branch, is_active')
    .ilike('legacy_user_id', loginId)
    .maybeSingle();

  if (loginProfileError) {
    console.warn('Portal profile login id fallback failed.', loginProfileError.message);
    return null;
  }

  return (loginProfile as ProfileRow | null) ?? null;
}

/** Specific, currently active SALONI identity; never a blanket branch-role override. */
export async function isSaloniCrossBranchTrackViewer(): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user?.id !== '767bd1c7-3c4c-4925-b125-888a27906250') return false;
  const { data: profile, error } = await supabase
    .from('portal_profiles')
    .select('id, auth_user_id, legacy_user_id, role, is_active')
    .eq('auth_user_id', sessionData.session.user.id)
    .maybeSingle();
  if (error) throw error;
  return profile?.id === '6a4fad26-55bb-4894-a2cd-e2b2cfa070e8'
    && profile.auth_user_id === '767bd1c7-3c4c-4925-b125-888a27906250'
    && profile.legacy_user_id?.trim().toUpperCase() === 'SALONI'
    && profile.role === 'branch'
    && profile.is_active === true;
}

export async function getCurrentBranchScopeValues(): Promise<string[] | null> {
  const row = await getCurrentPortalProfile();
  if (!row?.is_active) return [];
  if (normalizeRole(row.role) !== 'branch') return null;

  const values = new Set<string>();
  if (row.branch) values.add(row.branch);
  return toList(values);
}

export async function currentBranchScopeIncludes(orderBranch: string | null | undefined) {
  const values = await getCurrentBranchScopeValues();
  if (values === null) return true;
  if (values.length === 0) return false;
  const orderKey = normalizeBranchKey(orderBranch);
  return values.some((value) => normalizeBranchKey(value) === orderKey);
}
