import { supabase } from '../lib/supabase';

export type TestDocketOrder = {
  id: string;
  order_no: string;
  branch: string;
  customer_name: string | null;
  machine_no: string | null;
  status: string;
};

export async function searchTestOrderForDocket(term: string): Promise<TestDocketOrder[]> {
  const value = term.trim();
  if (!value) return [];

  const { data, error } = await supabase
    .from('test_orders')
    .select('id, order_no, branch, customer_name, machine_no, status')
    .or(`order_no.ilike.%${value}%,machine_no.ilike.%${value}%,customer_name.ilike.%${value}%`)
    .limit(10);

  if (error) throw error;
  return data ?? [];
}

export async function markTestOrderReceived(orderId: string, docketNo: string) {
  const docket = docketNo.trim().toUpperCase();
  if (!orderId || !docket) throw new Error('Order and docket are required.');

  const { error } = await supabase
    .from('test_orders')
    .update({ status: 'received', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .like('order_no', 'TEST-%');
  if (error) throw error;

  await supabase.from('test_order_events').insert({
    order_id: orderId,
    event_type: 'DOCKET_RECEIVED',
    new_status: 'received',
    notes: `Docket received: ${docket}`,
  });
}
