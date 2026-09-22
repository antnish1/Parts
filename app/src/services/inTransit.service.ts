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


export type InTransitDetailRow = {
  order_id: string;
  order_no: string | null;
  branch: string | null;
  order_type: string | null;
  order_date: string | null;
  order_for: string | null;
  status: string | null;
  qty: number;
};

export async function getInTransitDetails(branch: string, partNo: string) {
  const normalizedPart = normalizePartNo(partNo);
  if (!branch.trim() || !normalizedPart) return [] as InTransitDetailRow[];

  const { data, error } = await supabase.rpc('portal_get_in_transit_details', {
    p_branch: branch,
    p_part_no: normalizedPart,
  });
  if (error) throw error;

  return ((data ?? []) as Array<Omit<InTransitDetailRow, 'qty'> & { qty: number | string | null }>).map((row) => {
    const qty = Number(row.qty ?? 0);
    return {
      ...row,
      qty: Number.isFinite(qty) ? Math.max(0, qty) : 0,
    };
  });
}
