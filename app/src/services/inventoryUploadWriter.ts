import { supabase } from '../lib/supabase';
import { parseInventoryExcel } from './inventoryExcelParser';

type InventoryUploadResult = {
  totalRows: number;
  validRows: number;
  failedRows: number;
  changedRows: number;
  stagedRows: number;
  batchId: string;
  mode?: 'rpc';
};

export async function uploadInventoryExcel(file: File, reportDate: string): Promise<InventoryUploadResult> {
  const parsed = await parseInventoryExcel(file, reportDate);
  if (parsed.rows.length === 0) throw new Error('No valid inventory rows found. Required columns: Branch, Br. Code, Itemcode, ItemName, Item Group, UOM, DNP, Opening Balance, Opening Inv Val, Received, Issued, Closing Balance, Closing Inv Val.');

  const { data, error } = await supabase.rpc('portal_upload_inventory', {
    p_report_date: reportDate,
    p_filename: file.name,
    p_rows: parsed.rows,
    p_total_rows: parsed.totalRows,
    p_failed_rows: parsed.failedRows,
  });

  if (error) throw new Error(error.message || 'Inventory upload failed.');
  if (data?.error) throw new Error(String(data.error));

  return {
    totalRows: data?.totalRows ?? parsed.totalRows,
    validRows: data?.validRows ?? parsed.rows.length,
    failedRows: data?.failedRows ?? parsed.failedRows,
    changedRows: data?.changedRows ?? 0,
    stagedRows: data?.stagedRows ?? 0,
    batchId: data?.batchId ?? '',
    mode: 'rpc',
  };
}
