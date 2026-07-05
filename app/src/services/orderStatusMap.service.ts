import { supabase } from '../lib/supabase';
import { getOrderStatusLabel, normalizeStatus } from '../lib/orderLogic';
import type { TestOrder } from './testData.service';

type ItemStatusRow = {
  order_id: string;
  row_status: string | null;
  qty: number | null;
  edited_qty: number | null;
  billed_qty: number | null;
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

export async function getOrderStatusMap(orders: TestOrder[]) {
  const ids = orders.map((order) => order.id);
  if (ids.length === 0) return {} as Record<string, string>;

  const itemRows: ItemStatusRow[] = [];

  for (let index = 0; index < ids.length; index += CHUNK_SIZE) {
    const chunk = ids.slice(index, index + CHUNK_SIZE);

    const { data, error } = await supabase
      .from('test_order_items')
      .select('order_id, row_status, qty, edited_qty, billed_qty')
      .in('order_id', chunk);

    if (error) {
      console.warn('Item status rows unavailable, using order header status.', error.message);
      return {} as Record<string, string>;
    }

    itemRows.push(...((data ?? []) as ItemStatusRow[]));
  }

  const byOrder = itemRows.reduce<Record<string, ItemStatusRow[]>>((acc, row) => {
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

    if (items.length) {
      acc[order.id] = statusKey(getOrderStatusLabel({ ...order, items }));
    }

    return acc;
  }, {});
}
