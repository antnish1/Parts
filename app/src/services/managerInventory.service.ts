import { supabase } from '../lib/supabase';

export type ManagerInventoryRow = {
  id: string;
  branch_code: string;
  item_code: string;
  item_name: string | null;
  item_group: string | null;
  uom: string | null;
  qty: number | null;
  dnp: number | null;
  inv_value: number | null;
};

export async function getManagerInventoryLookup(search = '', branch = 'all') {
  let query = supabase
    .from('test_inventory_current')
    .select('id, branch_code, item_code, item_name, item_group, uom, qty, dnp, inv_value')
    .order('branch_code', { ascending: true })
    .order('item_code', { ascending: true })
    .limit(50);

  if (branch !== 'all') query = query.eq('branch_code', branch);
  const term = search.trim();
  if (term) query = query.or(`item_code.ilike.%${term}%,item_name.ilike.%${term}%,item_group.ilike.%${term}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ManagerInventoryRow[];
}
