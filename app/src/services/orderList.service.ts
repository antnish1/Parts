import { supabase } from '../lib/supabase';
import type { TestOrder } from './testData.service';
import { getOrderStatusMap } from './orderStatusMap.service';
import { getCurrentBranchScopeValues, getCurrentPortalProfile } from './branchScope.service';

const ORDER_COLUMNS = 'id, order_no, branch, order_type, order_for, machine_no, customer_name, status, approval_status, approver_id, approver:portal_profiles!portal_orders_approver_id_fkey(full_name, role), processing_reference, processed_notes, processed_date, final_order_no, dbms_invoice_no, dbms_invoice_date, received_date, docket_no, transport_name, created_at';
const PAGE_SIZE = 1000;

export async function getOrderList(): Promise<TestOrder[]> {
  const rows: TestOrder[] = [];
  const profile = await getCurrentPortalProfile();
  const branchValues = await getCurrentBranchScopeValues();

  for (let start = 0; ; start += PAGE_SIZE) {
    let query = supabase
      .from('portal_orders')
      .select(ORDER_COLUMNS)
      .order('created_at', { ascending: false })
      .range(start, start + PAGE_SIZE - 1);

    if (branchValues !== null) {
      query = query.in('branch', branchValues.length ? branchValues : ['__NO_BRANCH_SCOPE__']);
    }

    if (profile?.role === 'super') {
      query = query.eq('approver_id', profile.id || '__NO_APPROVER__');
    }

    const { data, error } = await query;

    if (error) throw error;
    const page = (data ?? []) as unknown as TestOrder[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const statusMap = await getOrderStatusMap(rows);
  return rows.map((row) => ({ ...row, status: statusMap[row.id] ?? row.status }));
}
