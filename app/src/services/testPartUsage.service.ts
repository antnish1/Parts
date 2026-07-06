import { supabase } from '../lib/supabase';
import { getEffectiveQty, getReceivedQty, getResolvedRowStatus, normalizePartNo } from '../lib/orderLogic';
import { getBranchCalculationScope } from './branchCalculation.service';

type TestUsageRow = {
  id: string;
  part_no: string | null;
  qty: number | null;
  edited_qty: number | null;
  billed_qty: number | null;
  row_status: string | null;
  billing_chunks?: Array<{ billed_qty: number | null; received_qty: number | null }>;
  portal_orders?: { branch: string | null; status: string | null; approval_status: string | null } | null;
};

type BillingChunkRow = { item_id: string; billed_qty: number | null; received_qty: number | null };

const OPEN_TRANSIT_STATUSES = new Set(['APPROVED', 'PROCESSED', 'PARTIALLY DISPATCHED', 'DISPATCHED', 'PARTIALLY RECEIVED']);

function isEligibleForTransit(row: TestUsageRow) {
  const status = getResolvedRowStatus(row);
  if (!OPEN_TRANSIT_STATUSES.has(status)) return false;
  const headerStatus = String(row.portal_orders?.status ?? '').toLowerCase();
  const approvalStatus = String(row.portal_orders?.approval_status ?? '').toLowerCase();
  if (headerStatus.includes('pending') || approvalStatus.includes('pending')) return false;
  if (headerStatus.includes('reject') || approvalStatus.includes('reject')) return false;
  if (headerStatus === 'received' || headerStatus === 'issued' || approvalStatus === 'received' || approvalStatus === 'issued') return false;
  return true;
}

async function attachBillingChunks(rows: TestUsageRow[]) {
  const itemIds = rows.map((row) => row.id).filter(Boolean);
  if (!itemIds.length) return rows;

  const { data, error } = await supabase
    .from('portal_order_item_billings')
    .select('item_id, billed_qty, received_qty')
    .in('item_id', itemIds);

  if (error) {
    console.warn('In transit billing chunks unavailable.', error.message);
    return rows;
  }

  const map = new Map<string, BillingChunkRow[]>();
  for (const chunk of (data ?? []) as BillingChunkRow[]) {
    const list = map.get(chunk.item_id) ?? [];
    list.push(chunk);
    map.set(chunk.item_id, list);
  }

  return rows.map((row) => ({ ...row, billing_chunks: map.get(row.id) ?? [] }));
}

export async function getTestLast30QtyByBranchPart(branch: string, partNo: string, _days = 30) {
  const normalizedPartNo = normalizePartNo(partNo);
  const branchScope = await getBranchCalculationScope(branch);
  if (!branchScope.length || !normalizedPartNo) return 0;

  const { data, error } = await supabase
    .from('portal_order_items')
    .select('id, part_no, qty, edited_qty, billed_qty, row_status, portal_orders!inner(branch, status, approval_status)')
    .eq('part_no', normalizedPartNo)
    .in('portal_orders.branch', branchScope)
    .neq('portal_orders.status', 'received')
    .neq('portal_orders.status', 'issued')
    .neq('portal_orders.status', 'rejected')
    .neq('portal_orders.approval_status', 'rejected');

  if (error) throw error;

  const rows = await attachBillingChunks((data ?? []) as unknown as TestUsageRow[]);
  return rows.reduce((sum, row) => {
    if (!isEligibleForTransit(row)) return sum;
    return sum + Math.max(0, getEffectiveQty(row) - getReceivedQty(row));
  }, 0);
}
