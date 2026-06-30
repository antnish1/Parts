import { supabase } from '../lib/supabase';

export type TestInventoryRow = {
  id: string;
  report_date: string;
  branch_code: string;
  item_code: string;
  item_name: string | null;
  item_group: string | null;
  uom: string | null;
  dnp: number | null;
  qty: number;
  inv_value: number | null;
  updated_at: string;
};

export async function getTestInventory(): Promise<TestInventoryRow[]> {
  const { data, error } = await supabase
    .from('test_inventory_current')
    .select('id, report_date, branch_code, item_code, item_name, item_group, uom, dnp, qty, inv_value, updated_at')
    .order('branch_code', { ascending: true })
    .limit(100);

  if (error) {
    console.error('Failed to load test inventory', error);
    return [];
  }

  return data ?? [];
}
