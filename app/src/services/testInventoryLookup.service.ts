import { supabase } from '../lib/supabase';
import { normalizePartNo } from '../lib/orderLogic';
import { normalizeBranchKey } from './branchScope.service';

export type InventoryLookupMap = Record<string, number>;

type InventoryRow = { item_code: string; qty: number | null; branch_code: string | null; branch_name: string | null };

export async function getInventoryQtyByBranchParts(branchName: string, partNos: string[]): Promise<InventoryLookupMap> {
  const normalizedParts = [...new Set(partNos.map(normalizePartNo).filter(Boolean))];
  const branchKey = normalizeBranchKey(branchName);
  if (!branchKey || normalizedParts.length === 0) return {};

  const { data, error } = await supabase
    .from('portal_inventory_current')
    .select('item_code, qty, branch_code, branch_name')
    .in('item_code', normalizedParts);
  if (error) throw error;

  return ((data ?? []) as InventoryRow[])
    .filter((row) => normalizeBranchKey(row.branch_name) === branchKey || normalizeBranchKey(row.branch_code) === branchKey)
    .reduce<InventoryLookupMap>((acc, row) => {
      acc[normalizePartNo(row.item_code)] = Number(row.qty ?? 0);
      return acc;
    }, {});
}
