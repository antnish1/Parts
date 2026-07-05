import { supabase } from '../lib/supabase';
import type { TestOrder } from './testData.service';

type ApprovalAction = 'approve' | 'reject' | 'forward_manager' | 'manager_approve' | 'manager_reject';
type ReviewQtyAction = 'accept_edits' | 'approve_original' | 'zero_item';

async function getFunctionErrorMessage(error: unknown) {
  const fallback = error instanceof Error ? error.message : 'Approval action failed.';
  const context = (error as { context?: Response })?.context;
  if (!context) return fallback;
  try {
    const body = await context.clone().json();
    if (body?.error) return String(body.error);
    if (body?.message) return String(body.message);
  } catch {
    try {
      const text = await context.clone().text();
      if (text) return text;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

async function runApprovalAction(orderId: string, action: ApprovalAction, body: Record<string, string> = {}) {
  const { data, error } = await supabase.functions.invoke('approval-order-action', { body: { orderId, action, ...body } });
  if (error) throw new Error(await getFunctionErrorMessage(error));
  if (data?.error) throw new Error(String(data.error));
  return data;
}

async function runQtyAction(itemId: string, action: 'set' | 'reset', qty?: number) {
  const { data, error } = await supabase.functions.invoke('order-item-qty-action', { body: { itemId, action, qty } });
  if (error) throw new Error(await getFunctionErrorMessage(error));
  if (data?.error) throw new Error(String(data.error));
  return data;
}

async function runReviewQtyAction(payload: { action: ReviewQtyAction; orderId?: string; itemId?: string }) {
  const { data, error } = await supabase.functions.invoke('approval-qty-review-action', { body: payload });
  if (error) throw new Error(await getFunctionErrorMessage(error));
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

export async function acceptTestOrderReviewEdits(order: TestOrder) {
  await runReviewQtyAction({ action: 'accept_edits', orderId: order.id });
}

export async function approveTestOrderWithOriginalQty(order: TestOrder) {
  await runReviewQtyAction({ action: 'approve_original', orderId: order.id });
}

export async function zeroTestOrderItemForReview(itemId: string) {
  await runReviewQtyAction({ action: 'zero_item', itemId });
}
