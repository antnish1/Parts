import { supabase } from '../lib/supabase';

export type CreditDispatchRecord = {
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
  approval_status: 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Correction Required';
  recovery_status: 'Pending Payment' | 'Partial Payment' | 'Partial Payment - Overdue' | 'Payment Overdue' | 'Closed';
  remarks: string | null;
  rejection_reason?: string | null;
  correction_note?: string | null;
  customer_signature_path: string | null;
  issuer_signature_path: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type CreditDispatchFormInput = {
  branch: string;
  customerName: string;
  customerType: CreditDispatchRecord['customer_type'];
  mobileNo: string;
  documentType: CreditDispatchRecord['document_type'];
  documentNo: string;
  documentDate: string;
  creditAmount: number;
  tentativeClosureDays: 7 | 15 | 30;
  remarks: string;
  customerSignatureDataUrl: string;
  issuerSignatureDataUrl: string;
};

export type CreditDispatchApprovalAction = 'Approved' | 'Rejected' | 'Correction Required';

export type CreditDispatchPaymentInput = {
  dispatchId: string;
  receivedAmount: number;
  receivedDate: string;
  paymentMode: 'Cash' | 'UPI' | 'Bank' | 'Cheque' | 'Adjustment' | 'Other';
  referenceNo?: string;
  remarks?: string;
};

function dataUrlToBlob(dataUrl: string) {
  const [meta, content] = dataUrl.split(',');
  const mime = meta.match(/data:(.*?);base64/)?.[1] ?? 'image/png';
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

async function uploadSignature(dataUrl: string, type: 'customer' | 'issuer') {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id ?? 'unknown-user';
  const path = `${userId}/${Date.now()}-${type}-signature.png`;
  const blob = dataUrlToBlob(dataUrl);

  const { error } = await supabase.storage.from('credit-dispatch-signatures').upload(path, blob, {
    contentType: 'image/png',
    upsert: false,
  });

  if (error) throw error;
  return path;
}

async function addEvent(dispatchId: string, eventType: string, eventNote?: string) {
  const { error } = await supabase.from('portal_credit_dispatch_events').insert({
    dispatch_id: dispatchId,
    event_type: eventType,
    event_note: eventNote?.trim() || null,
  });
  if (error) throw error;
}

export async function getCreditDispatches() {
  const { data, error } = await supabase
    .from('portal_credit_dispatches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) throw error;
  return (data ?? []) as CreditDispatchRecord[];
}

export async function createCreditDispatch(input: CreditDispatchFormInput) {
  const customerSignaturePath = await uploadSignature(input.customerSignatureDataUrl, 'customer');
  const issuerSignaturePath = await uploadSignature(input.issuerSignatureDataUrl, 'issuer');
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('portal_credit_dispatches')
    .insert({
      branch: input.branch,
      customer_name: input.customerName.trim(),
      customer_type: input.customerType,
      mobile_no: input.mobileNo.trim(),
      document_type: input.documentType,
      document_no: input.documentNo.trim() || null,
      document_date: input.documentDate,
      credit_amount: input.creditAmount,
      tentative_closure_days: input.tentativeClosureDays,
      due_date: new Date(new Date(input.documentDate).getTime() + input.tentativeClosureDays * 86400000).toISOString().slice(0, 10),
      approval_status: 'Pending Approval',
      remarks: input.remarks.trim() || null,
      customer_signature_path: customerSignaturePath,
      issuer_signature_path: issuerSignaturePath,
      customer_signed_at: nowIso,
      issuer_signed_at: nowIso,
    })
    .select('*')
    .single();

  if (error) throw error;
  await addEvent(data.id, 'Submitted for Approval', 'Credit dispatch request submitted digitally with customer and issuer signatures.');
  return data as CreditDispatchRecord;
}

export async function updateCreditDispatchApproval(dispatchId: string, action: CreditDispatchApprovalAction, note: string, approverProfileId?: string) {
  const patch: Record<string, unknown> = {
    approval_status: action,
    updated_at: new Date().toISOString(),
  };

  if (action === 'Approved') {
    patch.approved_by = approverProfileId ?? null;
    patch.approved_at = new Date().toISOString();
    patch.rejection_reason = null;
    patch.correction_note = null;
  }

  if (action === 'Rejected') {
    patch.rejection_reason = note.trim() || 'Rejected by manager';
  }

  if (action === 'Correction Required') {
    patch.correction_note = note.trim() || 'Correction required';
  }

  const { error } = await supabase.from('portal_credit_dispatches').update(patch).eq('id', dispatchId);
  if (error) throw error;
  await addEvent(dispatchId, action, note || action);
}

export async function addCreditDispatchPayment(input: CreditDispatchPaymentInput) {
  const { error } = await supabase.from('portal_credit_dispatch_payments').insert({
    dispatch_id: input.dispatchId,
    received_amount: input.receivedAmount,
    received_date: input.receivedDate,
    payment_mode: input.paymentMode,
    reference_no: input.referenceNo?.trim() || null,
    remarks: input.remarks?.trim() || null,
  });

  if (error) throw error;
  await addEvent(input.dispatchId, 'Payment Added', `${formatMoney(input.receivedAmount)} received on ${input.receivedDate}. ${input.remarks ?? ''}`);
}

export function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export function calculateDueDate(documentDate: string, days: number) {
  if (!documentDate) return '';
  return new Date(new Date(documentDate).getTime() + days * 86400000).toISOString().slice(0, 10);
}
