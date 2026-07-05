import { supabase } from '../lib/supabase';
import { parseInventoryExcel, type ParsedInventoryUploadRow } from './inventoryExcelParser';

type InventoryUploadResult = {
  totalRows: number;
  validRows: number;
  failedRows: number;
  changedRows: number;
  stagedRows: number;
  batchId: string;
  mode?: 'edge' | 'direct';
};

function createBatchId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function currentRow(row: ParsedInventoryUploadRow, reportDate: string) {
  return {
    report_date: reportDate,
    branch_code: row.branch_code,
    item_code: row.item_code,
    item_name: row.item_name,
    item_group: row.item_group,
    uom: row.uom,
    dnp: row.dnp,
    qty: row.closing_balance ?? row.qty,
    inv_value: row.closing_value ?? row.inv_value,
    updated_at: new Date().toISOString(),
  };
}

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

async function uploadInventoryDirect(rows: ParsedInventoryUploadRow[], reportDate: string, filename: string, totalRows: number, failedRows: number): Promise<InventoryUploadResult> {
  const batchId = createBatchId();
  const stagedRows = rows.map((row) => ({
    upload_batch_id: batchId,
    report_date: reportDate,
    branch_code: row.branch_code,
    branch_name: row.branch_name,
    item_code: row.item_code,
    item_name: row.item_name,
    item_group: row.item_group,
    uom: row.uom,
    dnp: row.dnp,
    opening_balance: row.opening_balance,
    opening_value: row.opening_value,
    received_qty: row.received_qty,
    issued_qty: row.issued_qty,
    closing_balance: row.closing_balance,
    closing_value: row.closing_value,
    source_filename: filename,
  }));
  const currentRows = rows.map((row) => currentRow(row, reportDate));

  const { error: stageError } = await supabase.from('test_inventory_staging').insert(stagedRows);
  if (stageError) throw new Error(stageError.message);

  const { error: upsertError } = await supabase.from('test_inventory_current').upsert(currentRows, { onConflict: 'branch_code,item_code' });
  if (upsertError) throw new Error(upsertError.message);

  const { error: uploadError } = await supabase.from('test_inventory_uploads').insert({ report_date: reportDate, filename, total_rows: totalRows, valid_rows: currentRows.length, failed_rows: failedRows, status: 'completed' });
  if (uploadError) throw new Error(uploadError.message);

  return { totalRows, validRows: currentRows.length, failedRows, changedRows: 0, stagedRows: stagedRows.length, batchId, mode: 'direct' };
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

  try {
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
  } catch (edgeError) {
    console.warn('Inventory edge upload failed. Falling back to direct Supabase upload.', edgeError);
    return uploadInventoryDirect(parsed.rows, reportDate, file.name, parsed.totalRows, parsed.failedRows);
  }
}
