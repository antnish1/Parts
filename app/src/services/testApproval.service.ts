import { supabase } from '../lib/supabase';
import type { TestOrder } from './testData.service';

type ApprovalAction = 'approve' | 'reject' | 'forward_manager' | 'manager_approve' | 'manager_reject';

async function runApprovalAction(orderId: string, action: ApprovalAction, body: Record<string, string> = {}) {
  const { data, error } = await supabase.functions.invoke('approval-order-action', { body: { orderId, action, ...body } });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export async function setTestOrderApproved(order: TestOrder) {
  await runApprovalAction(order.id, 'approve');
}

export async function forwardTestOrderToManager(order: TestOrder, managerName = 'Manager') {
  await runApprovalAction(order.id, 'forward_manager', { managerName });
}

export async function setTestOrderManagerApproved(order: TestOrder) {
  await runApprovalAction(order.id, 'manager_approve');
}

export async function setTestOrderManagerRejected(order: TestOrder) {
  await runApprovalAction(order.id, 'manager_reject');
}

export async function setTestOrderRejected(order: TestOrder) {
  await runApprovalAction(order.id, 'reject');
}

export async function updateTestOrderItemQty(itemId: string, qty: number) {
  if (!Number.isInteger(qty) || qty < 0) throw new Error('Edited quantity must be a whole number.');

  const { data: item, error: itemError } = await supabase
    .from('test_order_items')
    .select('id, order_id, dnp')
    .eq('id', itemId)
    .single();
  if (itemError) throw itemError;

  const { data: order, error: orderError } = await supabase
    .from('test_orders')
    .select('id, order_no')
    .eq('id', item.order_id)
    .single();
  if (orderError) throw orderError;
  if (!order.order_no?.startsWith('TEST-')) throw new Error('Only test orders can be edited here.');

  const editedValue = Number(item.dnp ?? 0) * qty;
  const { error } = await supabase
    .from('test_order_items')
    .update({ edited_qty: qty, edited_value: editedValue })
    .eq('id', itemId);

  if (error) throw error;
}

export async function resetTestOrderItemQty(itemId: string) {
  const { error } = await supabase
    .from('test_order_items')
    .update({ edited_qty: null, edited_value: null })
    .eq('id', itemId);

  if (error) throw error;
}
