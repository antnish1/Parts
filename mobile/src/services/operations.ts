import { supabase } from '@/lib/supabase';
import { getBilledQty, getEffectiveQty, getEffectiveValue, getOrderStatusLabel, getReceivedQty, getResolvedRowStatus, type LegacyLikeOrderItem } from '@/lib/orderLogic';
import { getCurrentBranchScopeValues, normalizeBranchKey } from '@/services/branchScope';
import { getCurrentPortalProfile } from '@/services/profile';
import type { OrderSummary } from '@/services/orders';

export type PendingIssueOrder = {
  id: string; order_no: string; final_order_no: string | null; branch: string; order_type: string; customer_name: string | null; contact_no: string | null;
  machine_no: string | null; call_id: string | null; received_date: string | null; total_qty: number; total_value: number; age_days: number;
};
export type PendingIssuePart = { id: string; order_id: string; part_no: string; description: string | null; effective_qty: number; billed_qty: number; received_qty: number; item_status: string; effective_value: number };
export type DelayedVorOrder = OrderSummary & { age_days: number };

type OrderRow = {
  id: string; order_no: string; final_order_no: string | null; branch: string; order_type: string; order_for: string | null; customer_name: string | null;
  contact_no: string | null; machine_no: string | null; call_id: string | null; status: string | null; received_date: string | null; issued_at: string | null;
};
type ItemRow = LegacyLikeOrderItem & { id: string; order_id: string; part_no?: string | null; description?: string | null };
type BillingRow = { item_id: string; billed_qty: number | string | null; received_qty: number | string | null; received_at: string | null };

const PAGE_SIZE = 1000;
const ID_BATCH_SIZE = 150;
const BILLING_BATCH_SIZE = 200;
const ORDER_COLUMNS = 'id,order_no,branch,order_type,order_for,machine_no,customer_name,status,approval_status,approver_id,processing_reference,processed_date,final_order_no,dbms_invoice_no,dbms_invoice_date,received_date,docket_no,transport_name,total_qty,total_value,comment_count,created_at';

function ageDays(value: string | null | undefined) {
  if (!value) return 0;
  const start = new Date(value);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000));
}

function normalizeWorkflowStatus(value: unknown) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function isIssuedHeader(order: Pick<OrderRow, 'status' | 'issued_at'>) {
  return Boolean(order.issued_at) || normalizeWorkflowStatus(order.status) === 'ISSUED';
}

async function fetchAll<T>(
  factory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await factory(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchByIdBatches<T>(
  ids: string[],
  factory: (ids: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = [];
  for (let index = 0; index < ids.length; index += ID_BATCH_SIZE) {
    const batch = ids.slice(index, index + ID_BATCH_SIZE);
    rows.push(...await fetchAll<T>((from, to) => factory(batch, from, to)));
  }
  return rows;
}

async function getBillingChunksByItem(itemIds: string[]) {
  const result = new Map<string, BillingRow[]>();
  for (let index = 0; index < itemIds.length; index += BILLING_BATCH_SIZE) {
    const batch = itemIds.slice(index, index + BILLING_BATCH_SIZE);
    const rows = await fetchAll<BillingRow>((from, to) => supabase
      .from('portal_order_item_billings')
      .select('item_id,billed_qty,received_qty,received_at')
      .in('item_id', batch)
      .range(from, to));
    for (const row of rows) result.set(row.item_id, [...(result.get(row.item_id) ?? []), row]);
  }
  return result;
}

function withBillingChunks(items: ItemRow[], chunksByItem: Map<string, BillingRow[]>) {
  return items.map((item) => ({ ...item, billing_chunks: chunksByItem.get(item.id) ?? [] }));
}

async function getVisibleOrdersByIds(ids: string[]): Promise<OrderSummary[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return [];

  const profile = await getCurrentPortalProfile();
  const branchScope = await getCurrentBranchScopeValues();
  if (!profile?.is_active) return [];

  const rows = await fetchByIdBatches<OrderSummary>(uniqueIds, (batch, from, to) => {
    let query = supabase
      .from('portal_orders')
      .select(ORDER_COLUMNS)
      .in('id', batch)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (branchScope !== null) {
      query = query.in('branch', branchScope.length ? branchScope : ['__NO_BRANCH_SCOPE__']);
    }
    if (profile.role === 'super') {
      query = query.eq('approver_id', profile.id);
    }
    return query;
  });

  if (branchScope === null) return rows;
  return rows.filter((order) => branchScope.some((branch) => normalizeBranchKey(branch) === normalizeBranchKey(order.branch)));
}

export async function getPendingIssueOrders(): Promise<PendingIssueOrder[]> {
  const branchScope = await getCurrentBranchScopeValues();

  const orders = await fetchAll<OrderRow>((from, to) => {
    let query = supabase
      .from('portal_orders')
      .select('id,order_no,final_order_no,branch,order_type,order_for,customer_name,contact_no,machine_no,call_id,status,received_date,issued_at')
      .ilike('order_for', 'customer')
      .is('issued_at', null)
      .range(from, to);

    if (branchScope !== null) {
      query = query.in('branch', branchScope.length ? branchScope : ['__NO_BRANCH_SCOPE__']);
    }
    return query;
  });

  const notIssuedOrders = orders.filter((order) => !isIssuedHeader(order));
  const visibleOrders = branchScope === null
    ? notIssuedOrders
    : notIssuedOrders.filter((order) => branchScope.some((branch) => normalizeBranchKey(branch) === normalizeBranchKey(order.branch)));

  const orderIds = visibleOrders.map((order) => order.id);
  if (!orderIds.length) return [];

  const items = await fetchByIdBatches<ItemRow>(orderIds, (ids, from, to) => supabase
    .from('portal_order_items')
    .select('id,order_id,part_no,description,qty,edited_qty,value,edited_value,billed_qty,row_status')
    .in('order_id', ids)
    .range(from, to));

  const chunksByItem = await getBillingChunksByItem(items.map((item) => item.id));
  const hydrated = withBillingChunks(items, chunksByItem);
  const itemsByOrder = new Map<string, ItemRow[]>();
  for (const item of hydrated) {
    itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item]);
  }

  return visibleOrders.flatMap((order) => {
    const orderItems = itemsByOrder.get(order.id) ?? [];
    if (!orderItems.length) return [];

    const resolvedStatus = normalizeWorkflowStatus(getOrderStatusLabel(orderItems));
    if (resolvedStatus === 'ISSUED' || resolvedStatus !== 'RECEIVED') return [];

    const latestReceipt = orderItems
      .flatMap((item) => item.billing_chunks ?? [])
      .map((chunk) => chunk.received_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

    const receivedDate = order.received_date || latestReceipt;
    return [{
      id: order.id,
      order_no: order.order_no,
      final_order_no: order.final_order_no,
      branch: order.branch,
      order_type: order.order_type,
      customer_name: order.customer_name,
      contact_no: order.contact_no,
      machine_no: order.machine_no,
      call_id: order.call_id,
      received_date: receivedDate,
      total_qty: orderItems.reduce((sum, item) => sum + getEffectiveQty(item), 0),
      total_value: orderItems.reduce((sum, item) => sum + getEffectiveValue(item), 0),
      age_days: ageDays(receivedDate),
    }];
  }).sort((a, b) => b.age_days - a.age_days);
}

export async function getPendingIssueParts(orderId: string): Promise<PendingIssuePart[]> {
  const items = await fetchAll<ItemRow>((from, to) => supabase
    .from('portal_order_items')
    .select('id,order_id,part_no,description,qty,edited_qty,value,edited_value,billed_qty,row_status')
    .eq('order_id', orderId)
    .range(from, to));

  const chunksByItem = await getBillingChunksByItem(items.map((item) => item.id));
  return withBillingChunks(items, chunksByItem).map((item) => ({
    id: item.id,
    order_id: item.order_id,
    part_no: String(item.part_no ?? ''),
    description: item.description ?? null,
    effective_qty: getEffectiveQty(item),
    billed_qty: getBilledQty(item),
    received_qty: getReceivedQty(item),
    item_status: getResolvedRowStatus(item),
    effective_value: getEffectiveValue(item),
  }));
}

export async function markOrderIssued(orderId: string, documentType: string, documentNo: string) {
  const clean = documentNo.trim().toUpperCase();
  if (!clean) throw new Error('Issued document number is required.');
  const { data, error } = await supabase.rpc('mark_portal_order_issued', {
    p_order_id: orderId,
    p_document_type: documentType,
    p_document_no: clean,
  });
  if (error) throw error;
  return data;
}

export async function getDelayedVorOrders(): Promise<DelayedVorOrder[]> {
  const items = await fetchAll<ItemRow>((from, to) => supabase
    .from('portal_order_items')
    .select('id,order_id,qty,edited_qty,billed_qty,row_status,portal_orders!inner(order_type)')
    .eq('portal_orders.order_type', 'VOR')
    .range(from, to));

  const chunksByItem = await getBillingChunksByItem(items.map((item) => item.id));
  const eligibleOrderIds = new Set<string>();

  for (const item of withBillingChunks(items, chunksByItem)) {
    if (['PROCESSED', 'PARTIALLY DISPATCHED'].includes(getResolvedRowStatus(item))) {
      eligibleOrderIds.add(item.order_id);
    }
  }

  const orders = await getVisibleOrdersByIds([...eligibleOrderIds]);
  return orders
    .filter((order) => String(order.order_type ?? '').trim().toUpperCase() === 'VOR')
    .map((order) => ({ ...order, age_days: ageDays(order.processed_date) }))
    .sort((a, b) => b.age_days - a.age_days);
}

export async function getApprovedAdminOrders(): Promise<OrderSummary[]> {
  const profile = await getCurrentPortalProfile();
  if (!profile?.is_active || !['admin', 'developer'].includes(profile.role ?? '')) return [];
  const { data, error } = await supabase
    .from('portal_orders')
    .select(ORDER_COLUMNS)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as OrderSummary[];
}

async function adminAction(body: Record<string, string>) {
  const { data, error } = await supabase.functions.invoke('admin-order-action', { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export async function processApprovedOrder(order: Pick<OrderSummary, 'id' | 'order_no'>, finalOrderNo: string, notes = '') {
  const ref = finalOrderNo.trim().toUpperCase();
  if (!ref) throw new Error('Final order number is required.');
  if (ref === order.order_no.toUpperCase()) throw new Error('Final order number cannot be same as temporary order number.');
  return adminAction({ action: 'process', orderId: order.id, processingReference: ref, processedNotes: notes.trim() });
}

export async function rejectApprovedOrder(orderId: string, reason: string) {
  return adminAction({ action: 'reject', orderId, reason: reason.trim() });
}
