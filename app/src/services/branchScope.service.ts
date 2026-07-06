import { supabase } from '../lib/supabase';

type ProfileRow = { id?: string | null; role: string | null; branch: string | null; is_active: boolean | null };
type BranchRow = { branch_name: string; branch_code: string };

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

export async function getCurrentBranchScopeValues(): Promise<string[] | null> {
  const row = await getCurrentPortalProfile();
  if (!row?.is_active) return [];
  if (normalizeRole(row.role) !== 'branch') return null;

  const values = new Set<string>();
  if (row.branch) values.add(row.branch);
  const branchKey = normalizeBranchKey(row.branch);
  if (!branchKey) return [];

  const { data: branches, error: branchError } = await supabase
    .from('branch_mapping')
    .select('branch_name, branch_code')
    .eq('is_active', true);

  if (branchError) {
    console.warn('Branch scope mapping lookup failed.', branchError.message);
    return toList(values);
  }

  ((branches ?? []) as BranchRow[]).forEach((branch) => {
    if (normalizeBranchKey(branch.branch_name) === branchKey || normalizeBranchKey(branch.branch_code) === branchKey) {
      values.add(branch.branch_name);
      values.add(branch.branch_code);
    }
  });

  return toList(values);
}

export async function currentBranchScopeIncludes(orderBranch: string | null | undefined) {
  const values = await getCurrentBranchScopeValues();
  if (values === null) return true;
  if (values.length === 0) return false;
  const orderKey = normalizeBranchKey(orderBranch);
  return values.some((value) => normalizeBranchKey(value) === orderKey);
}
