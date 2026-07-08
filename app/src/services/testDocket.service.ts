import { supabase } from '../lib/supabase';
import { getCurrentBranchScopeValues } from './branchScope.service';

export type TestDocketRow = {
  id: string;
  source_type: 'billing' | 'item';
  order_id: string;
  item_id: string;
  order_no: string;
  final_order_no: string | null;
  branch: string;
  order_type: string | null;
  order_for: string | null;
  customer_name: string | null;
  machine_no: string | null;
  order_status: string;
  approval_status: string | null;
  part_no: string;
  description: string | null;
  ordered_qty: number;
  edited_qty: number | null;
  item_status: string | null;
  invoice_no: string | null;
  billing_date: string | null;
  docket_no: string | null;
  transport_name: string | null;
  delivery_no: string | null;
  billed_qty: number;
  received_qty: number;
  received_at: string | null;
  raw_status: string | null;
  created_at: string;
};

export function normalizeDocketNo(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

function safeSearch(value: string) {
  return normalizeDocketNo(value).replace(/[^A-Z0-9/_-]/g, '');
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedStatus(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function docketPattern(value: string) {
  const docket = safeSearch(value);
  if (!docket || docket === '0') return '';
  return `%${docket}%`;
}

type RawDocketChunk = {
  id: string;
  order_id: string;
  item_id: string;
  order_no: string;
  part_no: string;
  billed_qty: number | null;
  received_qty: number | null;
  received_at: string | null;
  billing_date: string | null;
  delivery_no: string | null;
  invoice_no: string | null;
  docket_no: string | null;
  transport_name: string | null;
  raw_status: string | null;
  created_at: string;
  order?: { id: string; order_no: string; final_order_no: string | null; branch: string; order_type: string | null; order_for: string | null; customer_name: string | null; machine_no: string | null; status: string; approval_status: string | null } | Array<{ id: string; order_no: string; final_order_no: string | null; branch: string; order_type: string | null; order_for: string | null; customer_name: string | null; machine_no: string | null; status: string; approval_status: string | null }> | null;
  item?: { id: string; part_no: string; description: string | null; qty: number | null; edited_qty: number | null; row_status: string | null } | Array<{ id: string; part_no: string; description: string | null; qty: number | null; edited_qty: number | null; row_status: string | null }> | null;
};

type RawItemDocketRow = {
  id: string;
  order_id: string;
  part_no: string;
  description: string | null;
  qty: number | null;
  edited_qty: number | null;
  billed_qty: number | null;
  row_status: string | null;
  dbms_invoice_no: string | null;
  dbms_invoice_date: string | null;
  docket_no: string | null;
  transport_name: string | null;
  received_date: string | null;
  created_at: string;
  order?: { id: string; order_no: string; final_order_no: string | null; branch: string; order_type: string | null; order_for: string | null; customer_name: string | null; machine_no: string | null; status: string; approval_status: string | null } | Array<{ id: string; order_no: string; final_order_no: string | null; branch: string; order_type: string | null; order_for: string | null; customer_name: string | null; machine_no: string | null; status: string; approval_status: string | null }> | null;
};

function normalizeChunkRow(row: RawDocketChunk): TestDocketRow {
  const order = one(row.order);
  const item = one(row.item);
  return {
    id: row.id,
    source_type: 'billing',
    order_id: row.order_id,
    item_id: row.item_id,
    order_no: order?.order_no ?? row.order_no,
    final_order_no: order?.final_order_no ?? null,
    branch: order?.branch ?? '-',
    order_type: order?.order_type ?? null,
    order_for: order?.order_for ?? null,
    customer_name: order?.customer_name ?? null,
    machine_no: order?.machine_no ?? null,
    order_status: order?.status ?? '-',
    approval_status: order?.approval_status ?? null,
    part_no: item?.part_no ?? row.part_no,
    description: item?.description ?? null,
    ordered_qty: toNumber(item?.qty),
    edited_qty: item?.edited_qty ?? null,
    item_status: item?.row_status ?? null,
    invoice_no: row.invoice_no,
    billing_date: row.billing_date,
    docket_no: row.docket_no,
    transport_name: row.transport_name,
    delivery_no: row.delivery_no,
    billed_qty: toNumber(row.billed_qty),
    received_qty: toNumber(row.received_qty),
    received_at: row.received_at,
    raw_status: row.raw_status,
    created_at: row.created_at,
  };
}

function normalizeItemRow(row: RawItemDocketRow): TestDocketRow {
  const order = one(row.order);
  const status = normalizedStatus(row.row_status);
  const billed = toNumber(row.billed_qty);
  const received = ['received', 'issued'].includes(status) ? billed : 0;
  return {
    id: row.id,
    source_type: 'item',
    order_id: row.order_id,
    item_id: row.id,
    order_no: order?.order_no ?? '-',
    final_order_no: order?.final_order_no ?? null,
    branch: order?.branch ?? '-',
    order_type: order?.order_type ?? null,
    order_for: order?.order_for ?? null,
    customer_name: order?.customer_name ?? null,
    machine_no: order?.machine_no ?? null,
    order_status: order?.status ?? '-',
    approval_status: order?.approval_status ?? null,
    part_no: row.part_no,
    description: row.description,
    ordered_qty: toNumber(row.qty),
    edited_qty: row.edited_qty ?? null,
    item_status: row.row_status,
    invoice_no: row.dbms_invoice_no,
    billing_date: row.dbms_invoice_date,
    docket_no: row.docket_no,
    transport_name: row.transport_name,
    delivery_no: null,
    billed_qty: billed,
    received_qty: received,
    received_at: row.received_date,
    raw_status: row.row_status,
    created_at: row.created_at,
  };
}

async function fetchBillingRows(docket: string, branchValues: string[] | null | undefined) {
  const pattern = docketPattern(docket);
  if (!pattern) return [];

  let query = supabase
    .from('portal_order_item_billings')
    .select('id, order_id, item_id, order_no, part_no, billed_qty, received_qty, received_at, billing_date, delivery_no, invoice_no, docket_no, transport_name, raw_status, created_at, order:portal_orders!inner(id, order_no, final_order_no, branch, order_type, order_for, customer_name, machine_no, status, approval_status), item:portal_order_items!inner(id, part_no, description, qty, edited_qty, row_status)')
    .ilike('docket_no', pattern)
    .limit(500);

  if (branchValues?.length) query = query.in('order.branch', branchValues);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as RawDocketChunk[]).map(normalizeChunkRow);
}

async function fetchItemRows(docket: string, branchValues: string[] | null | undefined) {
  const pattern = docketPattern(docket);
  if (!pattern) return [];

  let query = supabase
    .from('portal_order_items')
    .select('id, order_id, part_no, description, qty, edited_qty, billed_qty, row_status, dbms_invoice_no, dbms_invoice_date, docket_no, transport_name, received_date, created_at, order:portal_orders!inner(id, order_no, final_order_no, branch, order_type, order_for, customer_name, machine_no, status, approval_status)')
    .ilike('docket_no', pattern)
    .limit(500);

  if (branchValues?.length) query = query.in('order.branch', branchValues);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as RawItemDocketRow[]).map(normalizeItemRow);
}

export async function lookupTestDocketRows(value: string): Promise<TestDocketRow[]> {
  const docket = safeSearch(value);
  if (!docket || docket === '0') return [];
  const branchValues = await getCurrentBranchScopeValues();

  const billingRows = await fetchBillingRows(docket, branchValues);
  const itemRows = await fetchItemRows(docket, branchValues);
  const chunkItemIds = new Set(billingRows.map((row) => row.item_id));
  const fallbackItemRows = itemRows.filter((row) => !chunkItemIds.has(row.item_id));

  return [...billingRows, ...fallbackItemRows].sort((a, b) => {
    const docketCompare = String(a.docket_no ?? '').localeCompare(String(b.docket_no ?? ''));
    if (docketCompare !== 0) return docketCompare;
    const orderCompare = String(a.order_no).localeCompare(String(b.order_no));
    if (orderCompare !== 0) return orderCompare;
    return String(a.part_no).localeCompare(String(b.part_no));
  }).slice(0, 200);
}

export async function receiveTestDocketRow(row: TestDocketRow) {
  if (!row.id) throw new Error('Docket row id is required.');
  const status = normalizedStatus(row.item_status || row.order_status);
  if ((row.received_qty >= row.billed_qty && row.billed_qty > 0) || status === 'received' || status === 'issued') throw new Error('This row is already received.');

  const body = row.source_type === 'billing'
    ? { billingId: row.id }
    : { itemId: row.item_id, docketNo: row.docket_no };

  const { data, error } = await supabase.functions.invoke('docket-receive-action', { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export const lookupTestDocketOrders = lookupTestDocketRows;
export const markTestDocketReceived = receiveTestDocketRow;
