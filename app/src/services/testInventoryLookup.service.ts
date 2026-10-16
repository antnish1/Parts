import { supabase } from '../lib/supabase';
import { normalizePartNo } from '../lib/orderLogic';
import { getBranchCalculationScope } from './branchCalculation.service';

// CURRENT_INVENTORY_SNAPSHOT_V2: intentionally exclude prior upload dates,
// especially the unkeyed 2026-06 legacy data that could double count stock.
export type InventoryLookupMap = Record<string, number>;
export type CurrentInventorySnapshot = {
  quantities: InventoryLookupMap;
  reportDate: string | null;
};

type StockRow = { item_code: string; qty: number | null };

/** Display the actual uploaded inventory date, never today's/order date. */
export function formatInventoryReportDate(value: string | null | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '—';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year.slice(-2)}`;
}

/**
 * Stock on the latest available uploaded report for the selected branch group.
 * portal_inventory_current is an upsert table, not a complete replacement:
 * older part rows may remain in it after a new monthly report was uploaded.
 * They MUST NOT be added to the latest snapshot, and should not be used as
 * a fallback when a part is absent in the current report.
 *
 * Branch selection uses canonical keys so the old unkeyed/shared-code legacy
 * rows cannot be accidentally added to Jabalpur's October inventory.
 */
export async function getCurrentInventoryByBranchParts(
  branchName: string,
  partNos: string[],
): Promise<CurrentInventorySnapshot> {
  const parts = [...new Set(partNos.map(normalizePartNo).filter(Boolean))];
  if (!parts.length || !branchName.trim()) return { quantities: {}, reportDate: null };

  const scope = [...new Set((await getBranchCalculationScope(branchName)).filter(Boolean))];
  if (!scope.length) return { quantities: {}, reportDate: null };

  // Date must come from all inventory rows in branch scope, NOT only from the
  // searched parts; otherwise an old part's last report appears "current".
  const { data: latest, error: dateError } = await supabase
    .from('portal_inventory_current')
    .select('report_date')
    .in('branch_key', scope)
    .order('report_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (dateError) throw dateError;
  const reportDate = latest?.report_date ?? null;
  if (!reportDate) return { quantities: {}, reportDate: null };

  const { data, error } = await supabase
    .from('portal_inventory_current')
    .select('item_code, qty')
    .in('branch_key', scope)
    .eq('report_date', reportDate)
    .in('item_code', parts);
  if (error) throw error;

  const quantities = ((data ?? []) as StockRow[]).reduce<InventoryLookupMap>((acc, row) => {
    const key = normalizePartNo(row.item_code);
    acc[key] = (acc[key] ?? 0) + Number(row.qty ?? 0);
    return acc;
  }, {});

  return { quantities, reportDate };
}

/** Backward-compatible quantity-only lookup for other existing consumers. */
export async function getInventoryQtyByBranchParts(branchName: string, partNos: string[]): Promise<InventoryLookupMap> {
  return (await getCurrentInventoryByBranchParts(branchName, partNos)).quantities;
}
