import { supabase } from '../lib/supabase';

type InventoryUploadRow = {
  branch_code: string;
  item_code: string;
  closing_balance?: number | null;
  closing_value?: number | null;
};

type ExistingInventoryRow = {
  branch_code: string;
  item_code: string;
  qty: number | null;
  inv_value: number | null;
};

function rowKey(branchCode: string, itemCode: string) {
  return `${branchCode}::${itemCode}`;
}

export async function logInventoryChanges(rows: InventoryUploadRow[], reportDate: string, filename: string) {
  if (rows.length === 0) return 0;
  const branchCodes = [...new Set(rows.map((row) => row.branch_code).filter(Boolean))];
  const itemCodes = [...new Set(rows.map((row) => row.item_code).filter(Boolean))];
  if (branchCodes.length === 0 || itemCodes.length === 0) return 0;

  const { data, error } = await supabase
    .from('portal_inventory_current')
    .select('branch_code, item_code, qty, inv_value')
    .in('branch_code', branchCodes)
    .in('item_code', itemCodes);
  if (error) throw error;

  const existingMap = new Map((data as ExistingInventoryRow[] | null ?? []).map((row) => [rowKey(row.branch_code, row.item_code), row]));
  const changes = rows.flatMap((row) => {
    const existing = existingMap.get(rowKey(row.branch_code, row.item_code));
    const oldQty = Number(existing?.qty ?? 0);
    const newQty = Number(row.closing_balance ?? 0);
    const oldValue = Number(existing?.inv_value ?? 0);
    const newValue = Number(row.closing_value ?? 0);
    if (oldQty === newQty && oldValue === newValue) return [];
    return [{ report_date: reportDate, branch_code: row.branch_code, item_code: row.item_code, old_qty: oldQty, new_qty: newQty, old_value: oldValue, new_value: newValue, change_type: existing ? 'updated' : 'new', source_filename: filename }];
  });

  if (changes.length === 0) return 0;
  const { error: insertError } = await supabase.from('portal_inventory_changes').insert(changes);
  if (insertError) throw insertError;
  return changes.length;
}
