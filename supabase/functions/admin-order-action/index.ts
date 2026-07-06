import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function normalizeStatus(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isClosedStatus(value: unknown) {
  const status = normalizeStatus(value);
  return status === 'received' || status === 'issued' || status === 'rejected';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authHeader) return json({ error: 'Missing function configuration or auth header' }, 500);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401);

  const { data: profile, error: profileError } = await adminClient
    .from('portal_profiles')
    .select('id, role, is_active')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();
  if (profileError) return json({ error: profileError.message }, 400);
  if (!profile?.is_active || !['admin', 'developer'].includes(profile.role)) return json({ error: 'Only active admin or developer can perform this action' }, 403);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');
  const orderId = String(body.orderId ?? '');
  if (!orderId) return json({ error: 'Order id is required' }, 400);

  const { data: order, error: orderError } = await adminClient
    .from('portal_orders')
    .select('id, order_no, final_order_no, processing_reference, status, approval_status, order_for')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) return json({ error: orderError.message }, 400);
  if (!order) return json({ error: 'Order not found' }, 404);

  const now = new Date().toISOString();

  async function addEvent(eventType: string, oldStatus: string | null, newStatus: string | null, notes: string, metadata: Record<string, unknown> = {}) {
    const { error } = await adminClient.from('portal_order_events').insert({
      order_id: order.id,
      event_type: eventType,
      old_status: oldStatus,
      new_status: newStatus,
      actor_id: profile.id,
      notes,
      metadata,
    });
    if (error) throw error;
  }

  try {
    if (action === 'process') {
      const reference = String(body.processingReference ?? '').trim().toUpperCase();
      const notes = String(body.processedNotes ?? '').trim();
      if (!reference) return json({ error: 'Final order number is required' }, 400);
      if (reference === String(order.order_no).toUpperCase()) return json({ error: 'Final order number cannot be same as temporary order number' }, 400);
      if (normalizeStatus(order.status) !== 'approved' && normalizeStatus(order.approval_status) !== 'approved') return json({ error: 'Only approved orders can be processed.' }, 400);

      const { data: duplicateRows, error: duplicateError } = await adminClient
        .from('portal_orders')
        .select('id')
        .or(`final_order_no.eq.${reference},processing_reference.eq.${reference},order_no.eq.${reference}`)
        .neq('id', order.id)
        .limit(1);
      if (duplicateError) throw duplicateError;
      if (duplicateRows?.length) return json({ error: 'Final order number already exists' }, 409);

      const { error } = await adminClient.from('portal_orders').update({
        status: 'processed',
        approval_status: 'approved',
        processing_reference: reference,
        final_order_no: reference,
        processed_notes: notes || null,
        processed_date: now.slice(0, 10),
        updated_at: now,
      }).eq('id', order.id);
      if (error) throw error;

      const { error: itemError } = await adminClient
        .from('portal_order_items')
        .update({ row_status: 'processed', updated_at: now })
        .eq('order_id', order.id)
        .not('row_status', 'in', '(received,issued,rejected)');
      if (itemError) throw itemError;

      await addEvent('ADMIN_PROCESSED', order.status, 'processed', `Processed with final order number ${reference}.`, { final_order_no: reference });
      return json({ ok: true, status: 'processed', finalOrderNo: reference });
    }

    if (action === 'reject') {
      if (isClosedStatus(order.status)) return json({ error: 'Closed order cannot be rejected.' }, 400);
      const reason = String(body.reason ?? '').trim();
      const { error } = await adminClient.from('portal_orders').update({ status: 'rejected', approval_status: 'rejected', processed_notes: reason || null, updated_at: now }).eq('id', order.id);
      if (error) throw error;
      const { error: itemError } = await adminClient.from('portal_order_items').update({ row_status: 'rejected', updated_at: now }).eq('order_id', order.id).not('row_status', 'in', '(received,issued)');
      if (itemError) throw itemError;
      await addEvent('ADMIN_REJECTED', order.status, 'rejected', reason || 'Rejected by admin.');
      return json({ ok: true, status: 'rejected' });
    }

    if (action === 'issue') {
      if (String(order.order_for ?? '').toLowerCase() !== 'customer') return json({ error: 'Only customer orders can be marked issued' }, 400);
      const invoiceNo = String(body.invoiceNo ?? '').trim().toUpperCase();
      const invoiceDate = String(body.invoiceDate ?? '').trim();
      const docketNo = String(body.docketNo ?? '').trim().toUpperCase();
      const transportName = String(body.transportName ?? '').trim();
      if (!invoiceNo) return json({ error: 'Invoice number is required' }, 400);
      if (!invoiceDate) return json({ error: 'Invoice date is required' }, 400);

      const { error: itemError } = await adminClient.from('portal_order_items').update({
        dbms_invoice_no: invoiceNo,
        dbms_invoice_date: invoiceDate,
        docket_no: docketNo || null,
        transport_name: transportName || null,
        row_status: 'issued',
        updated_at: now,
      }).eq('order_id', order.id).neq('row_status', 'received');
      if (itemError) throw itemError;

      const { error } = await adminClient.from('portal_orders').update({ status: 'issued', updated_at: now }).eq('id', order.id);
      if (error) throw error;
      await addEvent('ORDER_ISSUED', order.status, 'issued', `Issued item rows with invoice ${invoiceNo}.`, { invoice_no: invoiceNo, invoice_date: invoiceDate, docket_no: docketNo || null, transport_name: transportName || null });
      return json({ ok: true, status: 'issued' });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Admin action failed' }, 400);
  }
});
