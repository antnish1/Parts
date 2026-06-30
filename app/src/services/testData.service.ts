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
