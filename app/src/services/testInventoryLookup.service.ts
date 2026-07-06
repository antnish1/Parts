import { supabase } from '../lib/supabase';
import { normalizePartNo } from '../lib/orderLogic';

export type InventoryLookupMap = Record<string, number>;

export async function getInventoryQtyByBranchParts(branchName: string, partNos: string[]): Promise<InventoryLookupMap> {
  const normalizedParts = [...new Set(partNos.map(normalizePartNo).filter(Boolean))];
  if (!branchName || normalizedParts.length === 0) return {};

  const { data: branch, error: branchError } = await supabase
    .from('branch_mapping')
    .select('branch_code')
    .eq('branch_name', branchName)
    .eq('is_active', true)
    .maybeSingle();
  if (branchError) throw branchError;
  if (!branch?.branch_code) return {};

  const { data, error } = await supabase
    .from('portal_inventory_current')
    .select('item_code, qty')
    .eq('branch_code', branch.branch_code)
    .in('item_code', normalizedParts);
  if (error) throw error;

  return (data ?? []).reduce<InventoryLookupMap>((acc, row) => {
    acc[normalizePartNo(row.item_code)] = Number(row.qty ?? 0);
    return acc;
  }, {});
}
