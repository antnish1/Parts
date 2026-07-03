import { supabase } from '../lib/supabase';
import type { TestOrder } from './testData.service';

export async function dispatchSelectedTestItems(order: TestOrder, itemIds: string[], invoiceNo: string, invoiceDate: string, docketNo = '', transportName = '') {
  const finalInvoiceNo = invoiceNo.trim().toUpperCase();
  if (!finalInvoiceNo) throw new Error('Invoice number is required.');
  if (!invoiceDate) throw new Error('Invoice date is required.');
  if (order.order_for !== 'Customer') throw new Error('Only customer orders can be dispatched.');
  if (itemIds.length === 0) throw new Error('Select at least one item row.');

  const { data, error } = await supabase.functions.invoke('admin-item-issue-action', {
    body: {
      orderId: order.id,
      itemIds,
      invoiceNo: finalInvoiceNo,
      invoiceDate,
      docketNo: docketNo.trim().toUpperCase(),
      transportName: transportName.trim(),
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}
