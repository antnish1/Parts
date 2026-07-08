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
  is_active?: boolean;
  total_credit: number;
  total_received: number;
  outstanding: number;
  overdue: number;
  last_credit_date: string | null;
  last_payment_date: string | null;
  risk_category: 'Green' | 'Amber' | 'Red';
};

export type CreditCustomerAging = {
  customer_id: string;
  customer_name: string;
  mobile_no: string;
  customer_type: CreditDispatchRecord['customer_type'];
  default_branch: string | null;
  credit_limit: number | null;
  is_active?: boolean;
  outstanding: number;
  bucket_0_7: number;
  bucket_8_15: number;
  bucket_16_30: number;
  bucket_30_plus: number;
  overdue: number;
  latest_due_date: string | null;
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

export function buildPaymentReminder(customer: Pick<CreditCustomerOutstanding, 'customer_name' | 'mobile_no' | 'outstanding' | 'overdue'>) {
  const amount = Number(customer.overdue || 0) > 0 ? customer.overdue : customer.outstanding;
  return `Dear ${customer.customer_name}, payment of ${formatMoney(amount)} is pending against your credit dispatch account. Kindly arrange payment at the earliest. - Frontier Commercial Vehicle Pvt. Ltd.`;
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

export async function getCreditCustomerAging() {
  const { data, error } = await supabase
    .from('portal_credit_customer_aging_view')
    .select('*')
    .order('overdue', { ascending: false });

  if (error) throw error;
  return (data ?? []) as CreditCustomerAging[];
}

export async function getCreditCustomer(customerId: string) {
  const { data, error } = await supabase.from('portal_credit_customers').select('*').eq('id', customerId).single();
  if (error) throw error;
  return data as CreditCustomer;
}

export async function updateCreditCustomer(customer: Pick<CreditCustomer, 'id' | 'customer_name' | 'mobile_no' | 'customer_type' | 'default_branch' | 'address' | 'gst_no' | 'business_partner_code' | 'credit_limit'>) {
  if (!customer.customer_name.trim()) throw new Error('Customer name is required.');
  if (!/^\d{10}$/.test(customer.mobile_no.trim())) throw new Error('Enter a valid 10 digit mobile number.');
  const { error } = await supabase
    .from('portal_credit_customers')
    .update({
      customer_name: customer.customer_name.trim(),
      mobile_no: customer.mobile_no.trim(),
      customer_type: customer.customer_type,
      default_branch: customer.default_branch?.trim() || null,
      address: customer.address?.trim() || null,
      gst_no: customer.gst_no?.trim() || null,
      business_partner_code: customer.business_partner_code?.trim() || null,
      credit_limit: customer.credit_limit ? Number(customer.credit_limit) : null,
    })
    .eq('id', customer.id);
  if (error) throw error;
}

export async function mergeCreditCustomers(sourceCustomerId: string, targetCustomerId: string) {
  if (!sourceCustomerId || !targetCustomerId) throw new Error('Select both customers.');
  if (sourceCustomerId === targetCustomerId) throw new Error('Source and target customer cannot be same.');
  const { error } = await supabase.rpc('portal_merge_credit_customers', {
    p_source_customer_id: sourceCustomerId,
    p_target_customer_id: targetCustomerId,
  });
  if (error) throw error;
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
