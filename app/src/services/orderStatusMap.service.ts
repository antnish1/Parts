import { supabase } from '../lib/supabase';
import { getOrderStatusLabel, normalizeStatus } from '../lib/orderLogic';
import type { TestOrder } from './testData.service';

type ItemStatusRow = {
  id: string;
  order_id: string;
  row_status: string | null;
  qty: number | null;
  edited_qty: number | null;
  billed_qty: number | null;
  billing_chunks?: Array<{ billed_qty: number | null; received_qty: number | null }>;
};

type BillingChunkRow = {
  item_id: string;
  billed_qty: number | null;
  received_qty: number | null;
};

const CHUNK_SIZE = 1000;

function statusKey(label: string) {
  return label.toLowerCase().replace(/ /g, '_');
}

function headerApprovalKey(order: TestOrder) {
  const header = normalizeStatus(order.approval_status || order.status);
  if (header === 'PENDING MANAGER APPROVAL') return 'pending_manager_approval';
  return '';
}

async function getBillingChunksByItem(itemIds: string[]) {
  const map = new Map<string, BillingChunkRow[]>();
  if (!itemIds.length) return map;

  for (let index = 0; index < itemIds.length; index += CHUNK_SIZE) {
    const chunk = itemIds.slice(index, index + CHUNK_SIZE);
    const { data, error } = await supabase
      .from('portal_order_item_billings')
      .select('item_id, billed_qty, received_qty')
      .in('item_id', chunk);

    if (error) {
      console.warn('Billing chunks unavailable for order status map.', error.message);
      return map;
    }

    for (const row of (data ?? []) as BillingChunkRow[]) {
      const list = map.get(row.item_id) ?? [];
      list.push(row);
      map.set(row.item_id, list);
    }
  }

  return map;
}

export async function getOrderStatusMap(orders: TestOrder[]) {
  const ids = orders.map((order) => order.id);
  if (ids.length === 0) return {} as Record<string, string>;

  const itemRows: ItemStatusRow[] = [];

  for (let index = 0; index < ids.length; index += CHUNK_SIZE) {
    const chunk = ids.slice(index, index + CHUNK_SIZE);
    const { data, error } = await supabase
      .from('portal_order_items')
      .select('id, order_id, row_status, qty, edited_qty, billed_qty')
      .in('order_id', chunk);

    if (error) {
      console.warn('Item status rows unavailable, using order header status.', error.message);
      return {} as Record<string, string>;
    }

    itemRows.push(...((data ?? []) as ItemStatusRow[]));
  }

  const chunkMap = await getBillingChunksByItem(itemRows.map((row) => row.id));
  const rowsWithChunks = itemRows.map((row) => ({ ...row, billing_chunks: chunkMap.get(row.id) ?? [] }));

  const byOrder = rowsWithChunks.reduce<Record<string, ItemStatusRow[]>>((acc, row) => {
    acc[row.order_id] = acc[row.order_id] ?? [];
    acc[row.order_id].push(row);
    return acc;
  }, {});

  return orders.reduce<Record<string, string>>((acc, order) => {
    const headerKey = headerApprovalKey(order);
    if (headerKey) {
      acc[order.id] = headerKey;
      return acc;
    }

    const items = byOrder[order.id] ?? [];
    if (items.length) acc[order.id] = statusKey(getOrderStatusLabel({ ...order, items }));
    return acc;
  }, {});
}
