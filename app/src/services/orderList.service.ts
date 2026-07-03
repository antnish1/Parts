import { supabase } from '../lib/supabase';
import type { TestOrder } from './testData.service';

const ORDER_COLUMNS = 'id, order_no, branch, order_type, order_for, machine_no, customer_name, status, approval_status, processing_reference, processed_notes, processed_date, final_order_no, dbms_invoice_no, dbms_invoice_date, received_date, docket_no, transport_name, created_at';
const PAGE_SIZE = 1000;

export async function getOrderList(): Promise<TestOrder[]> {
  const rows: TestOrder[] = [];

  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('test_orders')
      .select(ORDER_COLUMNS)
      .order('created_at', { ascending: false })
      .range(start, start + PAGE_SIZE - 1);

    if (error) throw error;
    const page = (data ?? []) as TestOrder[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}
