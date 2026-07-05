import { supabase } from '../lib/supabase';
import { getCurrentBranchScopeValues } from './branchScope.service';

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

export async function lookupTestDocketOrders(value: string): Promise<TestDocketOrder[]> {
  const docket = safeSearch(value);
  if (!docket) return [];
  const branchValues = await getCurrentBranchScopeValues();

  const itemOrderIds = new Set<string>();

  const { data: matchingItems, error: itemError } = await supabase
    .from('test_order_items')
    .select('order_id')
    .or(`docket_no.eq.${docket},dbms_invoice_no.eq.${docket}`)
    .limit(50);
  if (itemError) throw itemError;
  (matchingItems ?? []).forEach((row) => { if (row.order_id) itemOrderIds.add(row.order_id); });

  const { data: matchingChunks, error: chunkError } = await supabase
    .from('test_order_item_billings')
    .select('order_id')
    .or(`docket_no.eq.${docket},invoice_no.eq.${docket}`)
    .limit(50);
  if (!chunkError) {
    (matchingChunks ?? []).forEach((row) => { if (row.order_id) itemOrderIds.add(row.order_id); });
  }

  const orderFilters = [`final_order_no.eq.${docket}`, `processing_reference.eq.${docket}`, `order_no.eq.${docket}`, `machine_no.ilike.%${docket}%`];
  if (itemOrderIds.size > 0) orderFilters.push(`id.in.(${[...itemOrderIds].join(',')})`);

  let query = supabase
    .from('test_orders')
    .select('id, order_no, final_order_no, branch, order_type, order_for, customer_name, machine_no, status, docket_no, transport_name, received_date, dbms_invoice_no, dbms_invoice_date')
    .or(orderFilters.join(','))
    .order('created_at', { ascending: false })
    .limit(20);

  if (branchValues?.length) query = query.in('branch', branchValues);

  const { data, error } = await query;

  if (error) throw error;
  return data ?? [];
}

export async function markTestDocketReceived(order: TestDocketOrder, docketInput: string) {
  const docket = safeSearch(docketInput || order.docket_no || order.final_order_no || order.order_no);
  if (!docket) throw new Error('Docket number is required.');
  if (order.status === 'received') throw new Error('Order is already fully received.');

  const { data, error } = await supabase.functions.invoke('docket-receive-action', {
    body: { orderId: order.id, docketNo: docket },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export const searchTestOrderForDocket = lookupTestDocketOrders;

export async function markTestOrderReceived(orderId: string, docketNo: string) {
  const matches = await lookupTestDocketOrders(docketNo);
  const order = matches.find((row) => row.id === orderId);
  if (!order) throw new Error('Order not found for this docket.');
  await markTestDocketReceived(order, docketNo);
}
