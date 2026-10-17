import { supabase } from '../lib/supabase';
import type { TestOrder } from './testData.service';
import { getCurrentBranchScopeValues, getCurrentPortalProfile } from './branchScope.service';

const ORDER_COLUMNS = 'id, order_no, branch, order_type, order_for, machine_no, customer_name, status, approval_status, approver_id, approver:portal_profiles!portal_orders_approver_id_fkey(full_name, role), processing_reference, processed_notes, processed_date, final_order_no, dbms_invoice_no, dbms_invoice_date, received_date, docket_no, transport_name, total_qty, total_value, comment_count, created_at';
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

/**
 * Only the verified SALONI login gets all-branch Track Orders visibility.
 * Do not apply this exception to getOrderList/getApprovalOrderList or other modules.
 */
export async function getTrackOrderList(): Promise<TestOrder[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return [];

  const { data: saloniProfile, error: profileError } = await supabase
    .from('portal_profiles')
    .select('id, auth_user_id, legacy_user_id, role, is_active')
    .eq('auth_user_id', userId)
    .maybeSingle();
  if (profileError) throw profileError;

  const isSaloni = saloniProfile?.id === '6a4fad26-55bb-4894-a2cd-e2b2cfa070e8'
    && saloniProfile.auth_user_id === '767bd1c7-3c4c-4925-b125-888a27906250'
    && saloniProfile.legacy_user_id?.trim().toUpperCase() === 'SALONI'
    && saloniProfile.role === 'branch'
    && saloniProfile.is_active === true;

  if (!isSaloni) return getOrderList();

  // Use bounded pages: the default 1,000-row list cannot show all branches' orders.
  const pageSize = 500;
  const orders: TestOrder[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('portal_orders')
      .select(ORDER_COLUMNS)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as TestOrder[];
    orders.push(...page);
    if (page.length < pageSize) break;
  }
  return orders;
}

export async function getOrderList(): Promise<TestOrder[]> {
  return fetchPortalOrders({ limit: DEFAULT_LIST_LIMIT });
}

export async function getApprovalOrderList(): Promise<TestOrder[]> {
  return fetchPortalOrders({ limit: APPROVAL_LIST_LIMIT, pendingOnly: true });
}
