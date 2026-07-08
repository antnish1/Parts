import { supabase } from '../lib/supabase';
import { formatMoney, type CreditDispatchRecord } from './creditDispatch.service';

export type CreditCustomer = {
  id: string;
  customer_name: string;
  mobile_no: string;
  customer_type: CreditDispatchRecord['customer_type'];
  default_branch: string | null;
  address: string | null;
  gst_no: string | null;
  business_partner_code: string | null;
  credit_limit: number | null;
  risk_category: 'Green' | 'Amber' | 'Red';
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreditCustomerOutstanding = {
  customer_id: string;
  customer_name: string;
  mobile_no: string;
  customer_type: CreditDispatchRecord['customer_type'];
  default_branch: string | null;
  credit_limit: number | null;
  total_credit: number;
  total_received: number;
  outstanding: number;
  overdue: number;
  last_credit_date: string | null;
  last_payment_date: string | null;
  risk_category: 'Green' | 'Amber' | 'Red';
};

export type CreditCustomerLedgerRow = {
  customer_id: string;
  dispatch_id: string;
  transaction_date: string;
  sort_at: string;
  entry_type: 'Credit Dispatch' | 'Payment Received';
  particulars: string;
  document_type: CreditDispatchRecord['document_type'];
  document_no: string | null;
  branch: string;
  debit: number;
  credit: number;
};

export type CustomerSuggestion = CreditCustomerOutstanding & { label: string };

export function riskTone(risk: string) {
  if (risk === 'Red') return 'border-red-200 bg-red-50 text-red-700';
  if (risk === 'Amber') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

export async function searchCreditCustomers(query: string) {
  const q = query.trim();
  if (q.length < 2) return [] as CustomerSuggestion[];
  const { data, error } = await supabase
    .from('portal_credit_customer_outstanding_view')
    .select('*')
    .or(`customer_name.ilike.%${q}%,mobile_no.ilike.%${q}%`)
    .order('outstanding', { ascending: false })
    .limit(8);

  if (error) throw error;
  return ((data ?? []) as CreditCustomerOutstanding[]).map((row) => ({
    ...row,
    label: `${row.customer_name} • ${row.mobile_no} • ${formatMoney(row.outstanding)}`,
  }));
}

export async function getCreditCustomerOutstanding() {
  const { data, error } = await supabase
    .from('portal_credit_customer_outstanding_view')
    .select('*')
    .order('outstanding', { ascending: false });

  if (error) throw error;
  return (data ?? []) as CreditCustomerOutstanding[];
}

export async function getCreditCustomerLedger(customerId: string) {
  const [summaryResult, ledgerResult] = await Promise.all([
    supabase.from('portal_credit_customer_outstanding_view').select('*').eq('customer_id', customerId).single(),
    supabase.from('portal_credit_customer_ledger_view').select('*').eq('customer_id', customerId).order('transaction_date', { ascending: true }).order('sort_at', { ascending: true }),
  ]);

  if (summaryResult.error) throw summaryResult.error;
  if (ledgerResult.error) throw ledgerResult.error;

  let balance = 0;
  const ledger = ((ledgerResult.data ?? []) as CreditCustomerLedgerRow[]).map((row) => {
    balance += Number(row.debit || 0) - Number(row.credit || 0);
    return { ...row, balance };
  });

  return {
    summary: summaryResult.data as CreditCustomerOutstanding,
    ledger,
  };
}
