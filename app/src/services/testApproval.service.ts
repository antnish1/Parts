import { supabase } from '../lib/supabase';
import type { TestOrder } from './testData.service';

export async function setTestOrderApproved(order: TestOrder) {
  const { error } = await supabase
    .from('test_orders')
    .update({ status: 'approved', approval_status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', order.id)
    .like('order_no', 'TEST-%');

  if (error) throw error;
}

export async function setTestOrderRejected(order: TestOrder) {
  const { error } = await supabase
    .from('test_orders')
    .update({ status: 'rejected', approval_status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', order.id)
    .like('order_no', 'TEST-%');

  if (error) throw error;
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
