import { supabase } from '../lib/supabase';
import type { TestOrder } from './testData.service';

type ApprovalAction = 'approve' | 'reject' | 'forward_manager' | 'manager_approve' | 'manager_reject';

async function runApprovalAction(orderId: string, action: ApprovalAction, body: Record<string, string> = {}) {
  const { data, error } = await supabase.functions.invoke('approval-order-action', { body: { orderId, action, ...body } });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}

async function runQtyAction(itemId: string, action: 'set' | 'reset', qty?: number) {
  const { data, error } = await supabase.functions.invoke('order-item-qty-action', { body: { itemId, action, qty } });
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
  await runQtyAction(itemId, 'set', qty);
}

export async function resetTestOrderItemQty(itemId: string) {
  await runQtyAction(itemId, 'reset');
}
