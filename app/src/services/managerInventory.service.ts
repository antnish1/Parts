import { supabase } from '../lib/supabase';
import { getBranchCalculationScope } from './branchCalculation.service';

export type ManagerInventoryRow = {
  id: string;
  branch_key: string | null;
  branch_code: string;
  branch_name: string | null;
  item_code: string;
  item_name: string | null;
  item_group: string | null;
  uom: string | null;
  dnp: number | null;
  qty: number | null;
  inv_value: number | null;
  report_date: string | null;
};

export type ManagerInventoryTxnRow = {
  id: string;
  report_date: string | null;
  branch_key: string | null;
  branch_code: string;
  branch_name: string | null;
  item_code: string;
  item_name: string | null;
  item_group: string | null;
  uom: string | null;
  dnp: number | null;
  received: number | null;
  issued: number | null;
  closing_balance: number | null;
  closing_value: number | null;
};

type PortalInventoryTxnRow = Omit<ManagerInventoryTxnRow, 'received' | 'issued'> & {
  received_qty: number | null;
  issued_qty: number | null;
};

function cleanPartSearch(search: string) {
  return search.trim().replace(/\s+/g, '').toUpperCase();
}

export async function getLatestInventoryReportDate() {
  const { data, error } = await supabase
    .from('portal_inventory_staging')
    .select('report_date')
    .order('report_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data?.report_date ?? null;
}

export async function getManagerInventoryLookup(search = '', branch = 'all', reportDate = '') {
  const term = cleanPartSearch(search);
  if (!term) return [] as ManagerInventoryRow[];

  const latestDate = reportDate || await getLatestInventoryReportDate();
  const branchScope = branch === 'all' ? [] : await getBranchCalculationScope(branch);
  let query = supabase
    .from('portal_inventory_staging')
    .select('id, report_date, branch_key, branch_code, branch_name, item_code, item_name, item_group, uom, dnp, closing_balance, closing_value')
    .order('branch_key', { ascending: true })
    .order('item_code', { ascending: true })
    .limit(300);

  if (latestDate) query = query.eq('report_date', latestDate);
  if (branch !== 'all') query = branchScope.length ? query.in('branch_key', branchScope) : query.eq('branch_key', branch);
  query = query.ilike('item_code', `%${term}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    branch_key: row.branch_key,
    branch_code: row.branch_code,
    branch_name: row.branch_name,
    item_code: row.item_code,
    item_name: row.item_name,
    item_group: row.item_group,
    uom: row.uom,
    dnp: row.dnp,
    qty: row.closing_balance,
    inv_value: row.closing_value,
    report_date: row.report_date,
  })) as ManagerInventoryRow[];
}

export async function getManagerInventoryTransactions(search = '', branch = 'all', reportDate = '') {
  const term = cleanPartSearch(search);
  if (!term) return [] as ManagerInventoryTxnRow[];

  const latestDate = reportDate || await getLatestInventoryReportDate();
  const branchScope = branch === 'all' ? [] : await getBranchCalculationScope(branch);
  let query = supabase
    .from('portal_inventory_staging')
    .select('id, report_date, branch_key, branch_code, branch_name, item_code, item_name, item_group, uom, dnp, received_qty, issued_qty, closing_balance, closing_value')
    .order('branch_key', { ascending: true })
    .order('item_code', { ascending: true })
    .limit(300);

  if (latestDate) query = query.eq('report_date', latestDate);
  if (branch !== 'all') query = branchScope.length ? query.in('branch_key', branchScope) : query.eq('branch_key', branch);
  query = query.ilike('item_code', `%${term}%`);
  query = query.or('received_qty.neq.0,issued_qty.neq.0');

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as PortalInventoryTxnRow[]).map((row) => ({
    ...row,
    received: row.received_qty,
    issued: row.issued_qty,
  }));
}
