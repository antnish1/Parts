import { supabase } from '../lib/supabase';
import { getOrderStatusLabel } from '../lib/orderLogic';
import { getCurrentBranchScopeValues } from './branchScope.service';

export type TestOrder = {
  id: string;
  order_no: string;
  branch: string;
  order_type: string;
  order_for: string;
  machine_no: string | null;
  customer_name: string | null;
  status: string;
  approval_status: string;
  processing_reference: string | null;
  processed_notes: string | null;
  processed_date: string | null;
  final_order_no: string | null;
  dbms_invoice_no: string | null;
  dbms_invoice_date: string | null;
  received_date: string | null;
  docket_no: string | null;
  transport_name: string | null;
  created_at: string;
};

type OrderItemStatusRow = {
  order_id: string;
  row_status: string | null;
  qty: number | null;
  edited_qty: number | null;
  billed_qty: number | null;
};

export type DashboardSummary = {
  totalOrders: number;
  pending: number;
  approved: number;
  processed: number;
  rejected: number;
};

export type CreateTestOrderItemInput = {
  partNo: string;
  description: string;
  dnp: number;
  qty: number;
  previous30dQty?: number;
};

export type CreateTestOrderInput = {
  branch: string;
  orderType: string;
  orderFor: string;
  approverId?: string;
  machineNo?: string;
  customerName?: string;
  callId?: string;
  warrantyStatus?: string;
  partNo?: string;
  description?: string;
  dnp?: number;
  qty?: number;
  items?: CreateTestOrderItemInput[];
};

function friendlyOrderError(message: string) {
  const text = message.toLowerCase();
  if (text.includes('branch user can create orders only for own branch')) return 'Your login is mapped to another branch. Please select your own branch or update the profile branch in Developer Workspace.';
  if (text.includes('no active profile') || text.includes('profile') && text.includes('linked')) return 'No active profile is linked with this login. Please check test_profiles.auth_user_id in Developer Workspace.';
  if (text.includes('active users') || text.includes('profile_inactive')) return 'Your user profile is inactive or not linked with this login. Please check test_profiles.auth_user_id.';
  if (text.includes('role cannot create')) return 'This user role cannot create orders.';
  if (text.includes('approver')) return 'Please select an active approver before placing the order.';
  if (text.includes('duplicate item')) return message;
  if (text.includes('required')) return message;
  if (text.includes('failed to fetch') || text.includes('send a request')) return 'Could not connect to create-order-action. Please deploy the Edge Function and check Supabase function secrets.';
  if (text.includes('non-2xx')) return 'Order creation was rejected by create-order-action. Please redeploy create-order-action, then try again to see the exact reason.';
  return message || 'Order creation failed.';
}

async function readFunctionError(error: unknown) {
  const maybeError = error as { message?: string; context?: Response };
  if (maybeError?.context) {
    try {
      const body = await maybeError.context.clone().json();
      if (body?.error) return friendlyOrderError(String(body.error));
    } catch {
      // Ignore body parse error and use fallback message.
    }
  }
  return friendlyOrderError(maybeError?.message ?? 'Order creation failed.');
}

export async function getTestOrders(): Promise<TestOrder[]> {
  const branchValues = await getCurrentBranchScopeValues();
  let query = supabase
    .from('test_orders')
    .select('id, order_no, branch, order_type, order_for, machine_no, customer_name, status, approval_status, processing_reference, processed_notes, processed_date, final_order_no, dbms_invoice_no, dbms_invoice_date, received_date, docket_no, transport_name, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (branchValues !== null) {
    query = query.in('branch', branchValues.length ? branchValues : ['__NO_BRANCH_SCOPE__']);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to load test orders', error);
    return [];
  }

  const orders = data ?? [];
  const ids = orders.map((order) => order.id);
  if (ids.length === 0) return orders;

  const { data: itemRows, error: itemError } = await supabase
    .from('test_order_items')
    .select('order_id, row_status, qty, edited_qty, billed_qty')
    .in('order_id', ids);

  if (itemError) {
    console.error('Failed to load item status rows', itemError);
    return orders;
  }

  const itemsByOrder = (itemRows ?? []).reduce<Record<string, OrderItemStatusRow[]>>((acc, row) => {
    const key = row.order_id;
    acc[key] = acc[key] ?? [];
    acc[key].push(row as OrderItemStatusRow);
    return acc;
  }, {});

  return orders.map((order) => {
    const items = itemsByOrder[order.id] ?? [];
    if (!items.length) return order;
    const status = getOrderStatusLabel({ ...order, items });
    return { ...order, status: status.toLowerCase().replace(/ /g, '_') };
  });
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const orders = await getTestOrders();

  return {
    totalOrders: orders.length,
    pending: orders.filter((order) => order.status.includes('pending')).length,
    approved: orders.filter((order) => order.status === 'approved').length,
    processed: orders.filter((order) => order.status === 'processed').length,
    rejected: orders.filter((order) => order.status === 'rejected').length,
  };
}

export async function createTestOrder(input: CreateTestOrderInput) {
  const orderItems = input.items?.length
    ? input.items
    : [{ partNo: input.partNo ?? '', description: input.description ?? '', dnp: input.dnp ?? 0, qty: input.qty ?? 0 }];

  const { data, error } = await supabase.functions.invoke('create-order-action', {
    body: { ...input, items: orderItems },
  });
  if (error) throw new Error(await readFunctionError(error));
  if (data?.ok === false || data?.error) throw new Error(friendlyOrderError(String(data.error || 'Order creation failed.')));
  if (!data?.id || !data?.order_no) throw new Error('Order creation response was incomplete. Please redeploy create-order-action.');
  return { id: data.id as string, order_no: data.order_no as string };
}
