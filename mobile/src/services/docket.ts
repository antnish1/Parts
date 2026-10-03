import { supabase } from '@/lib/supabase';
import { getCurrentPortalProfile } from '@/services/profile';

export type DocketRow = {
  id: string;
  source_type: 'billing' | 'item';
  order_id: string;
  item_id: string;
  order_no: string;
  final_order_no: string | null;
  branch: string;
  order_type: string | null;
  customer_name: string | null;
  machine_no: string | null;
  order_status: string;
  part_no: string;
  description: string | null;
  ordered_qty: number;
  edited_qty: number | null;
  item_status: string | null;
  invoice_no: string | null;
  billing_date: string | null;
  docket_no: string | null;
  transport_name: string | null;
  billed_qty: number;
  received_qty: number;
  received_at: string | null;
};

export function normalizeDocketNo(value: string) {
  return value.trim().replace(/\s+/g, '').replace(/[^A-Za-z0-9/_-]/g, '').toUpperCase();
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function currentBranchScope() {
  const profile = await getCurrentPortalProfile();
  return profile?.role === 'branch' && profile.branch ? [profile.branch] : null;
}

export async function lookupDocketRows(value: string): Promise<DocketRow[]> {
  const docket = normalizeDocketNo(value);
  if (!docket || docket === '0') return [];
  const branchValues = await currentBranchScope();
  const pattern = `%${docket}%`;

  let billingQuery = supabase
    .from('portal_order_item_billings')
    .select('id, order_id, item_id, order_no, part_no, billed_qty, received_qty, received_at, billing_date, invoice_no, docket_no, transport_name, order:portal_orders!inner(order_no, final_order_no, branch, order_type, customer_name, machine_no, status), item:portal_order_items!inner(part_no, description, qty, edited_qty, row_status)')
    .ilike('docket_no', pattern)
    .limit(200);
  if (branchValues?.length) billingQuery = billingQuery.in('order.branch', branchValues);
  const billing = await billingQuery;
  if (billing.error) throw billing.error;

  let itemQuery = supabase
    .from('portal_order_items')
    .select('id, order_id, part_no, description, qty, edited_qty, billed_qty, row_status, dbms_invoice_no, dbms_invoice_date, docket_no, transport_name, received_date, order:portal_orders!inner(order_no, final_order_no, branch, order_type, customer_name, machine_no, status)')
    .ilike('docket_no', pattern)
    .limit(200);
  if (branchValues?.length) itemQuery = itemQuery.in('order.branch', branchValues);
  const itemRows = await itemQuery;
  if (itemRows.error) throw itemRows.error;

  const billingRows = (billing.data ?? []).map((raw: any): DocketRow => {
    const order = one(raw.order);
    const item = one(raw.item);
    return {
      id: raw.id, source_type: 'billing', order_id: raw.order_id, item_id: raw.item_id,
      order_no: order?.order_no ?? raw.order_no, final_order_no: order?.final_order_no ?? null,
      branch: order?.branch ?? '-', order_type: order?.order_type ?? null, customer_name: order?.customer_name ?? null,
      machine_no: order?.machine_no ?? null, order_status: order?.status ?? '-', part_no: item?.part_no ?? raw.part_no,
      description: item?.description ?? null, ordered_qty: num(item?.qty), edited_qty: item?.edited_qty ?? null,
      item_status: item?.row_status ?? null, invoice_no: raw.invoice_no ?? null, billing_date: raw.billing_date ?? null,
      docket_no: raw.docket_no ?? null, transport_name: raw.transport_name ?? null, billed_qty: num(raw.billed_qty),
      received_qty: num(raw.received_qty), received_at: raw.received_at ?? null,
    };
  });

  const billedItemIds = new Set(billingRows.map((row) => row.item_id));
  const fallbackRows = (itemRows.data ?? []).filter((raw: any) => !billedItemIds.has(raw.id)).map((raw: any): DocketRow => {
    const order = one(raw.order);
    const normalizedStatus = String(raw.row_status ?? '').toLowerCase().replace(/[\s-]+/g, '_');
    const billed = num(raw.billed_qty);
    return {
      id: raw.id, source_type: 'item', order_id: raw.order_id, item_id: raw.id,
      order_no: order?.order_no ?? '-', final_order_no: order?.final_order_no ?? null,
      branch: order?.branch ?? '-', order_type: order?.order_type ?? null, customer_name: order?.customer_name ?? null,
      machine_no: order?.machine_no ?? null, order_status: order?.status ?? '-', part_no: raw.part_no,
      description: raw.description ?? null, ordered_qty: num(raw.qty), edited_qty: raw.edited_qty ?? null,
      item_status: raw.row_status ?? null, invoice_no: raw.dbms_invoice_no ?? null, billing_date: raw.dbms_invoice_date ?? null,
      docket_no: raw.docket_no ?? null, transport_name: raw.transport_name ?? null, billed_qty: billed,
      received_qty: ['received', 'issued'].includes(normalizedStatus) ? billed : 0, received_at: raw.received_date ?? null,
    };
  });

  return [...billingRows, ...fallbackRows].sort((a, b) => `${a.order_no}${a.part_no}`.localeCompare(`${b.order_no}${b.part_no}`));
}

export function isDocketRowReceived(row: DocketRow) {
  const status = String(row.item_status || row.order_status).toLowerCase().replace(/[\s-]+/g, '_');
  return (row.billed_qty > 0 && row.received_qty >= row.billed_qty) || status === 'received' || status === 'issued';
}

export async function receiveDocketRow(row: DocketRow) {
  if (isDocketRowReceived(row)) throw new Error('This row is already received.');
  const body = row.source_type === 'billing' ? { billingId: row.id } : { itemId: row.item_id, docketNo: row.docket_no };
  const { data, error } = await supabase.functions.invoke('docket-receive-action', { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}
