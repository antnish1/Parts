import { supabase } from '../lib/supabase';

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
  created_at: string;
};

export type DashboardSummary = {
  totalOrders: number;
  pending: number;
  approved: number;
  processed: number;
  rejected: number;
};

export type CreateTestOrderInput = {
  branch: string;
  orderType: string;
  orderFor: string;
  machineNo?: string;
  customerName?: string;
  callId?: string;
  warrantyStatus?: string;
  partNo: string;
  description: string;
  dnp: number;
  qty: number;
};

export async function getTestOrders(): Promise<TestOrder[]> {
  const { data, error } = await supabase
    .from('test_orders')
    .select('id, order_no, branch, order_type, order_for, machine_no, customer_name, status, approval_status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Failed to load test orders', error);
    return [];
  }

  return data ?? [];
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
  const orderNo = `TEST-${Date.now()}`;
  const value = Number((input.dnp * input.qty).toFixed(2));

  const { data: order, error: orderError } = await supabase
    .from('test_orders')
    .insert({
      order_no: orderNo,
      branch: input.branch,
      order_type: input.orderType,
      order_for: input.orderFor,
      machine_no: input.machineNo || null,
      customer_name: input.customerName || null,
      call_id: input.callId || null,
      warranty_status: input.warrantyStatus || 'NA',
      status: 'pending_approval',
      approval_status: 'pending',
    })
    .select('id, order_no')
    .single();

  if (orderError) throw orderError;

  const { error: itemError } = await supabase.from('test_order_items').insert({
    order_id: order.id,
    part_no: input.partNo,
    description: input.description,
    dnp: input.dnp,
    qty: input.qty,
    value,
    previous_30d_qty: 0,
  });

  if (itemError) throw itemError;

  await supabase.from('test_order_events').insert({
    order_id: order.id,
    event_type: 'TEST_ORDER_CREATED',
    old_status: null,
    new_status: 'pending_approval',
    notes: 'Created from rebuild test form',
  });

  return order;
}
