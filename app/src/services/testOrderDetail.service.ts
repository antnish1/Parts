import { supabase } from '../lib/supabase';

export type TestOrderItem = {
  id: string;
  order_id: string;
  part_no: string;
  description: string | null;
  dnp: number | null;
  qty: number;
  edited_qty: number | null;
  billed_qty: number | null;
  value: number | null;
};

export async function getTestOrderItems(orderId: string): Promise<TestOrderItem[]> {
  const { data, error } = await supabase
    .from('portal_order_items')
    .select('id, order_id, part_no, description, dnp, qty, edited_qty, billed_qty, value')
    .eq('order_id', orderId)
    .limit(50);

  if (error) {
    console.error('Failed to load portal order items', error);
    return [];
  }

  return data ?? [];
}
