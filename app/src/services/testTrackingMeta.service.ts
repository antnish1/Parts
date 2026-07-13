import { supabase } from '../lib/supabase';
import { getOrderStatusLabel, type LegacyLikeOrderItem } from '../lib/orderLogic';

export type TrackingMeta = {
  totalQty: number;
  totalValue: number;
  commentCount: number;
  searchText: string;
  resolvedStatus: string;
};

export type TrackingMetaMap = Record<string, TrackingMeta>;

const CHUNK_SIZE = 500;

function createMeta(): TrackingMeta {
  return { totalQty: 0, totalValue: 0, commentCount: 0, searchText: '', resolvedStatus: '' };
}

function appendSearchText(current: TrackingMeta, value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) return;
  current.searchText = `${current.searchText} ${text}`.trim();
}

function toListStatus(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

type TrackingItem = LegacyLikeOrderItem & {
  id: string;
  order_id: string;
  part_no: string | null;
  description: string | null;
  dnp: number | null;
  value: number | null;
  edited_value: number | null;
  billing_chunks: Array<{
    billed_qty: number | null;
    received_qty: number | null;
    received_at: string | null;
  }>;
};

export async function getTestTrackingMeta(orderIds: string[]): Promise<TrackingMetaMap> {
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (ids.length === 0) return {};

  const meta = ids.reduce<TrackingMetaMap>((acc, id) => {
    acc[id] = createMeta();
    return acc;
  }, {});

  for (let start = 0; start < ids.length; start += CHUNK_SIZE) {
    const chunk = ids.slice(start, start + CHUNK_SIZE);

    const { data: itemRows, error: itemError } = await supabase
      .from('portal_order_items')
      .select('id, order_id, part_no, description, qty, edited_qty, dnp, value, edited_value, billed_qty, row_status, status, approval_status')
      .in('order_id', chunk);
    if (itemError) throw itemError;

    const items = (itemRows ?? []).map((item) => ({ ...item, billing_chunks: [] })) as TrackingItem[];
    const itemById = new Map(items.map((item) => [item.id, item]));

    const { data: billings, error: billingError } = await supabase
      .from('portal_order_item_billings')
      .select('item_id, billed_qty, received_qty, received_at')
      .in('order_id', chunk);
    if (billingError) throw billingError;

    (billings ?? []).forEach((billing) => {
      const item = itemById.get(billing.item_id);
      if (!item) return;
      item.billing_chunks.push({
        billed_qty: billing.billed_qty,
        received_qty: billing.received_qty,
        received_at: billing.received_at,
      });
    });

    const itemsByOrder = new Map<string, TrackingItem[]>();
    items.forEach((item) => {
      const current = meta[item.order_id] ?? createMeta();
      const qty = Number(item.edited_qty ?? item.qty ?? 0);
      const value = Number(item.edited_value ?? item.value ?? (Number(item.dnp ?? 0) * qty));
      current.totalQty += qty;
      current.totalValue += value;
      appendSearchText(current, item.part_no);
      appendSearchText(current, item.description);
      meta[item.order_id] = current;

      const grouped = itemsByOrder.get(item.order_id) ?? [];
      grouped.push(item);
      itemsByOrder.set(item.order_id, grouped);
    });

    itemsByOrder.forEach((orderItems, orderId) => {
      meta[orderId].resolvedStatus = toListStatus(getOrderStatusLabel(orderItems));
    });

    const { data: comments, error: commentError } = await supabase
      .from('portal_order_comments')
      .select('order_id')
      .in('order_id', chunk)
      .eq('comment_type', 'user');
    if (commentError) throw commentError;

    (comments ?? []).forEach((comment) => {
      const current = meta[comment.order_id] ?? createMeta();
      current.commentCount += 1;
      meta[comment.order_id] = current;
    });
  }

  return meta;
}
