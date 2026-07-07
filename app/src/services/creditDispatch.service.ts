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
  customer_signature_path: string | null;
  issuer_signature_path: string | null;
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

export async function getCreditDispatches() {
  const { data, error } = await supabase
    .from('portal_credit_dispatches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

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

  await supabase.from('portal_credit_dispatch_events').insert({
    dispatch_id: data.id,
    event_type: 'Submitted for Approval',
    event_note: 'Credit dispatch request submitted digitally with customer and issuer signatures.',
  });

  return data as CreditDispatchRecord;
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
