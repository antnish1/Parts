import { supabase } from '../lib/supabase';

const delayedRowStatuses = new Set([
  'processed',
  'partial_dispatched',
  'partially_dispatched',
]);

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export async function getDelayedVorEligibleOrderIds() {
  const { data, error } = await supabase
    .from('portal_order_items')
    .select('order_id, row_status');

  if (error) throw error;

  const orderIds = new Set<string>();
  for (const row of data ?? []) {
    if (delayedRowStatuses.has(normalizeStatus(row.row_status))) {
      orderIds.add(String(row.order_id));
    }
  }

  return [...orderIds];
}
