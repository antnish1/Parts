import { supabase } from '../lib/supabase';

export type TestDocketOrder = {
  id: string;
  order_no: string;
  final_order_no: string | null;
  branch: string;
  order_type: string;
  order_for: string;
  customer_name: string | null;
  machine_no: string | null;
  status: string;
  docket_no: string | null;
  transport_name: string | null;
  received_date: string | null;
  dbms_invoice_no: string | null;
  dbms_invoice_date: string | null;
};

export function normalizeDocketNo(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

function safeSearch(value: string) {
  return normalizeDocketNo(value).replace(/[^A-Z0-9/_-]/g, '');
}

async function recalculateOrderReceiveStatus(orderId: string) {
  const { data: items, error } = await supabase
    .from('test_order_items')
    .select('row_status')
    .eq('order_id', orderId);
  if (error) throw error;

  const rows = items ?? [];
  const receivedCount = rows.filter((row) => row.row_status === 'received').length;
  const issuedCount = rows.filter((row) => row.row_status === 'issued').length;
  let nextStatus = 'issued';
  if (rows.length > 0 && receivedCount === rows.length) nextStatus = 'received';
  else if (receivedCount > 0) nextStatus = 'partially_received';
  else if (issuedCount > 0) nextStatus = 'issued';

  const { error: updateError } = await supabase
    .from('test_orders')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .like('order_no', 'TEST-%');
  if (updateError) throw updateError;

  return nextStatus;
}

export async function lookupTestDocketOrders(value: string): Promise<TestDocketOrder[]> {
  const docket = safeSearch(value);
  if (!docket) return [];

  const { data: matchingItems, error: itemError } = await supabase
    .from('test_order_items')
    .select('order_id')
    .or(`docket_no.eq.${docket},dbms_invoice_no.eq.${docket}`)
    .limit(50);
  if (itemError) throw itemError;

  const itemOrderIds = [...new Set((matchingItems ?? []).map((row) => row.order_id).filter(Boolean))];
  const orderFilters = [`final_order_no.eq.${docket}`, `processing_reference.eq.${docket}`, `order_no.eq.${docket}`, `machine_no.ilike.%${docket}%`];
  if (itemOrderIds.length > 0) orderFilters.push(`id.in.(${itemOrderIds.join(',')})`);

  const { data, error } = await supabase
    .from('test_orders')
    .select('id, order_no, final_order_no, branch, order_type, order_for, customer_name, machine_no, status, docket_no, transport_name, received_date, dbms_invoice_no, dbms_invoice_date')
    .or(orderFilters.join(','))
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}

export async function markTestDocketReceived(order: TestDocketOrder, docketInput: string) {
  const docket = safeSearch(docketInput || order.docket_no || order.final_order_no || order.order_no);
  if (!docket) throw new Error('Docket number is required.');
  if (order.status === 'received') throw new Error('Order is already fully received.');

  const receivedAt = new Date().toISOString();
  const { data: matchedRows, error: matchError } = await supabase
    .from('test_order_items')
    .select('id')
    .eq('order_id', order.id)
    .or(`docket_no.eq.${docket},dbms_invoice_no.eq.${docket}`);
  if (matchError) throw matchError;

  const targetIds = (matchedRows ?? []).map((row) => row.id);
  if (targetIds.length === 0) throw new Error('No item rows found for this docket or invoice.');

  const { error: itemError } = await supabase
    .from('test_order_items')
    .update({ row_status: 'received', received_date: receivedAt })
    .in('id', targetIds);
  if (itemError) throw itemError;

  const nextStatus = await recalculateOrderReceiveStatus(order.id);
  await supabase.from('test_order_events').insert({
    order_id: order.id,
    event_type: 'STATUS_UPDATED',
    old_status: order.status,
    new_status: nextStatus,
    notes: `Marked ${targetIds.length} item row(s) received for docket/invoice ${docket}.`,
    metadata: { docket_no: docket, item_count: targetIds.length },
  });
}

export const searchTestOrderForDocket = lookupTestDocketOrders;

export async function markTestOrderReceived(orderId: string, docketNo: string) {
  const matches = await lookupTestDocketOrders(docketNo);
  const order = matches.find((row) => row.id === orderId);
  if (!order) throw new Error('Order not found for this docket.');
  await markTestDocketReceived(order, docketNo);
}
