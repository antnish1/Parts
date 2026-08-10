import { supabase } from '../lib/supabase';
import { normalizePartNo } from '../lib/orderLogic';

type InTransitRow = {
  part_no: string | null;
  in_transit_qty: number | string | null;
};

export async function getInTransitQtyByBranchParts(branch: string, partNos: string[]) {
  const normalizedParts = [...new Set(partNos.map(normalizePartNo).filter(Boolean))];
  const result: Record<string, number> = {};
  if (!branch.trim() || normalizedParts.length === 0) return result;

  const { data, error } = await supabase.rpc('portal_get_in_transit_qty', {
    p_branch: branch,
    p_part_nos: normalizedParts,
  });
  if (error) throw error;

  for (const row of (data ?? []) as InTransitRow[]) {
    const part = normalizePartNo(row.part_no);
    if (!part) continue;
    const qty = Number(row.in_transit_qty ?? 0);
    result[part] = Number.isFinite(qty) ? Math.max(0, qty) : 0;
  }
  return result;
}

export async function getInTransitQtyByBranchPart(branch: string, partNo: string) {
  const normalizedPart = normalizePartNo(partNo);
  if (!normalizedPart) return 0;
  const map = await getInTransitQtyByBranchParts(branch, [normalizedPart]);
  return map[normalizedPart] ?? 0;
}
