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
    .select('order_id, row_status, dispatch_status');

  if (error) throw error;

  const orderIds = new Set<string>();
  for (const row of data ?? []) {
    const rowStatus = normalizeStatus(row.row_status);
    const dispatchStatus = normalizeStatus(row.dispatch_status);
    if (delayedRowStatuses.has(rowStatus) || delayedRowStatuses.has(dispatchStatus)) {
      orderIds.add(String(row.order_id));
    }
  }

  return [...orderIds];
}
