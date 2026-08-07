import { supabase } from '../lib/supabase';
import { getBilledQty, getEffectiveQty, getEffectiveValue, getOrderStatusLabel, getReceivedQty, getResolvedRowStatus, type LegacyLikeOrderItem } from '../lib/orderLogic';
import { getCurrentBranchScopeValues, normalizeBranchKey } from './branchScope.service';

export type PendingIssueOrder = {
  id: string;
  order_no: string;
  final_order_no: string | null;
  branch: string;
  order_type: string;
  customer_name: string | null;
  contact_no: string | null;
  machine_no: string | null;
  call_id: string | null;
  received_date: string | null;
  total_qty: number;
  total_value: number;
  age_days: number;
};

export type PendingIssuePartExportRow = {
  order_id: string;
  part_no: string;
  description: string | null;
  original_qty: number;
  edited_qty: number | null;
  effective_qty: number;
  item_value: number;
  edited_value: number | null;
  effective_value: number;
  billed_qty: number;
  received_qty: number;
  item_status: string;
};

type OrderRow = Omit<PendingIssueOrder, 'total_qty' | 'total_value' | 'age_days'> & { order_for: string | null; status: string | null; issued_at: string | null };
type ItemRow = LegacyLikeOrderItem & { id: string; order_id: string; description?: string | null };
type BillingRow = { item_id: string; billed_qty: number | string | null; received_qty: number | string | null; received_at: string | null };
const PAGE_SIZE = 1000;
const ID_BATCH_SIZE = 150;

async function fetchAll<T>(factory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
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

async function fetchByIdBatches<T>(ids: string[], factory: (ids: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let index = 0; index < ids.length; index += ID_BATCH_SIZE) {
    const batch = ids.slice(index, index + ID_BATCH_SIZE);
    rows.push(...await fetchAll<T>((from, to) => factory(batch, from, to)));
  }
  return rows;
}

function ageInDays(value: string | null) {
  if (!value) return 0;
  const received = new Date(value); const today = new Date();
  received.setHours(0, 0, 0, 0); today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - received.getTime()) / 86400000));
}

export async function getPendingIssueOrders(): Promise<PendingIssueOrder[]> {
  const branchScope = await getCurrentBranchScopeValues();
  const orders = await fetchAll<OrderRow>((from, to) => {
    let query = supabase.from('portal_orders')
      .select('id, order_no, final_order_no, branch, order_type, order_for, customer_name, contact_no, machine_no, call_id, status, received_date, issued_at')
      .ilike('order_for', 'customer').is('issued_at', null).range(from, to);
    if (branchScope?.length) query = query.in('branch', branchScope);
    return query;
  });
  const visibleOrders = branchScope === null ? orders : orders.filter((order) => branchScope.some((branch) => normalizeBranchKey(branch) === normalizeBranchKey(order.branch)));
  const orderIds = visibleOrders.map((order) => order.id);
  if (!orderIds.length) return [];

  const items = await fetchByIdBatches<ItemRow>(orderIds, (ids, from, to) => supabase.from('portal_order_items')
    .select('id, order_id, qty, edited_qty, value, edited_value, billed_qty, row_status')
    .in('order_id', ids).range(from, to));
  const itemIds = items.map((item) => item.id);
  const billings = itemIds.length ? await fetchByIdBatches<BillingRow>(itemIds, (ids, from, to) => supabase.from('portal_order_item_billings')
    .select('item_id, billed_qty, received_qty, received_at').in('item_id', ids).range(from, to)) : [];

  const chunksByItem = new Map<string, BillingRow[]>();
  for (const chunk of billings) chunksByItem.set(chunk.item_id, [...(chunksByItem.get(chunk.item_id) ?? []), chunk]);
  const itemsByOrder = new Map<string, ItemRow[]>();
  for (const item of items) {
    const withChunks = { ...item, billing_chunks: chunksByItem.get(item.id) ?? [] };
    itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), withChunks]);
  }

  return visibleOrders.flatMap((order) => {
    const orderItems = itemsByOrder.get(order.id) ?? [];
    if (!orderItems.length || getOrderStatusLabel(orderItems) !== 'RECEIVED') return [];
    const itemIdSet = new Set(orderItems.map((item) => item.id));
    const latestReceipt = billings.filter((chunk) => itemIdSet.has(chunk.item_id) && chunk.received_at).map((chunk) => chunk.received_at as string).sort().at(-1) ?? null;
    const receivedDate = order.received_date || latestReceipt;
    return [{
      id: order.id, order_no: order.order_no, final_order_no: order.final_order_no, branch: order.branch,
      order_type: order.order_type, customer_name: order.customer_name, contact_no: order.contact_no,
      machine_no: order.machine_no, call_id: order.call_id, received_date: receivedDate,
      total_qty: orderItems.reduce((sum, item) => sum + getEffectiveQty(item), 0),
      total_value: orderItems.reduce((sum, item) => sum + getEffectiveValue(item), 0), age_days: ageInDays(receivedDate),
    }];
  }).sort((a, b) => b.age_days - a.age_days);
}

export async function getPendingIssueOrderParts(orderIds: string[]): Promise<PendingIssuePartExportRow[]> {
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (!ids.length) return [];

  const items = await fetchByIdBatches<ItemRow>(ids, (batch, from, to) => supabase.from('portal_order_items')
    .select('id, order_id, part_no, description, qty, edited_qty, value, edited_value, billed_qty, row_status')
    .in('order_id', batch).range(from, to));
  const itemIds = items.map((item) => item.id);
  const billings = itemIds.length ? await fetchByIdBatches<BillingRow>(itemIds, (batch, from, to) => supabase.from('portal_order_item_billings')
    .select('item_id, billed_qty, received_qty, received_at').in('item_id', batch).range(from, to)) : [];

  const chunksByItem = new Map<string, BillingRow[]>();
  for (const chunk of billings) chunksByItem.set(chunk.item_id, [...(chunksByItem.get(chunk.item_id) ?? []), chunk]);

  return items.map((item) => {
    const resolved = { ...item, billing_chunks: chunksByItem.get(item.id) ?? [] };
    const editedQty = item.edited_qty === null || item.edited_qty === undefined || item.edited_qty === '' ? null : Number(item.edited_qty);
    const editedValue = item.edited_value === null || item.edited_value === undefined || item.edited_value === '' ? null : Number(item.edited_value);
    return {
      order_id: item.order_id,
      part_no: String(item.part_no ?? item.PartNo ?? '').trim(),
      description: item.description ?? null,
      original_qty: Number(item.qty ?? item.Qty ?? 0),
      edited_qty: editedQty,
      effective_qty: getEffectiveQty(resolved),
      item_value: Number(item.value ?? item.Value ?? 0),
      edited_value: editedValue,
      effective_value: getEffectiveValue(resolved),
      billed_qty: getBilledQty(resolved),
      received_qty: getReceivedQty(resolved),
      item_status: getResolvedRowStatus(resolved),
    };
  });
}
