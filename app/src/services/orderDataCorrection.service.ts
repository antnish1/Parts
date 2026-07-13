import { supabase } from '../lib/supabase';

export type CorrectionOrder = {
  id: string;
  order_no: string;
  final_order_no: string | null;
  processing_reference: string | null;
  branch: string;
  order_type: string;
  order_for: string;
  machine_no: string | null;
  customer_name: string | null;
  contact_no: string | null;
  call_id: string | null;
  warranty_status: string | null;
  status: string;
  approval_status: string;
  processed_date: string | null;
  dbms_invoice_no: string | null;
  dbms_invoice_date: string | null;
  updated_at: string;
};

export type CorrectionBilling = {
  id: string;
  item_id: string;
  order_id: string;
  order_no: string;
  part_no: string;
  billed_qty: number;
  received_qty: number;
  billing_date: string | null;
  order_reg_date: string | null;
  delivery_no: string | null;
  invoice_no: string | null;
  docket_no: string | null;
  transport_name: string | null;
  transport_mode: string | null;
  packing_detail: string | null;
  eway_bill_no: string | null;
  gst_invoice_no: string | null;
  raw_status: string | null;
  received_at: string | null;
  updated_at: string;
};

export type CorrectionItem = {
  id: string;
  order_id: string;
  part_no: string;
  description: string | null;
  dnp: number | null;
  qty: number;
  edited_qty: number | null;
  billed_qty: number;
  value: number | null;
  edited_value: number | null;
  order_reg_date: string | null;
  dbms_invoice_no: string | null;
  dbms_invoice_date: string | null;
  docket_no: string | null;
  transport_name: string | null;
  received_date: string | null;
  row_status: string | null;
  dispatch_status_legacy: string | null;
  updated_at: string;
  billings: CorrectionBilling[];
};

export type CorrectionEvent = {
  id: string;
  event_type: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CorrectionConsoleData = {
  order: CorrectionOrder;
  items: CorrectionItem[];
  events: CorrectionEvent[];
};

export type PartMasterMatch = {
  part_no: string;
  description: string | null;
  dnp: number | null;
};

export type CorrectionAction =
  | 'update_order'
  | 'update_item'
  | 'create_item'
  | 'update_billing'
  | 'create_billing'
  | 'delete_item'
  | 'delete_billing';

export type CorrectionPayload = {
  action: CorrectionAction;
  orderId: string;
  itemId?: string;
  billingId?: string;
  expectedUpdatedAt?: string;
  changes?: Record<string, unknown>;
  reason: string;
  category: string;
  reference?: string;
  updateLinkedBillings?: boolean;
  syncMatchingItems?: boolean;
  deleteLinkedBillings?: boolean;
};

function functionError(error: unknown, fallback: string) {
  const value = error as { message?: string; context?: { status?: number; statusText?: string } } | null;
  const status = value?.context?.status;
  return `${value?.message || fallback}${status ? ` (${status}${value?.context?.statusText ? ` ${value.context.statusText}` : ''})` : ''}`;
}

export async function getOrderCorrectionConsole(orderId: string): Promise<CorrectionConsoleData> {
  const { data, error } = await supabase.functions.invoke('order-data-correction-action', {
    body: { action: 'read', orderId },
  });
  if (error) throw new Error(functionError(error, 'Could not load correction console.'));
  if (!data?.ok) throw new Error(data?.error || 'Could not load correction console.');
  return data.data as CorrectionConsoleData;
}

export async function submitOrderCorrection(payload: CorrectionPayload) {
  const { data, error } = await supabase.functions.invoke('order-data-correction-action', { body: payload });
  if (error) throw new Error(functionError(error, 'Could not save correction.'));
  if (!data?.ok) throw new Error(data?.error || 'Could not save correction.');
  return data.data as CorrectionConsoleData;
}

export async function lookupCorrectionPart(partNo: string): Promise<PartMasterMatch | null> {
  const normalized = partNo.trim().replace(/\s+/g, '').toUpperCase();
  if (!normalized) return null;
  const { data, error } = await supabase.functions.invoke('lookup-part-action', { body: { partNo: normalized } });
  if (error) throw new Error(functionError(error, 'Part lookup failed.'));
  if (!data?.ok) throw new Error(data?.error || 'Part lookup failed.');
  return (data.part ?? null) as PartMasterMatch | null;
}
