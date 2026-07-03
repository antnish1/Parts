import { supabase } from '../lib/supabase';
import type { TestOrder } from './testData.service';

async function appendApprovalEvent(orderId: string, eventType: string, oldStatus: string | null, newStatus: string | null, notes: string) {
  await supabase.from('test_order_events').insert({
    order_id: orderId,
    event_type: eventType,
    old_status: oldStatus,
    new_status: newStatus,
    notes,
  });
}

export async function setTestOrderApproved(order: TestOrder) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('test_orders')
    .update({ status: 'approved', approval_status: 'approved', updated_at: now })
    .eq('id', order.id)
    .like('order_no', 'TEST-%');

  if (error) throw error;
  const { error: itemError } = await supabase
    .from('test_order_items')
    .update({ row_status: 'approved', updated_at: now })
    .eq('order_id', order.id)
    .in('row_status', ['pending_approval', 'pending_manager_approval']);
  if (itemError) throw itemError;
  await appendApprovalEvent(order.id, 'ORDER_APPROVED', order.status, 'approved', 'Order item rows approved.');
}

export async function setTestOrderRejected(order: TestOrder) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('test_orders')
    .update({ status: 'rejected', approval_status: 'rejected', updated_at: now })
    .eq('id', order.id)
    .like('order_no', 'TEST-%');

  if (error) throw error;
  const { error: itemError } = await supabase
    .from('test_order_items')
    .update({ row_status: 'rejected', updated_at: now })
    .eq('order_id', order.id)
    .in('row_status', ['pending_approval', 'pending_manager_approval', 'approved']);
  if (itemError) throw itemError;
  await appendApprovalEvent(order.id, 'ORDER_REJECTED', order.status, 'rejected', 'Order item rows rejected.');
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
