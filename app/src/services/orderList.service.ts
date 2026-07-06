import { supabase } from '../lib/supabase';
import type { TestOrder } from './testData.service';
import { getCurrentBranchScopeValues, getCurrentPortalProfile } from './branchScope.service';

const ORDER_COLUMNS = 'id, order_no, branch, order_type, order_for, machine_no, customer_name, status, approval_status, approver_id, approver:portal_profiles!portal_orders_approver_id_fkey(full_name, role), processing_reference, processed_notes, processed_date, final_order_no, dbms_invoice_no, dbms_invoice_date, received_date, docket_no, transport_name, created_at';
const DEFAULT_LIST_LIMIT = 1000;
const APPROVAL_LIST_LIMIT = 500;
const PENDING_APPROVAL_STATUSES = ['pending_approval', 'pending_manager_approval'];

type OrderListOptions = {
  limit?: number;
  pendingOnly?: boolean;
};

async function fetchPortalOrders(options: OrderListOptions = {}): Promise<TestOrder[]> {
  const profile = await getCurrentPortalProfile();
  const branchValues = await getCurrentBranchScopeValues();
  const limit = options.limit ?? DEFAULT_LIST_LIMIT;

  let query = supabase
    .from('portal_orders')
    .select(ORDER_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options.pendingOnly) {
    query = query.in('approval_status', PENDING_APPROVAL_STATUSES);
  }

  if (branchValues !== null) {
    query = query.in('branch', branchValues.length ? branchValues : ['__NO_BRANCH_SCOPE__']);
  }

  if (profile?.role === 'super') {
    query = query.eq('approver_id', profile.id || '__NO_APPROVER__');
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as TestOrder[];
}

export async function getOrderList(): Promise<TestOrder[]> {
  return fetchPortalOrders({ limit: DEFAULT_LIST_LIMIT });
}

export async function getApprovalOrderList(): Promise<TestOrder[]> {
  return fetchPortalOrders({ limit: APPROVAL_LIST_LIMIT, pendingOnly: true });
}
