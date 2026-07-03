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

export async function lookupTestDocketOrders(value: string): Promise<TestDocketOrder[]> {
  const docket = normalizeDocketNo(value);
  if (!docket) return [];

  const { data, error } = await supabase
    .from('test_orders')
    .select('id, order_no, final_order_no, branch, order_type, order_for, customer_name, machine_no, status, docket_no, transport_name, received_date, dbms_invoice_no, dbms_invoice_date')
    .or(`docket_no.eq.${docket},final_order_no.eq.${docket},processing_reference.eq.${docket},order_no.eq.${docket},dbms_invoice_no.eq.${docket},machine_no.ilike.%${docket}%`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}

export async function markTestDocketReceived(order: TestDocketOrder, docketInput: string) {
  const docket = normalizeDocketNo(docketInput || order.docket_no || order.final_order_no || order.order_no);
  if (!docket) throw new Error('Docket number is required.');
  if (order.status === 'received') throw new Error('Order is already received.');

  const receivedAt = new Date().toISOString();
  const { error } = await supabase
    .from('test_orders')
    .update({ status: 'received', docket_no: docket, received_date: receivedAt, updated_at: receivedAt })
    .eq('id', order.id)
    .like('order_no', 'TEST-%');
  if (error) throw error;

  await supabase.from('test_order_events').insert({
    order_id: order.id,
    event_type: 'STATUS_UPDATED',
    old_status: order.status,
    new_status: 'received',
    notes: `Marked received for docket ${docket}.`,
    metadata: { docket_no: docket },
  });
}

export const searchTestOrderForDocket = lookupTestDocketOrders;

export async function markTestOrderReceived(orderId: string, docketNo: string) {
  const matches = await lookupTestDocketOrders(docketNo);
  const order = matches.find((row) => row.id === orderId);
  if (!order) throw new Error('Order not found for this docket.');
  await markTestDocketReceived(order, docketNo);
}
