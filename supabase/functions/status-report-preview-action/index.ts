import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const clean = (value: unknown) => String(value ?? '').trim();
const normPart = (value: unknown) => clean(value).replace(/\s+/g, '').toUpperCase();
const normNo = (value: unknown) => clean(value).toUpperCase();
const num = (value: unknown) => {
  const parsed = Number(String(value ?? 0).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const closedRowStatuses = new Set(['received', 'issued', 'rejected']);

type ItemRow = { id: string; order_id: string; part_no: string; qty: number | string | null; edited_qty: number | string | null; billed_qty: number | string | null; row_status: string | null };
type PreviewRow = {
  status: 'matched' | 'skipped' | 'failed';
  action: string;
  orderNo: string;
  partNo: string;
  reason: string;
  billedQty?: number;
  itemQty?: number;
  currentBilledQty?: number;
  currentRowStatus?: string | null;
  matchCount?: number;
  activeMatchCount?: number;
  warning?: string;
};

type Result = { total: number; updated: number; inserted: number; skipped: number; failed: number; errors: string[]; previewRows: PreviewRow[] };

function normalizeStatus(value: unknown) {
  const status = clean(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (!status) return '';
  if (status.includes('receiv')) return status.includes('partial') ? 'partially_received' : 'received';
  if (status.includes('reject')) return 'rejected';
  if (status.includes('issued')) return 'issued';
  if (status.includes('dispatch') || status.includes('despatch')) return status.includes('partial') ? 'partially_dispatched' : 'dispatched';
  if (status.includes('process')) return 'processed';
  if (status.includes('approved')) return 'approved';
  return status;
}

function effectiveQty(row: ItemRow) {
  const edited = row.edited_qty;
  if (edited !== null && edited !== undefined && edited !== '') return Math.max(0, num(edited));
  return Math.max(0, num(row.qty));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: 'Unauthorized' }, 401);
    const { data: profile, error: profileError } = await adminClient.from('portal_profiles').select('id,role,is_active').eq('auth_user_id', userData.user.id).maybeSingle();
    if (profileError) return json({ error: profileError.message }, 400);
    if (!profile?.is_active || !['admin', 'developer'].includes(profile.role)) return json({ error: 'Only active admin or developer can preview status reports' }, 403);

    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const result: Result = { total: rows.length, updated: 0, inserted: 0, skipped: 0, failed: 0, errors: [], previewRows: [] };

    for (const rawRow of rows) {
      const finalOrderNo = normNo(rawRow.finalOrderNo);
      const partNo = normPart(rawRow.partNo);
      try {
        if (!finalOrderNo || !partNo) {
          const reason = 'missing order or part';
          result.skipped += 1;
          result.errors.push(`${finalOrderNo || '-'} / ${partNo || '-'}: ${reason}`);
          result.previewRows.push({ status: 'skipped', action: 'skip', orderNo: finalOrderNo || '-', partNo: partNo || '-', reason });
          continue;
        }

        const { data: orders, error: orderError } = await adminClient
          .from('portal_orders')
          .select('id,order_no,status,branch')
          .or(`final_order_no.eq.${finalOrderNo},processing_reference.eq.${finalOrderNo},order_no.eq.${finalOrderNo}`)
          .limit(2);
        if (orderError) throw orderError;
        if (!orders?.length) {
          const reason = 'order not found';
          result.skipped += 1;
          result.errors.push(`${finalOrderNo} / ${partNo}: ${reason}`);
          result.previewRows.push({ status: 'skipped', action: 'skip', orderNo: finalOrderNo, partNo, reason });
          continue;
        }
        if (orders.length > 1) {
          const reason = 'multiple orders matched';
          result.skipped += 1;
          result.errors.push(`${finalOrderNo} / ${partNo}: ${reason}`);
          result.previewRows.push({ status: 'skipped', action: 'skip', orderNo: finalOrderNo, partNo, reason, matchCount: orders.length });
          continue;
        }

        const order = orders[0];
        const { data: currentItems, error: itemError } = await adminClient
          .from('portal_order_items')
          .select('id, order_id, part_no, qty, edited_qty, billed_qty, row_status')
          .eq('order_id', order.id)
          .eq('part_no', partNo)
          .order('created_at', { ascending: true });
        if (itemError) throw itemError;
        if (!currentItems?.length) {
          const reason = 'item row not found';
          result.skipped += 1;
          result.errors.push(`${finalOrderNo} / ${partNo}: ${reason}`);
          result.previewRows.push({ status: 'skipped', action: 'skip', orderNo: finalOrderNo, partNo, reason });
          continue;
        }

        const itemRows = currentItems as ItemRow[];
        const activeItems = itemRows.filter((item) => !closedRowStatuses.has(normalizeStatus(item.row_status)));
        const activeItem = activeItems[0] ?? null;
        if (!activeItem) {
          const reason = 'item is fully received, issued, or rejected';
          result.skipped += 1;
          result.errors.push(`${finalOrderNo} / ${partNo}: ${reason}`);
          result.previewRows.push({ status: 'skipped', action: 'skip', orderNo: finalOrderNo, partNo, reason, matchCount: itemRows.length, activeMatchCount: 0 });
          continue;
        }

        result.inserted += 1;
        result.updated += 1;
        result.previewRows.push({
          status: 'matched',
          action: 'would_insert_billing_chunk',
          orderNo: order.order_no || finalOrderNo,
          partNo,
          reason: 'Matched by Order No + Part No. Preview only; no database write done.',
          billedQty: num(rawRow.billedQty),
          itemQty: effectiveQty(activeItem),
          currentBilledQty: num(activeItem.billed_qty),
          currentRowStatus: activeItem.row_status,
          matchCount: itemRows.length,
          activeMatchCount: activeItems.length,
          warning: activeItems.length > 1 ? 'More than one active item row matched. Current apply logic would use the first active row.' : undefined,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'failed';
        result.failed += 1;
        result.errors.push(`${finalOrderNo || '-'} / ${partNo || '-'}: ${reason}`);
        result.previewRows.push({ status: 'failed', action: 'error', orderNo: finalOrderNo || '-', partNo: partNo || '-', reason });
      }
    }

    return json(result);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Preview failed' }, 500);
  }
});
