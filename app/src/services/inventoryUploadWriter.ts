import { supabase } from '../lib/supabase';
import { parseInventoryExcel } from './inventoryExcelParser';
import { logInventoryChanges } from './inventoryChangeLog.service';
import { stageInventoryRows } from './inventoryStaging.service';

export async function uploadInventoryExcel(file: File, reportDate: string) {
  const parsed = await parseInventoryExcel(file, reportDate);
  if (parsed.rows.length === 0) throw new Error('No valid inventory rows found.');

  const staging = await stageInventoryRows(parsed.rows, reportDate, file.name);
  const changedRows = await logInventoryChanges(parsed.rows, reportDate, file.name);

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
    changedRows,
    stagedRows: staging.stagedRows,
    batchId: staging.batchId,
  };
}
