import { supabase } from '../lib/supabase';
import { normalizeBranchKey } from './branchScope.service';

type BranchRow = {
  branch_key: string;
  branch_name: string;
  display_name: string;
  inventory_branch_code: string | null;
  head_quarter: string | null;
};

const scopeCache = new Map<string, string[]>();

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

async function resolveBranchKey(value: string) {
  const input = value.trim();
  if (!input) return '';

  const { data, error } = await supabase.rpc('resolve_portal_branch', { value: input });
  if (error) {
    console.warn('Branch resolver failed. Falling back to raw branch value.', error.message);
    return input.toUpperCase();
  }

  return String(data ?? '').trim() || input.toUpperCase();
}

export async function getBranchCalculationScope(branch: string): Promise<string[]> {
  const resolvedKey = await resolveBranchKey(branch);
  if (!resolvedKey) return [];

  const cacheKey = normalizeBranchKey(resolvedKey);
  const cached = scopeCache.get(cacheKey);
  if (cached) return cached;

  const { data: selected, error: selectedError } = await supabase
    .from('portal_branches')
    .select('branch_key, branch_name, display_name, inventory_branch_code, head_quarter')
    .eq('branch_key', resolvedKey)
    .maybeSingle<BranchRow>();

  if (selectedError || !selected?.head_quarter) {
    if (selectedError) console.warn('Branch calculation selected lookup failed.', selectedError.message);
    const fallback = [resolvedKey];
    scopeCache.set(cacheKey, fallback);
    return fallback;
  }

  const { data: groupRows, error: groupError } = await supabase
    .from('portal_branches')
    .select('branch_key')
    .eq('head_quarter', selected.head_quarter)
    .eq('is_active', true);

  if (groupError) {
    console.warn('Branch calculation group lookup failed.', groupError.message);
    const fallback = [resolvedKey];
    scopeCache.set(cacheKey, fallback);
    return fallback;
  }

  const scope = unique(((groupRows ?? []) as Array<{ branch_key: string }>).map((row) => row.branch_key));
  const finalScope = scope.length ? scope : [resolvedKey];
  scopeCache.set(cacheKey, finalScope);
  return finalScope;
}
