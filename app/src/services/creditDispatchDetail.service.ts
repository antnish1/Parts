import { supabase } from '../lib/supabase';
import { getCurrentPortalProfile } from './branchScope.service';
import { deriveCreditDispatchRecoveryStatus, type CreditDispatchRecord } from './creditDispatch.service';

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
  actor_name: string | null;
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

function withDerivedRecoveryStatus(row: CreditDispatchRecord): CreditDispatchRecord {
  if (row.approval_status !== 'Approved') return row;
  const recoveryStatus = deriveCreditDispatchRecoveryStatus(row);
  return recoveryStatus === row.recovery_status ? row : { ...row, recovery_status: recoveryStatus };
}

async function attachEventActorNames(events: Omit<CreditDispatchEvent, 'actor_name'>[]): Promise<CreditDispatchEvent[]> {
  const profileIds = [...new Set(events.map((event) => event.created_by).filter((id): id is string => Boolean(id)))];
  if (!profileIds.length) return events.map((event) => ({ ...event, actor_name: null }));

  const { data: profiles, error } = await supabase
    .from('portal_profiles')
    .select('id,full_name')
    .in('id', profileIds);

  if (error) {
    console.warn('Credit dispatch event author lookup failed.', error.message);
    return events.map((event) => ({ ...event, actor_name: null }));
  }

  const names = new Map((profiles ?? []).map((profile) => [String(profile.id), String(profile.full_name ?? '').trim()]));
  return events.map((event) => ({ ...event, actor_name: event.created_by ? names.get(event.created_by) || null : null }));
}

export async function getCreditDispatchDetail(dispatchId: string): Promise<CreditDispatchDetail> {
  const dispatchQuery = supabase.from('portal_credit_dispatches').select('*').eq('id', dispatchId).single();
  const paymentsQuery = supabase.from('portal_credit_dispatch_payments').select('*').eq('dispatch_id', dispatchId).order('received_date', { ascending: false }).order('created_at', { ascending: false });
  const eventsQuery = supabase.from('portal_credit_dispatch_events').select('*').eq('dispatch_id', dispatchId).order('created_at', { ascending: false });

  const [{ data: dispatch, error: dispatchError }, { data: payments, error: paymentsError }, { data: events, error: eventsError }] = await Promise.all([dispatchQuery, paymentsQuery, eventsQuery]);

  if (dispatchError) throw dispatchError;
  if (paymentsError) throw paymentsError;
  if (eventsError) throw eventsError;

  const record = withDerivedRecoveryStatus(dispatch as CreditDispatchRecord);
  const rawEvents = (events ?? []) as Omit<CreditDispatchEvent, 'actor_name'>[];
  const [customerSignatureUrl, issuerSignatureUrl, eventsWithActors] = await Promise.all([
    getSignedSignatureUrl(record.customer_signature_path),
    getSignedSignatureUrl(record.issuer_signature_path),
    attachEventActorNames(rawEvents),
  ]);

  return {
    dispatch: record,
    payments: (payments ?? []) as CreditDispatchPayment[],
    events: eventsWithActors,
    customerSignatureUrl,
    issuerSignatureUrl,
  };
}

export async function addCreditDispatchComment(dispatchId: string, note: string) {
  const comment = note.trim();
  if (!dispatchId) throw new Error('Credit Dispatch record is required.');
  if (!comment) throw new Error('Enter a comment before saving.');
  if (comment.length > 2000) throw new Error('Comment cannot exceed 2000 characters.');

  const profile = await getCurrentPortalProfile();
  if (!profile?.id || !profile.is_active) throw new Error('An active portal user is required to add a comment.');

  const { error } = await supabase.from('portal_credit_dispatch_events').insert({
    dispatch_id: dispatchId,
    event_type: 'Comment',
    event_note: comment,
    created_by: profile.id,
  });

  if (error) throw error;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
