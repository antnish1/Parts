import { supabase } from '../lib/supabase';
import type { TestOrder } from './testData.service';

type AdminActionPayload = Record<string, string> & {
  action: 'process' | 'reject' | 'issue';
  orderId: string;
};

function friendlyAdminError(message: string) {
  const text = message.toLowerCase();
  if (text.includes('final order number already exists')) return 'This DBMS order number is already used in another portal order.';
  if (text.includes('same as temporary')) return 'DBMS order number cannot be same as the temporary portal order number.';
  if (text.includes('only approved orders')) return 'Only approved orders can be processed. Please refresh and check the current order status.';
  if (text.includes('only active admin or developer')) return 'Only an active admin or developer login can process orders.';
  if (text.includes('missing function configuration')) return 'Admin order Edge Function is missing Supabase configuration or auth header.';
  if (text.includes('unauthorized')) return 'Your login session is not authorized. Please log out and log in again.';
  if (text.includes('failed to fetch') || text.includes('send a request')) return 'Could not connect to admin-order-action. Please check Supabase Edge Function deployment.';
  if (text.includes('non-2xx')) return 'Admin action was rejected by the Edge Function. Please deploy the latest admin-order-action and try again.';
  return message || 'Admin action failed.';
}

async function readAdminFunctionError(error: unknown) {
  const maybeError = error as { message?: string; context?: Response };
  if (maybeError?.context) {
    try {
      const body = await maybeError.context.clone().json();
      if (body?.error) return friendlyAdminError(String(body.error));
    } catch {
      // Ignore response parsing errors and use the fallback message.
    }
  }
  return friendlyAdminError(maybeError?.message ?? 'Admin action failed.');
}

async function runAdminOrderAction(payload: AdminActionPayload) {
  const { data, error } = await supabase.functions.invoke('admin-order-action', { body: payload });
  if (error) throw new Error(await readAdminFunctionError(error));
  if (data?.error) throw new Error(friendlyAdminError(String(data.error)));
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
