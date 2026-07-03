import { supabase } from '../lib/supabase';
import type { TestOrder } from './testData.service';
import { getOrderStatusMap } from './orderStatusMap.service';

const ORDER_COLUMNS = 'id, order_no, branch, order_type, order_for, machine_no, customer_name, status, approval_status, processing_reference, processed_notes, processed_date, final_order_no, dbms_invoice_no, dbms_invoice_date, received_date, docket_no, transport_name, created_at';
const PAGE_SIZE = 1000;

type ProfileScope = { role: string; branch: string | null; is_active: boolean | null };
type BranchMapping = { branch_name: string; branch_code: string };

function normalizeBranchKey(value: string | null | undefined) {
  return (value || '').trim().replace(/[\s_-]+/g, '').toUpperCase();
}

async function getBranchScopeValues() {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return null;

  const { data: profile, error: profileError } = await supabase
    .from('test_profiles')
    .select('role, branch, is_active')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (profileError) {
    console.warn('Order list profile scope unavailable.', profileError.message);
    return null;
  }

  const scopedProfile = profile as ProfileScope | null;
  if (!scopedProfile?.is_active || scopedProfile.role !== 'branch') return null;

  const values = new Set<string>();
  if (scopedProfile.branch) values.add(scopedProfile.branch);
  const profileKey = normalizeBranchKey(scopedProfile.branch);

  const { data: mappings, error: mappingError } = await supabase
    .from('test_branch_mapping')
    .select('branch_name, branch_code')
    .eq('is_active', true);

  if (mappingError) {
    console.warn('Branch mapping unavailable for order list filter.', mappingError.message);
    return [...values].filter(Boolean);
  }

  ((mappings ?? []) as BranchMapping[]).forEach((branch) => {
    if (normalizeBranchKey(branch.branch_name) === profileKey || normalizeBranchKey(branch.branch_code) === profileKey) {
      values.add(branch.branch_name);
      values.add(branch.branch_code);
    }
  });

  return [...values].filter(Boolean);
}

export async function getOrderList(): Promise<TestOrder[]> {
  const rows: TestOrder[] = [];
  const branchValues = await getBranchScopeValues();

  for (let start = 0; ; start += PAGE_SIZE) {
    let query = supabase
      .from('test_orders')
      .select(ORDER_COLUMNS)
      .order('created_at', { ascending: false })
      .range(start, start + PAGE_SIZE - 1);

    if (branchValues?.length) query = query.in('branch', branchValues);

    const { data, error } = await query;

    if (error) throw error;
    const page = (data ?? []) as TestOrder[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const statusMap = await getOrderStatusMap(rows);
  return rows.map((row) => ({ ...row, status: statusMap[row.id] ?? row.status }));
}
