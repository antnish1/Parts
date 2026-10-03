import { supabase } from '@/lib/supabase';
import { getCurrentPortalProfile } from '@/services/profile';

export type OrderSummary = {
  id: string;
  order_no: string;
  branch: string | null;
  order_type: string | null;
  order_for: string | null;
  machine_no: string | null;
  customer_name: string | null;
  status: string | null;
  approval_status: string | null;
  approver_id: string | null;
  processing_reference: string | null;
  processed_date: string | null;
  final_order_no: string | null;
  dbms_invoice_no: string | null;
  dbms_invoice_date: string | null;
  received_date: string | null;
  docket_no: string | null;
  transport_name: string | null;
  total_qty: number | null;
  total_value: number | null;
  comment_count: number | null;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  part_no: string;
  description: string | null;
  dnp: number | null;
  qty: number;
  edited_qty: number | null;
  billed_qty: number | null;
  value: number | null;
};

const ORDER_COLUMNS = 'id, order_no, branch, order_type, order_for, machine_no, customer_name, status, approval_status, approver_id, processing_reference, processed_date, final_order_no, dbms_invoice_no, dbms_invoice_date, received_date, docket_no, transport_name, total_qty, total_value, comment_count, created_at';

export async function getVisibleOrders(limit = 250): Promise<OrderSummary[]> {
  const profile = await getCurrentPortalProfile();
  if (!profile?.is_active) return [];

  let query = supabase
    .from('portal_orders')
    .select(ORDER_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (profile.role === 'branch') {
    query = query.eq('branch', profile.branch ?? '__NO_BRANCH_SCOPE__');
  }

  if (profile.role === 'super') {
    query = query.eq('approver_id', profile.id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OrderSummary[];
}

export async function getOrder(orderId: string): Promise<OrderSummary> {
  const { data, error } = await supabase
    .from('portal_orders')
    .select(ORDER_COLUMNS)
    .eq('id', orderId)
    .single();

  if (error) throw error;
  return data as OrderSummary;
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const { data, error } = await supabase
    .from('portal_order_items')
    .select('id, order_id, part_no, description, dnp, qty, edited_qty, billed_qty, value')
    .eq('order_id', orderId)
    .limit(100);

  if (error) throw error;
  return (data ?? []) as OrderItem[];
}

export function formatMoney(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
