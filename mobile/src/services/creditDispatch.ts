import { supabase } from '@/lib/supabase';

export type CreditDispatchStatus = 'Draft' | 'Pending Accounts Approval' | 'Pending Manager Approval' | 'Approved' | 'Rejected by Accounts' | 'Rejected by Manager' | 'Correction Requested by Accounts' | 'Correction Requested by Manager';
export type RecoveryStatus = 'Pending Payment' | 'Partial Payment' | 'Partial Payment - Overdue' | 'Payment Overdue' | 'Closed';

export type CreditDispatch = {
  id: string;
  dispatch_no: string | null;
  branch: string;
  customer_name: string;
  customer_type: 'Major Account' | 'Retailer' | 'Customer';
  mobile_no: string;
  document_type: 'DC' | 'Tax Invoice' | 'PI';
  document_no: string | null;
  document_date: string;
  credit_amount: number;
  tentative_closure_days: 7 | 15 | 30;
  due_date: string;
  total_received_amount: number;
  balance_amount: number;
  approval_status: CreditDispatchStatus;
  recovery_status: RecoveryStatus;
  remarks: string | null;
  rejection_reason: string | null;
  correction_note: string | null;
  customer_signature_path: string | null;
  issuer_signature_path: string | null;
  sales_employee_name: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreditPayment = {
  id: string;
  dispatch_id: string;
  received_amount: number;
  received_date: string;
  payment_mode: string;
  reference_no: string | null;
  remarks: string | null;
  created_at: string;
};

export type CreditEvent = {
  id: string;
  dispatch_id: string;
  event_type: string;
  event_note: string | null;
  created_by: string | null;
  created_at: string;
  actor_name: string | null;
};

export function deriveRecovery(row: CreditDispatch): RecoveryStatus {
  if (row.approval_status !== 'Approved') return row.recovery_status;
  const credit = Number(row.credit_amount ?? 0);
  const received = Number(row.total_received_amount ?? 0);
  const balance = Number(row.balance_amount ?? 0);
  if (balance <= 0 || (credit > 0 && received >= credit)) return 'Closed';
  const pastDue = Boolean(row.due_date) && row.due_date < new Date().toISOString().slice(0, 10);
  if (received > 0 && pastDue) return 'Partial Payment - Overdue';
  if (received > 0) return 'Partial Payment';
  if (pastDue) return 'Payment Overdue';
  return 'Pending Payment';
}

function normalize(row: CreditDispatch): CreditDispatch {
  const recovery = deriveRecovery(row);
  return recovery === row.recovery_status ? row : { ...row, recovery_status: recovery };
}

export async function getCreditDispatches(limit = 300): Promise<CreditDispatch[]> {
  const { data, error } = await supabase.from('portal_credit_dispatches').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return ((data ?? []) as CreditDispatch[]).map(normalize);
}

export async function getCreditDispatchDetail(dispatchId: string) {
  const dispatchQuery = supabase.from('portal_credit_dispatches').select('*').eq('id', dispatchId).single();
  const paymentsQuery = supabase.from('portal_credit_dispatch_payments').select('*').eq('dispatch_id', dispatchId).order('received_date', { ascending: false }).order('created_at', { ascending: false });
  const eventsQuery = supabase.from('portal_credit_dispatch_events').select('*').eq('dispatch_id', dispatchId).order('created_at', { ascending: false });
  const [{ data: dispatch, error: dispatchError }, { data: payments, error: paymentsError }, { data: events, error: eventsError }] = await Promise.all([dispatchQuery, paymentsQuery, eventsQuery]);
  if (dispatchError) throw dispatchError;
  if (paymentsError) throw paymentsError;
  if (eventsError) throw eventsError;

  const rawEvents = (events ?? []) as Omit<CreditEvent, 'actor_name'>[];
  const ids = [...new Set(rawEvents.map((event) => event.created_by).filter((id): id is string => Boolean(id)))];
  let names = new Map<string, string>();
  if (ids.length) {
    const profiles = await supabase.from('portal_profiles').select('id, full_name').in('id', ids);
    if (!profiles.error) names = new Map((profiles.data ?? []).map((profile) => [String(profile.id), String(profile.full_name ?? '')]));
  }
  return {
    dispatch: normalize(dispatch as CreditDispatch),
    payments: (payments ?? []) as CreditPayment[],
    events: rawEvents.map((event) => ({ ...event, actor_name: event.created_by ? names.get(event.created_by) || null : null })) as CreditEvent[],
  };
}

export async function reviewCreditDispatch(dispatchId: string, action: 'Approved' | 'Rejected' | 'Correction Required', note: string) {
  if ((action === 'Rejected' || action === 'Correction Required') && !note.trim()) throw new Error('A reason is required.');
  const { error } = await supabase.rpc('portal_review_credit_dispatch', { p_dispatch_id: dispatchId, p_action: action, p_note: note.trim() || null });
  if (error) throw error;
}

export async function addCreditComment(dispatchId: string, note: string) {
  const value = note.trim();
  if (!value) throw new Error('Enter a comment first.');
  if (value.length > 2000) throw new Error('Comment cannot exceed 2000 characters.');
  const { error } = await supabase.from('portal_credit_dispatch_events').insert({ dispatch_id: dispatchId, event_type: 'Comment', event_note: value });
  if (error) throw error;
}

export function formatCreditMoney(value: number | null | undefined) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value ?? 0));
}
