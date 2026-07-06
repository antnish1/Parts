import { supabase } from '../lib/supabase';
import { parseInventoryExcel } from './inventoryExcelParser';

type InventoryUploadResult = {
  totalRows: number;
  validRows: number;
  failedRows: number;
  changedRows: number;
  stagedRows: number;
  batchId: string;
  mode?: 'edge';
};

async function getFunctionErrorMessage(error: unknown) {
  const fallback = error instanceof Error ? error.message : 'Inventory upload failed.';
  const context = (error as { context?: Response })?.context;
  if (!context) return fallback;
  try {
    const body = await context.clone().json();
    if (body?.error) return String(body.error);
    if (body?.message) return String(body.message);
  } catch {
    try {
      const text = await context.clone().text();
      if (text) return text;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export async function uploadInventoryExcel(file: File, reportDate: string): Promise<InventoryUploadResult> {
  const parsed = await parseInventoryExcel(file, reportDate);
  if (parsed.rows.length === 0) throw new Error('No valid inventory rows found. Required columns: Branch, Br. Code, Itemcode, ItemName, Item Group, UOM, DNP, Opening Balance, Opening Inv Val, Received, Issued, Closing Balance, Closing Inv Val.');

  const requestBody = {
    reportDate,
    filename: file.name,
    rows: parsed.rows,
    totalRows: parsed.totalRows,
    failedRows: parsed.failedRows,
  };

  const { data, error } = await supabase.functions.invoke('inventory-upload-action', { body: requestBody });
  if (error) throw new Error(await getFunctionErrorMessage(error));
  if (data?.error) throw new Error(String(data.error));
  return {
    totalRows: data.totalRows ?? parsed.totalRows,
    validRows: data.validRows ?? parsed.rows.length,
    failedRows: data.failedRows ?? parsed.failedRows,
    changedRows: data.changedRows ?? 0,
    stagedRows: data.stagedRows ?? 0,
    batchId: data.batchId ?? '',
    mode: 'edge',
  };
}
