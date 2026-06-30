import { supabase } from '../lib/supabase';
import type { TestOrder } from './testData.service';

export async function setTestOrderProcessed(order: TestOrder) {
  const { error } = await supabase
    .from('test_orders')
    .update({ status: 'processed', approval_status: 'approved', processed_date: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })
    .eq('id', order.id)
    .like('order_no', 'TEST-%');

  if (error) throw error;
}
