import { supabase } from '../lib/supabase';

export type TrackingMeta = {
  totalQty: number;
  totalValue: number;
  commentCount: number;
};

export type TrackingMetaMap = Record<string, TrackingMeta>;

const CHUNK_SIZE = 500;

export async function getTestTrackingMeta(orderIds: string[]): Promise<TrackingMetaMap> {
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (ids.length === 0) return {};

  const meta = ids.reduce<TrackingMetaMap>((acc, id) => {
    acc[id] = { totalQty: 0, totalValue: 0, commentCount: 0 };
    return acc;
  }, {});

  for (let start = 0; start < ids.length; start += CHUNK_SIZE) {
    const chunk = ids.slice(start, start + CHUNK_SIZE);

    const { data: items, error: itemError } = await supabase
      .from('portal_order_items')
      .select('order_id, qty, edited_qty, dnp, value, edited_value')
      .in('order_id', chunk);
    if (itemError) throw itemError;

    (items ?? []).forEach((item) => {
      const current = meta[item.order_id] ?? { totalQty: 0, totalValue: 0, commentCount: 0 };
      const qty = Number(item.edited_qty ?? item.qty ?? 0);
      const value = Number(item.edited_value ?? item.value ?? (Number(item.dnp ?? 0) * qty));
      current.totalQty += qty;
      current.totalValue += value;
      meta[item.order_id] = current;
    });

    const { data: comments, error: commentError } = await supabase
      .from('portal_order_comments')
      .select('order_id')
      .in('order_id', chunk)
      .eq('comment_type', 'user');
    if (commentError) throw commentError;

    (comments ?? []).forEach((comment) => {
      const current = meta[comment.order_id] ?? { totalQty: 0, totalValue: 0, commentCount: 0 };
      current.commentCount += 1;
      meta[comment.order_id] = current;
    });
  }

  return meta;
}
