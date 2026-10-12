import { getCurrentPortalProfile } from '@/services/profile';

export function normalizeBranchKey(value: string | null | undefined) {
  return (value || '').trim().replace(/[\s_-]+/g, '').toUpperCase();
}

export async function getCurrentBranchScopeValues(): Promise<string[] | null> {
  const profile = await getCurrentPortalProfile();
  if (!profile?.is_active) return [];
  if (String(profile.role ?? '').trim().toLowerCase() !== 'branch') return null;
  return profile.branch ? [profile.branch.trim()].filter(Boolean) : [];
}

export async function currentBranchScopeIncludes(orderBranch: string | null | undefined) {
  const values = await getCurrentBranchScopeValues();
  if (values === null) return true;
  if (!values.length) return false;
  const key = normalizeBranchKey(orderBranch);
  return values.some((value) => normalizeBranchKey(value) === key);
}
