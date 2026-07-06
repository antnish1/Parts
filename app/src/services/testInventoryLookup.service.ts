import { supabase } from '../lib/supabase';
import { normalizePartNo } from '../lib/orderLogic';
import { normalizeBranchKey } from './branchScope.service';
import { getBranchCalculationScope } from './branchCalculation.service';

export type InventoryLookupMap = Record<string, number>;

type InventoryRow = { item_code: string; qty: number | null; branch_key: string | null; branch_code: string | null; branch_name: string | null };

export async function getInventoryQtyByBranchParts(branchName: string, partNos: string[]): Promise<InventoryLookupMap> {
  const normalizedParts = [...new Set(partNos.map(normalizePartNo).filter(Boolean))];
  const branchScope = await getBranchCalculationScope(branchName);
  const normalizedBranchKey = normalizeBranchKey(branchName);
  if ((!branchScope.length && !normalizedBranchKey) || normalizedParts.length === 0) return {};

  const { data, error } = await supabase
    .from('portal_inventory_current')
    .select('item_code, qty, branch_key, branch_code, branch_name')
    .in('item_code', normalizedParts);
  if (error) throw error;

  const scopeSet = new Set(branchScope);
  return ((data ?? []) as InventoryRow[])
    .filter((row) => (row.branch_key ? scopeSet.has(row.branch_key) : false) || normalizeBranchKey(row.branch_name) === normalizedBranchKey || normalizeBranchKey(row.branch_code) === normalizedBranchKey)
    .reduce<InventoryLookupMap>((acc, row) => {
      const key = normalizePartNo(row.item_code);
      acc[key] = Number(acc[key] ?? 0) + Number(row.qty ?? 0);
      return acc;
    }, {});
}
