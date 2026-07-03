import { supabase } from '../lib/supabase';
import { parseInventoryExcel } from './inventoryExcelParser';

export async function uploadInventoryExcel(file: File, reportDate: string) {
  const parsed = await parseInventoryExcel(file, reportDate);
  if (parsed.rows.length === 0) throw new Error('No valid inventory rows found.');

  const { error } = await supabase
    .from('test_inventory_current')
    .upsert(parsed.rows, { onConflict: 'branch_code,item_code' });
  if (error) throw error;

  await supabase.from('test_inventory_uploads').insert({
    report_date: reportDate,
    filename: file.name,
    total_rows: parsed.totalRows,
    valid_rows: parsed.rows.length,
    failed_rows: parsed.failedRows,
    status: 'completed',
  });

  return {
    totalRows: parsed.totalRows,
    validRows: parsed.rows.length,
    failedRows: parsed.failedRows,
  };
}
