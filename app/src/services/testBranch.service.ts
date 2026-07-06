import { supabase } from '../lib/supabase';

export type TestBranch = {
  id: string;
  branch_name: string;
  branch_code: string;
  display_name?: string;
  head_quarter?: string | null;
};

type PortalBranchRow = {
  branch_key: string;
  branch_name: string;
  display_name: string;
  inventory_branch_code: string | null;
  head_quarter: string | null;
};

export async function getTestBranches(): Promise<TestBranch[]> {
  const { data, error } = await supabase
    .from('portal_branches')
    .select('branch_key, branch_name, display_name, inventory_branch_code, head_quarter')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('display_name', { ascending: true });

  if (error) {
    console.error('Failed to load portal branches', error);
    return [];
  }

  return ((data ?? []) as PortalBranchRow[]).map((branch) => ({
    id: branch.branch_key,
    branch_name: branch.branch_key,
    branch_code: branch.inventory_branch_code ?? branch.branch_key,
    display_name: branch.display_name,
    head_quarter: branch.head_quarter,
  }));
}
