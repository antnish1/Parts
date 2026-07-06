import { supabase } from '../lib/supabase';

type InventoryStageRow = {
  report_date: string;
  branch_code: string;
  branch_name?: string | null;
  item_code: string;
  item_name?: string | null;
  item_group?: string | null;
  uom?: string | null;
  dnp?: number | null;
  opening_balance?: number | null;
  opening_value?: number | null;
  received_qty?: number | null;
  issued_qty?: number | null;
  closing_balance?: number | null;
  closing_value?: number | null;
};

function createBatchId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function stageInventoryRows(rows: InventoryStageRow[], reportDate: string, filename: string) {
  if (rows.length === 0) return { batchId: '', stagedRows: 0 };
  const batchId = createBatchId();
  const stagedRows = rows.map((row) => ({ ...row, upload_batch_id: batchId, report_date: reportDate, source_filename: filename }));
  const { error } = await supabase.from('portal_inventory_staging').insert(stagedRows);
  if (error) throw error;
  return { batchId, stagedRows: stagedRows.length };
}
