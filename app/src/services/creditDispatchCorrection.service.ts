import { supabase } from '../lib/supabase';
import type { CreditDispatchRecord } from './creditDispatch.service';

export type CreditDispatchCorrectionInput = {
  dispatchId: string;
  customerName: string;
  customerType: CreditDispatchRecord['customer_type'];
  mobileNo: string;
  documentType: CreditDispatchRecord['document_type'];
  documentNo: string;
  documentDate: string;
  creditAmount: number;
  tentativeClosureDays: 7 | 15 | 30;
  remarks: string;
};

export async function resubmitCreditDispatchCorrection(input: CreditDispatchCorrectionInput) {
  const dueDate = new Date(new Date(input.documentDate).getTime() + input.tentativeClosureDays * 86400000).toISOString().slice(0, 10);

  const { error } = await supabase
    .from('portal_credit_dispatches')
    .update({
      customer_name: input.customerName.trim(),
      customer_type: input.customerType,
      mobile_no: input.mobileNo.trim(),
      document_type: input.documentType,
      document_no: input.documentNo.trim(),
      document_date: input.documentDate,
      credit_amount: input.creditAmount,
      tentative_closure_days: input.tentativeClosureDays,
      due_date: dueDate,
      remarks: input.remarks.trim() || null,
      approval_status: 'Pending Approval',
      correction_note: null,
      rejection_reason: null,
      approved_by: null,
      approved_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.dispatchId)
    .eq('approval_status', 'Correction Required');

  if (error) throw error;

  const { error: eventError } = await supabase.from('portal_credit_dispatch_events').insert({
    dispatch_id: input.dispatchId,
    event_type: 'Corrected and Resubmitted',
    event_note: 'Issuer branch corrected the request and sent it back for manager approval.',
  });

  if (eventError) throw eventError;
}
