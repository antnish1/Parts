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
