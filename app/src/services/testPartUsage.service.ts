import { supabase } from '../lib/supabase';
import { getEffectiveQty, normalizePartNo } from '../lib/orderLogic';

type TestUsageRow = {
  part_no: string | null;
  qty: number | null;
  edited_qty: number | null;
};

export async function getTestLast30QtyByBranchPart(branch: string, partNo: string, days = 30) {
  const normalizedPartNo = normalizePartNo(partNo);
  if (!branch || !normalizedPartNo) return 0;

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('test_order_items')
    .select('part_no, qty, edited_qty, test_orders!inner(branch, status, approval_status, created_at)')
    .eq('part_no', normalizedPartNo)
    .eq('test_orders.branch', branch)
    .neq('test_orders.status', 'rejected')
    .neq('test_orders.approval_status', 'rejected')
    .gte('test_orders.created_at', since.toISOString());

  if (error) throw error;

  return (data as unknown as TestUsageRow[] || []).reduce((sum, row) => sum + getEffectiveQty(row), 0);
}
