import { supabase } from '../lib/supabase';
import type { TestOrder } from './testData.service';

async function appendAdminEvent(orderId: string, eventType: string, oldStatus: string | null, newStatus: string | null, notes: string) {
  await supabase.from('test_order_events').insert({
    order_id: orderId,
    event_type: eventType,
    old_status: oldStatus,
    new_status: newStatus,
    notes,
  });
}

export async function setTestOrderProcessed(order: TestOrder, processingReference: string, processedNotes = '') {
  const reference = processingReference.trim().toUpperCase();
  if (!reference) throw new Error('Final order number is required.');
  if (reference === order.order_no.toUpperCase()) throw new Error('Final order number cannot be same as temporary order number.');

  const { data: duplicate, error: duplicateError } = await supabase
    .from('test_orders')
    .select('id, order_no')
    .or(`final_order_no.eq.${reference},processing_reference.eq.${reference},order_no.eq.${reference}`)
    .neq('id', order.id)
    .maybeSingle();
  if (duplicateError) throw duplicateError;
  if (duplicate) throw new Error('Final order number already exists.');

  const { error } = await supabase
    .from('test_orders')
    .update({
      status: 'processed',
      approval_status: 'approved',
      processing_reference: reference,
      final_order_no: reference,
      processed_notes: processedNotes.trim() || null,
      processed_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .like('order_no', 'TEST-%');

  if (error) throw error;
  await appendAdminEvent(order.id, 'ADMIN_PROCESSED', order.status, 'processed', `Processed with final order number ${reference}.`);
}

export async function setTestOrderAdminRejected(order: TestOrder, reason = '') {
  const { error } = await supabase
    .from('test_orders')
    .update({ status: 'rejected', approval_status: 'rejected', processed_notes: reason.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', order.id)
    .like('order_no', 'TEST-%');

  if (error) throw error;
  await appendAdminEvent(order.id, 'ADMIN_REJECTED', order.status, 'rejected', reason.trim() || 'Rejected by admin.');
}

export async function markTestOrderIssued(order: TestOrder, invoiceNo: string, invoiceDate: string) {
  const dbmsInvoiceNo = invoiceNo.trim().toUpperCase();
  if (!dbmsInvoiceNo) throw new Error('Invoice number is required.');
  if (!invoiceDate) throw new Error('Invoice date is required.');
  if (order.order_for !== 'Customer') throw new Error('Only customer orders can be marked issued.');

  const { error } = await supabase
    .from('test_orders')
    .update({
      status: 'issued',
      dbms_invoice_no: dbmsInvoiceNo,
      dbms_invoice_date: invoiceDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .like('order_no', 'TEST-%');

  if (error) throw error;
  await appendAdminEvent(order.id, 'ORDER_ISSUED', order.status, 'issued', `Issued with invoice ${dbmsInvoiceNo}.`);
}
