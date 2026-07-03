import { supabase } from '../lib/supabase';
import { getOrderStatusLabel } from '../lib/orderLogic';
import type { TestOrder } from './testData.service';

type ItemStatusRow = {
  order_id: string;
  row_status: string | null;
  status: string | null;
  approval_status: string | null;
  qty: number | null;
  edited_qty: number | null;
  billed_qty: number | null;
};

const CHUNK_SIZE = 1000;

function statusKey(label: string) {
  return label.toLowerCase().replace(/ /g, '_');
}

export async function getOrderStatusMap(orders: TestOrder[]) {
  const ids = orders.map((order) => order.id);
  if (ids.length === 0) return {} as Record<string, string>;

  const itemRows: ItemStatusRow[] = [];
  for (let index = 0; index < ids.length; index += CHUNK_SIZE) {
    const chunk = ids.slice(index, index + CHUNK_SIZE);
    const { data, error } = await supabase
      .from('test_order_items')
      .select('order_id, row_status, status, approval_status, qty, edited_qty, billed_qty')
      .in('order_id', chunk);
    if (error) throw error;
    itemRows.push(...((data ?? []) as ItemStatusRow[]));
  }

  const byOrder = itemRows.reduce<Record<string, ItemStatusRow[]>>((acc, row) => {
    acc[row.order_id] = acc[row.order_id] ?? [];
    acc[row.order_id].push(row);
    return acc;
  }, {});

  return orders.reduce<Record<string, string>>((acc, order) => {
    const items = byOrder[order.id] ?? [];
    if (items.length) acc[order.id] = statusKey(getOrderStatusLabel({ ...order, items }));
    return acc;
  }, {});
}
