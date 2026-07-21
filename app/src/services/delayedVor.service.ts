import { getResolvedRowStatus, type LegacyLikeOrderItem } from '../lib/orderLogic';
import { supabase } from '../lib/supabase';

const delayedResolvedStatuses = new Set([
  'PROCESSED',
  'PARTIALLY DISPATCHED',
]);

const PAGE_SIZE = 1000;
const BILLING_BATCH_SIZE = 200;

type DelayedVorItem = LegacyLikeOrderItem & {
  id: string;
  order_id: string;
  billing_chunks: Array<{
    billed_qty?: number | string | null;
    received_qty?: number | string | null;
    received_at?: string | null;
  }>;
};

async function getVorItems() {
  const rows: Array<Omit<DelayedVorItem, 'billing_chunks'>> = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('portal_order_items')
      .select('id, order_id, qty, edited_qty, billed_qty, row_status, portal_orders!inner(order_type)')
      .eq('portal_orders.order_type', 'VOR')
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as unknown as Array<Omit<DelayedVorItem, 'billing_chunks'>>;
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

async function getBillingChunksByItem(itemIds: string[]) {
  const result = new Map<string, DelayedVorItem['billing_chunks']>();

  for (let index = 0; index < itemIds.length; index += BILLING_BATCH_SIZE) {
    const batch = itemIds.slice(index, index + BILLING_BATCH_SIZE);
    const { data, error } = await supabase
      .from('portal_order_item_billings')
      .select('item_id, billed_qty, received_qty, received_at')
      .in('item_id', batch);

    if (error) throw error;

    for (const chunk of data ?? []) {
      const itemId = String(chunk.item_id);
      const chunks = result.get(itemId) ?? [];
      chunks.push({
        billed_qty: chunk.billed_qty,
        received_qty: chunk.received_qty,
        received_at: chunk.received_at,
      });
      result.set(itemId, chunks);
    }
  }

  return result;
}

export async function getDelayedVorEligibleOrderIds() {
  const items = await getVorItems();
  const billingChunks = await getBillingChunksByItem(items.map((item) => item.id));
  const orderIds = new Set<string>();

  for (const item of items) {
    const resolvedStatus = getResolvedRowStatus({
      ...item,
      billing_chunks: billingChunks.get(item.id) ?? [],
    });

    if (delayedResolvedStatuses.has(resolvedStatus)) {
      orderIds.add(String(item.order_id));
    }
  }

  return [...orderIds];
}
