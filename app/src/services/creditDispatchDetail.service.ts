import { supabase } from '../lib/supabase';
import type { CreditDispatchRecord } from './creditDispatch.service';

export type CreditDispatchPayment = {
  id: string;
  dispatch_id: string;
  received_amount: number;
  received_date: string;
  payment_mode: 'Cash' | 'UPI' | 'Bank' | 'Cheque' | 'Adjustment' | 'Other';
  reference_no: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
};

export type CreditDispatchEvent = {
  id: string;
  dispatch_id: string;
  event_type: string;
  event_note: string | null;
  created_by: string | null;
  created_at: string;
};

export type CreditDispatchDetail = {
  dispatch: CreditDispatchRecord;
  payments: CreditDispatchPayment[];
  events: CreditDispatchEvent[];
  customerSignatureUrl: string | null;
  issuerSignatureUrl: string | null;
};

async function getSignedSignatureUrl(path: string | null | undefined) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('credit-dispatch-signatures').createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function getCreditDispatchDetail(dispatchId: string): Promise<CreditDispatchDetail> {
  const dispatchQuery = supabase.from('portal_credit_dispatches').select('*').eq('id', dispatchId).single();
  const paymentsQuery = supabase.from('portal_credit_dispatch_payments').select('*').eq('dispatch_id', dispatchId).order('received_date', { ascending: false }).order('created_at', { ascending: false });
  const eventsQuery = supabase.from('portal_credit_dispatch_events').select('*').eq('dispatch_id', dispatchId).order('created_at', { ascending: false });

  const [{ data: dispatch, error: dispatchError }, { data: payments, error: paymentsError }, { data: events, error: eventsError }] = await Promise.all([dispatchQuery, paymentsQuery, eventsQuery]);

  if (dispatchError) throw dispatchError;
  if (paymentsError) throw paymentsError;
  if (eventsError) throw eventsError;

  const record = dispatch as CreditDispatchRecord;
  const [customerSignatureUrl, issuerSignatureUrl] = await Promise.all([
    getSignedSignatureUrl(record.customer_signature_path),
    getSignedSignatureUrl(record.issuer_signature_path),
  ]);

  return {
    dispatch: record,
    payments: (payments ?? []) as CreditDispatchPayment[],
    events: (events ?? []) as CreditDispatchEvent[],
    customerSignatureUrl,
    issuerSignatureUrl,
  };
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
