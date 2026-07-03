import { supabase } from '../lib/supabase';
import { parseInventoryExcel } from './inventoryExcelParser';

export async function uploadInventoryExcel(file: File, reportDate: string) {
  const parsed = await parseInventoryExcel(file, reportDate);
  if (parsed.rows.length === 0) throw new Error('No valid inventory rows found.');

  const { data, error } = await supabase.functions.invoke('inventory-upload-action', {
    body: {
      reportDate,
      filename: file.name,
      rows: parsed.rows,
      totalRows: parsed.totalRows,
      failedRows: parsed.failedRows,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));

  return {
    totalRows: data.totalRows ?? parsed.totalRows,
    validRows: data.validRows ?? parsed.rows.length,
    failedRows: data.failedRows ?? parsed.failedRows,
    changedRows: data.changedRows ?? 0,
    stagedRows: data.stagedRows ?? 0,
    batchId: data.batchId ?? '',
  };
}
