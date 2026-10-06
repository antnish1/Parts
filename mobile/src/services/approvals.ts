import { supabase } from '@/lib/supabase';
import { getCurrentPortalProfile } from '@/services/profile';
import type { OrderItem, OrderSummary } from '@/services/orders';

async function invoke(functionName: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export async function getApprovalQueue(limit = 250): Promise<OrderSummary[]> {
  const profile = await getCurrentPortalProfile();
  if (!profile?.is_active || !['super', 'manager', 'developer'].includes(profile.role ?? '')) return [];

  let query = supabase
    .from('portal_orders')
    .select('id, order_no, branch, order_type, order_for, machine_no, customer_name, status, approval_status, approver_id, processing_reference, processed_date, final_order_no, dbms_invoice_no, dbms_invoice_date, received_date, docket_no, transport_name, total_qty, total_value, comment_count, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (profile.role === 'super') {
    query = query.eq('approver_id', profile.id).eq('approval_status', 'pending_approval');
  } else if (profile.role === 'manager') {
    query = query.eq('approval_status', 'pending_manager_approval');
  } else {
    query = query.in('approval_status', ['pending_approval', 'pending_manager_approval']);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OrderSummary[];
}

export async function setEditedQuantity(itemId: string, qty: number) {
  if (!Number.isInteger(qty) || qty < 0) throw new Error('Edited quantity must be a whole number.');
  return invoke('order-item-qty-action', { itemId, action: 'set', qty });
}

export async function resetEditedQuantity(itemId: string) {
  return invoke('order-item-qty-action', { itemId, action: 'reset' });
}

export async function zeroReviewItem(itemId: string) {
  return invoke('approval-qty-review-action', { itemId, action: 'zero_item' });
}

export async function approveReview(orderId: string, mode: 'accept_edits' | 'approve_original') {
  return invoke('approval-qty-review-action', { orderId, action: mode });
}

export async function approveOrderStage(orderId: string, role: 'super' | 'manager' | 'developer') {
  const action = role === 'manager' ? 'manager_approve' : 'approve';
  return invoke('approval-order-action', { orderId, action });
}

export async function forwardOrderToManager(orderId: string, managerName = 'Manager') {
  return invoke('approval-order-action', { orderId, action: 'forward_manager', managerName });
}

export async function rejectOrder(orderId: string, role: 'super' | 'manager' | 'developer') {
  const action = role === 'manager' ? 'manager_reject' : 'reject';
  return invoke('approval-order-action', { orderId, action });
}

export function effectiveQty(item: OrderItem) {
  return item.edited_qty ?? item.qty;
}
