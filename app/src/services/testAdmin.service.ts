import { supabase } from '../lib/supabase';
import type { TestOrder } from './testData.service';

type AdminActionPayload = Record<string, string> & {
  action: 'process' | 'reject' | 'issue';
  orderId: string;
};

async function runAdminOrderAction(payload: AdminActionPayload) {
  const { data, error } = await supabase.functions.invoke('admin-order-action', { body: payload });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export async function setTestOrderProcessed(order: TestOrder, processingReference: string, processedNotes = '') {
  const reference = processingReference.trim().toUpperCase();
  if (!reference) throw new Error('Final order number is required.');
  if (reference === order.order_no.toUpperCase()) throw new Error('Final order number cannot be same as temporary order number.');

  await runAdminOrderAction({
    action: 'process',
    orderId: order.id,
    processingReference: reference,
    processedNotes: processedNotes.trim(),
  });
}

export async function setTestOrderAdminRejected(order: TestOrder, reason = '') {
  await runAdminOrderAction({
    action: 'reject',
    orderId: order.id,
    reason: reason.trim(),
  });
}

export async function markTestOrderIssued(order: TestOrder, invoiceNo: string, invoiceDate: string, docketNo = '', transportName = '') {
  const dbmsInvoiceNo = invoiceNo.trim().toUpperCase();
  if (!dbmsInvoiceNo) throw new Error('Invoice number is required.');
  if (!invoiceDate) throw new Error('Invoice date is required.');
  if (order.order_for !== 'Customer') throw new Error('Only customer orders can be marked issued.');

  await runAdminOrderAction({
    action: 'issue',
    orderId: order.id,
    invoiceNo: dbmsInvoiceNo,
    invoiceDate,
    docketNo: docketNo.trim().toUpperCase(),
    transportName: transportName.trim(),
  });
}
