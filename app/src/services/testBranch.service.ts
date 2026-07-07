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

const FALLBACK_BRANCHES: TestBranch[] = [
  { id: 'SEONI', branch_name: 'SEONI', branch_code: 'DFM0013', display_name: 'Seoni', head_quarter: 'SEONI' },
  { id: 'BALAGHAT', branch_name: 'BALAGHAT', branch_code: 'DFM0015', display_name: 'Balaghat', head_quarter: 'BALAGHAT' },
  { id: 'MANDLA', branch_name: 'MANDLA', branch_code: 'DFM0016', display_name: 'Mandla', head_quarter: 'MANDLA' },
  { id: 'KATNI', branch_name: 'KATNI', branch_code: 'DFM0020', display_name: 'Katni', head_quarter: 'KATNI' },
  { id: 'JABALPUR_BHL', branch_name: 'JABALPUR_BHL', branch_code: 'DFM003', display_name: 'Jabalpur BHL', head_quarter: 'JABALPUR' },
  { id: 'JABALPUR_HL', branch_name: 'JABALPUR_HL', branch_code: 'DFM003', display_name: 'Jabalpur HL', head_quarter: 'JABALPUR' },
  { id: 'JABALPUR_PARTS', branch_name: 'JABALPUR_PARTS', branch_code: 'DFM003', display_name: 'Jabalpur Parts', head_quarter: 'JABALPUR' },
  { id: 'WARRANTY', branch_name: 'WARRANTY', branch_code: 'DFM003', display_name: 'Warranty', head_quarter: 'JABALPUR' },
  { id: 'DAMOH', branch_name: 'DAMOH', branch_code: 'DFM0033', display_name: 'Damoh', head_quarter: 'DAMOH' },
  { id: 'ANUPPUR', branch_name: 'ANUPPUR', branch_code: 'DFM0034', display_name: 'Anuppur', head_quarter: 'ANUPPUR' },
  { id: 'GADARWARA', branch_name: 'GADARWARA', branch_code: '100000', display_name: 'Gadarwara', head_quarter: 'GADARWARA' },
  { id: 'DINDORI', branch_name: 'DINDORI', branch_code: '100001', display_name: 'Dindori', head_quarter: 'DINDORI' },
];

function mapPortalBranch(branch: PortalBranchRow): TestBranch {
  return {
    id: branch.branch_key,
    branch_name: branch.branch_key,
    branch_code: branch.inventory_branch_code ?? branch.branch_key,
    display_name: branch.display_name,
    head_quarter: branch.head_quarter,
  };
}

export async function getTestBranches(): Promise<TestBranch[]> {
  const { data, error } = await supabase
    .from('portal_branches')
    .select('branch_key, branch_name, display_name, inventory_branch_code, head_quarter')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('display_name', { ascending: true });

  if (error) {
    console.error('Failed to load portal branches. Using fallback branch master list.', error);
    return FALLBACK_BRANCHES;
  }

  const branches = ((data ?? []) as PortalBranchRow[]).map(mapPortalBranch);
  return branches.length ? branches : FALLBACK_BRANCHES;
}
