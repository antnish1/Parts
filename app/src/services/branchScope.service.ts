import { supabase } from '../lib/supabase';

type ProfileRow = { role: string; branch: string | null; is_active: boolean | null };
type BranchRow = { branch_name: string; branch_code: string };

export function normalizeBranchKey(value: string | null | undefined) {
  return (value || '').trim().replace(/[\s_-]+/g, '').toUpperCase();
}

export async function getCurrentBranchScopeValues() {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return null;

  const { data: profile, error: profileError } = await supabase
    .from('test_profiles')
    .select('role, branch, is_active')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (profileError) {
    console.warn('Branch scope profile lookup failed.', profileError.message);
    return null;
  }

  const row = profile as ProfileRow | null;
  if (!row?.is_active || row.role !== 'branch') return null;

  const values = new Set<string>();
  if (row.branch) values.add(row.branch);
  const branchKey = normalizeBranchKey(row.branch);

  const { data: branches, error: branchError } = await supabase
    .from('test_branch_mapping')
    .select('branch_name, branch_code')
    .eq('is_active', true);

  if (branchError) {
    console.warn('Branch scope mapping lookup failed.', branchError.message);
    return [...values].filter(Boolean);
  }

  ((branches ?? []) as BranchRow[]).forEach((branch) => {
    if (normalizeBranchKey(branch.branch_name) === branchKey || normalizeBranchKey(branch.branch_code) === branchKey) {
      values.add(branch.branch_name);
      values.add(branch.branch_code);
    }
  });

  return [...values].filter(Boolean);
}

export async function currentBranchScopeIncludes(orderBranch: string | null | undefined) {
  const values = await getCurrentBranchScopeValues();
  if (values === null) return true;
  const orderKey = normalizeBranchKey(orderBranch);
  return values.some((value) => normalizeBranchKey(value) === orderKey);
}
