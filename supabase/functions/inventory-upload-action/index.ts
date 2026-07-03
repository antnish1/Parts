import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const num = (value: unknown) => Number(value ?? 0);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: 'Unauthorized' }, 401);
  const { data: profile } = await adminClient.from('test_profiles').select('role,is_active').eq('auth_user_id', userData.user.id).maybeSingle();
  if (!profile?.is_active || !['admin', 'developer'].includes(profile.role)) return json({ error: 'Only active admin or developer can upload inventory' }, 403);

  const body = await req.json().catch(() => ({}));
  const reportDate = String(body.reportDate ?? '');
  const filename = String(body.filename ?? 'inventory-upload.xlsx');
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const totalRows = Number(body.totalRows ?? rows.length);
  const failedRows = Number(body.failedRows ?? 0);
  if (!reportDate) return json({ error: 'Report date is required' }, 400);
  if (rows.length === 0) return json({ error: 'No valid inventory rows found' }, 400);

  try {
    const uploadBatchId = crypto.randomUUID();
    const stagedRows = rows.map((row) => ({ ...row, upload_batch_id: uploadBatchId, report_date: reportDate, source_filename: filename }));
    const { error: stageError } = await adminClient.from('test_inventory_staging').insert(stagedRows);
    if (stageError) throw stageError;

    const keys = rows.map((row) => `${row.branch_code}::${row.item_code}`);
    const branchCodes = [...new Set(rows.map((row) => row.branch_code).filter(Boolean))];
    const itemCodes = [...new Set(rows.map((row) => row.item_code).filter(Boolean))];
    const { data: existingRows, error: existingError } = await adminClient.from('test_inventory_current').select('branch_code,item_code,qty,inv_value').in('branch_code', branchCodes).in('item_code', itemCodes);
    if (existingError) throw existingError;
    const existing = new Map((existingRows ?? []).map((row) => [`${row.branch_code}::${row.item_code}`, row]));

    const changes = rows.flatMap((row) => {
      const key = `${row.branch_code}::${row.item_code}`;
      if (!keys.includes(key)) return [];
      const old = existing.get(key);
      const oldQty = num(old?.qty);
      const oldValue = num(old?.inv_value);
      const newQty = num(row.qty);
      const newValue = num(row.inv_value);
      const changed = !old || oldQty !== newQty || oldValue !== newValue;
      if (!changed) return [];
      return [{ report_date: reportDate, branch_code: row.branch_code, item_code: row.item_code, old_qty: old ? oldQty : null, new_qty: newQty, old_value: old ? oldValue : null, new_value: newValue, change_type: old ? 'updated' : 'new', source_filename: filename }];
    });
    if (changes.length > 0) {
      const { error: changeError } = await adminClient.from('test_inventory_changes').insert(changes);
      if (changeError) throw changeError;
    }

    const { error: upsertError } = await adminClient.from('test_inventory_current').upsert(rows, { onConflict: 'branch_code,item_code' });
    if (upsertError) throw upsertError;
    const { error: uploadError } = await adminClient.from('test_inventory_uploads').insert({ report_date: reportDate, filename, total_rows: totalRows, valid_rows: rows.length, failed_rows: failedRows, status: 'completed' });
    if (uploadError) throw uploadError;

    return json({ ok: true, totalRows, validRows: rows.length, failedRows, changedRows: changes.length, stagedRows: stagedRows.length, batchId: uploadBatchId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Inventory upload failed' }, 400);
  }
});
