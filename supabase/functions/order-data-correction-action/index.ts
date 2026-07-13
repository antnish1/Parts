import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const fail = (message: string, code = 'CORRECTION_FAILED', status = 400) => json({ ok: false, error: message, code }, status);

type Row = Record<string, unknown>;
const ORDER_FIELDS = new Set(['final_order_no', 'processing_reference', 'order_type', 'order_for', 'machine_no', 'customer_name', 'contact_no', 'call_id', 'warranty_status', 'status', 'approval_status', 'processed_date', 'dbms_invoice_no', 'dbms_invoice_date']);
const ITEM_FIELDS = new Set(['part_no', 'description', 'dnp', 'qty', 'edited_qty', 'billed_qty', 'value', 'edited_value', 'order_reg_date', 'dbms_invoice_no', 'dbms_invoice_date', 'docket_no', 'transport_name', 'received_date', 'row_status', 'dispatch_status_legacy']);
const BILLING_FIELDS = new Set(['billed_qty', 'received_qty', 'billing_date', 'order_reg_date', 'delivery_no', 'invoice_no', 'docket_no', 'transport_name', 'transport_mode', 'packing_detail', 'eway_bill_no', 'gst_invoice_no', 'raw_status', 'received_at']);
const PART_COLUMNS = ['part_no', 'partno', 'part number', 'part_number', 'item_code', 'itemcode', 'material', 'material no', 'material_no', 'material number', 'materialnumber', 'Material', 'Material No', 'Material No.'];
const DESCRIPTION_COLUMNS = ['description', 'part_description', 'material_description', 'item_name', 'itemname', 'name', 'Description', 'Material Description'];
const DNP_COLUMNS = ['dnp', 'DNP', 'new rtl', 'new_rtl', 'rtl', 'RTL', 'price', 'sale_price', 'rate'];

const clean = (value: unknown) => String(value ?? '').trim();
const normalizePartNo = (value: unknown) => clean(value).replace(/\s+/g, '').toUpperCase();
const normalizeKey = (value: string) => value.trim().replace(/[\s_./-]+/g, '').toLowerCase();
const numberOrNull = (value: unknown) => value === '' || value === null || value === undefined ? null : Number(value);

function readValue(row: Row, aliases: string[]) {
  const wanted = aliases.map(normalizeKey);
  const key = Object.keys(row).find((item) => wanted.includes(normalizeKey(item)));
  return key ? row[key] : null;
}

function pickAllowed(changes: Row, allowed: Set<string>) {
  const result: Row = {};
  for (const [key, value] of Object.entries(changes ?? {})) if (allowed.has(key)) result[key] = value === '' ? null : value;
  return result;
}

function changedFields(before: Row, after: Row) {
  const changes: Row = {};
  for (const [key, value] of Object.entries(after)) {
    const oldValue = before[key] ?? null;
    const newValue = value ?? null;
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) changes[key] = { old: oldValue, new: newValue };
  }
  return changes;
}

async function getProfile(userClient: ReturnType<typeof createClient>, admin: ReturnType<typeof createClient>) {
  const { data: authData } = await userClient.auth.getUser();
  if (!authData.user) throw new Error('Unauthorized. Please log in again.');
  const { data: profile, error } = await admin.from('portal_profiles').select('id, full_name, role, is_active').eq('auth_user_id', authData.user.id).maybeSingle();
  if (error) throw error;
  if (!profile?.is_active || !['manager', 'developer'].includes(profile.role)) throw new Error('Only Manager and Developer users can correct order data.');
  return profile as { id: string; full_name: string; role: string };
}

async function lookupPart(admin: ReturnType<typeof createClient>, partNoInput: unknown) {
  const partNo = normalizePartNo(partNoInput);
  if (!partNo) throw new Error('Part number is required.');
  for (const column of PART_COLUMNS) {
    const { data, error } = await admin.from('part_master').select('*').eq(column, partNo).limit(1);
    if (!error && data?.length) {
      const row = data[0] as Row;
      const description = clean(readValue(row, DESCRIPTION_COLUMNS)) || null;
      const rawDnp = readValue(row, DNP_COLUMNS);
      const dnp = rawDnp === null || rawDnp === '' ? null : Number(String(rawDnp).replace(/,/g, ''));
      return { part_no: partNo, description, dnp: Number.isFinite(dnp) ? dnp : null };
    }
  }
  for (let start = 0; ; start += 1000) {
    const { data, error } = await admin.from('part_master').select('*').range(start, start + 999);
    if (error) throw error;
    for (const row of (data ?? []) as Row[]) {
      const candidate = normalizePartNo(readValue(row, PART_COLUMNS));
      if (candidate !== partNo) continue;
      const description = clean(readValue(row, DESCRIPTION_COLUMNS)) || null;
      const rawDnp = readValue(row, DNP_COLUMNS);
      const dnp = rawDnp === null || rawDnp === '' ? null : Number(String(rawDnp).replace(/,/g, ''));
      return { part_no: partNo, description, dnp: Number.isFinite(dnp) ? dnp : null };
    }
    if ((data ?? []).length < 1000) break;
  }
  throw new Error('Part number not found in Part Master.');
}

async function readConsole(admin: ReturnType<typeof createClient>, orderId: string) {
  const { data: order, error: orderError } = await admin.from('portal_orders').select('id, order_no, final_order_no, processing_reference, branch, order_type, order_for, machine_no, customer_name, contact_no, call_id, warranty_status, status, approval_status, processed_date, dbms_invoice_no, dbms_invoice_date, updated_at').eq('id', orderId).single();
  if (orderError) throw orderError;
  const { data: items, error: itemError } = await admin.from('portal_order_items').select('id, order_id, part_no, description, dnp, qty, edited_qty, billed_qty, value, edited_value, order_reg_date, dbms_invoice_no, dbms_invoice_date, docket_no, transport_name, received_date, row_status, dispatch_status_legacy, updated_at').eq('order_id', orderId).order('created_at');
  if (itemError) throw itemError;
  const { data: billings, error: billingError } = await admin.from('portal_order_item_billings').select('id, item_id, order_id, order_no, part_no, billed_qty, received_qty, billing_date, order_reg_date, delivery_no, invoice_no, docket_no, transport_name, transport_mode, packing_detail, eway_bill_no, gst_invoice_no, raw_status, received_at, updated_at').eq('order_id', orderId).order('created_at');
  if (billingError) throw billingError;
  const { data: events, error: eventError } = await admin.from('portal_order_events').select('id, event_type, notes, metadata, created_at').eq('order_id', orderId).eq('event_type', 'manual_data_correction').order('created_at', { ascending: false }).limit(100);
  if (eventError) throw eventError;
  const billingMap = new Map<string, Row[]>();
  for (const billing of (billings ?? []) as Row[]) {
    const itemId = String(billing.item_id);
    billingMap.set(itemId, [...(billingMap.get(itemId) ?? []), billing]);
  }
  return { order, items: ((items ?? []) as Row[]).map((item) => ({ ...item, billings: billingMap.get(String(item.id)) ?? [] })), events: events ?? [] };
}

async function addAudit(admin: ReturnType<typeof createClient>, orderId: string, actor: { id: string; full_name: string; role: string }, payload: Row, changes: Row) {
  const reason = clean(payload.reason);
  const category = clean(payload.category);
  if (!reason || !category) throw new Error('Correction category and reason are required.');
  const action = clean(payload.action);
  const notes = `${actor.full_name} (${actor.role}) performed ${action}. ${category}: ${reason}`;
  const { error } = await admin.from('portal_order_events').insert({
    order_id: orderId,
    event_type: 'manual_data_correction',
    actor_id: actor.id,
    notes,
    metadata: { action, category, reason, reference: clean(payload.reference) || null, target_item_id: payload.itemId ?? null, target_billing_id: payload.billingId ?? null, changes, update_linked_billings: Boolean(payload.updateLinkedBillings), sync_matching_items: Boolean(payload.syncMatchingItems) },
  });
  if (error) throw error;
}

async function assertFresh(row: Row, expected: unknown) {
  if (expected && String(row.updated_at ?? '') !== String(expected)) throw new Error('This record changed after you opened it. Reload the console and try again.');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('Method not allowed.', 'METHOD_NOT_ALLOWED', 405);
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);
    const actor = await getProfile(userClient, admin);
    const body = await req.json().catch(() => ({})) as Row;
    const action = clean(body.action);
    const orderId = clean(body.orderId);
    if (!orderId) return fail('Order ID is required.');
    if (action === 'read') return json({ ok: true, data: await readConsole(admin, orderId) });
    if (!clean(body.reason) || !clean(body.category)) return fail('Correction category and reason are required.');

    let auditChanges: Row = {};
    if (action === 'update_order') {
      const { data: current, error } = await admin.from('portal_orders').select('*').eq('id', orderId).single();
      if (error) throw error;
      await assertFresh(current as Row, body.expectedUpdatedAt);
      const patch = pickAllowed((body.changes ?? {}) as Row, ORDER_FIELDS);
      auditChanges = changedFields(current as Row, patch);
      if (!Object.keys(auditChanges).length) throw new Error('No order changes were detected.');
      const oldInvoice = current.dbms_invoice_no ?? null;
      const oldInvoiceDate = current.dbms_invoice_date ?? null;
      const { error: updateError } = await admin.from('portal_orders').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', orderId);
      if (updateError) throw updateError;
      if (body.syncMatchingItems && ('dbms_invoice_no' in patch || 'dbms_invoice_date' in patch)) {
        const itemPatch: Row = {};
        if ('dbms_invoice_no' in patch) itemPatch.dbms_invoice_no = patch.dbms_invoice_no;
        if ('dbms_invoice_date' in patch) itemPatch.dbms_invoice_date = patch.dbms_invoice_date;
        let query = admin.from('portal_order_items').update({ ...itemPatch, updated_at: new Date().toISOString() }).eq('order_id', orderId);
        if ('dbms_invoice_no' in patch) query = oldInvoice === null ? query.is('dbms_invoice_no', null) : query.eq('dbms_invoice_no', oldInvoice);
        if ('dbms_invoice_date' in patch) query = oldInvoiceDate === null ? query.is('dbms_invoice_date', null) : query.eq('dbms_invoice_date', oldInvoiceDate);
        const { error: syncError } = await query;
        if (syncError) throw syncError;
      }
    } else if (action === 'update_item') {
      const itemId = clean(body.itemId);
      const { data: current, error } = await admin.from('portal_order_items').select('*').eq('id', itemId).eq('order_id', orderId).single();
      if (error) throw error;
      await assertFresh(current as Row, body.expectedUpdatedAt);
      const patch = pickAllowed((body.changes ?? {}) as Row, ITEM_FIELDS);
      if ('part_no' in patch && normalizePartNo(patch.part_no) !== normalizePartNo(current.part_no)) {
        const part = await lookupPart(admin, patch.part_no);
        const qty = numberOrNull('qty' in patch ? patch.qty : current.qty) ?? 0;
        const editedQty = numberOrNull('edited_qty' in patch ? patch.edited_qty : current.edited_qty);
        patch.part_no = part.part_no;
        patch.description = part.description;
        patch.dnp = part.dnp;
        patch.value = part.dnp === null ? null : part.dnp * qty;
        patch.edited_value = editedQty === null || part.dnp === null ? null : part.dnp * editedQty;
        if (body.updateLinkedBillings !== false) {
          const { error: linkedError } = await admin.from('portal_order_item_billings').update({ part_no: part.part_no, updated_at: new Date().toISOString() }).eq('item_id', itemId).eq('order_id', orderId);
          if (linkedError) throw linkedError;
        }
      } else {
        const dnp = numberOrNull('dnp' in patch ? patch.dnp : current.dnp);
        const qty = numberOrNull('qty' in patch ? patch.qty : current.qty) ?? 0;
        const editedQty = numberOrNull('edited_qty' in patch ? patch.edited_qty : current.edited_qty);
        if ('dnp' in patch || 'qty' in patch) patch.value = dnp === null ? null : dnp * qty;
        if ('dnp' in patch || 'edited_qty' in patch) patch.edited_value = editedQty === null || dnp === null ? null : dnp * editedQty;
      }
      auditChanges = changedFields(current as Row, patch);
      if (!Object.keys(auditChanges).length) throw new Error('No item changes were detected.');
      const { error: updateError } = await admin.from('portal_order_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', itemId).eq('order_id', orderId);
      if (updateError) throw updateError;
    } else if (action === 'create_item') {
      const patch = pickAllowed((body.changes ?? {}) as Row, ITEM_FIELDS);
      const part = await lookupPart(admin, patch.part_no);
      const qty = numberOrNull(patch.qty) ?? 0;
      const editedQty = numberOrNull(patch.edited_qty);
      const row = { ...patch, order_id: orderId, part_no: part.part_no, description: part.description, dnp: part.dnp, qty, value: part.dnp === null ? null : part.dnp * qty, edited_value: editedQty === null || part.dnp === null ? null : part.dnp * editedQty, legacy_source: 'manual_correction' };
      const { data: created, error } = await admin.from('portal_order_items').insert(row).select('*').single();
      if (error) throw error;
      auditChanges = { created: created };
    } else if (action === 'update_billing') {
      const billingId = clean(body.billingId);
      const { data: current, error } = await admin.from('portal_order_item_billings').select('*').eq('id', billingId).eq('order_id', orderId).single();
      if (error) throw error;
      await assertFresh(current as Row, body.expectedUpdatedAt);
      const patch = pickAllowed((body.changes ?? {}) as Row, BILLING_FIELDS);
      auditChanges = changedFields(current as Row, patch);
      if (!Object.keys(auditChanges).length) throw new Error('No billing changes were detected.');
      const { error: updateError } = await admin.from('portal_order_item_billings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', billingId).eq('order_id', orderId);
      if (updateError) throw updateError;
    } else if (action === 'create_billing') {
      const itemId = clean(body.itemId);
      const { data: item, error: itemError } = await admin.from('portal_order_items').select('id, part_no').eq('id', itemId).eq('order_id', orderId).single();
      if (itemError) throw itemError;
      const { data: order, error: orderError } = await admin.from('portal_orders').select('order_no, final_order_no').eq('id', orderId).single();
      if (orderError) throw orderError;
      const patch = pickAllowed((body.changes ?? {}) as Row, BILLING_FIELDS);
      const idempotencyKey = `manual:${orderId}:${itemId}:${crypto.randomUUID()}`;
      const row = { ...patch, order_id: orderId, item_id: itemId, order_no: order.final_order_no || order.order_no, part_no: item.part_no, source: 'manual_correction', idempotency_key: idempotencyKey, created_by: actor.id };
      const { data: created, error } = await admin.from('portal_order_item_billings').insert(row).select('*').single();
      if (error) throw error;
      auditChanges = { created };
    } else if (action === 'delete_billing') {
      const billingId = clean(body.billingId);
      const { data: current, error } = await admin.from('portal_order_item_billings').select('*').eq('id', billingId).eq('order_id', orderId).single();
      if (error) throw error;
      const { error: deleteError } = await admin.from('portal_order_item_billings').delete().eq('id', billingId).eq('order_id', orderId);
      if (deleteError) throw deleteError;
      auditChanges = { deleted: current };
    } else if (action === 'delete_item') {
      const itemId = clean(body.itemId);
      const { data: current, error } = await admin.from('portal_order_items').select('*, portal_order_item_billings(*)').eq('id', itemId).eq('order_id', orderId).single();
      if (error) throw error;
      const linked = Array.isArray(current.portal_order_item_billings) ? current.portal_order_item_billings.length : 0;
      if (linked > 0 && body.deleteLinkedBillings !== true) throw new Error(`This item has ${linked} linked billing row(s). Confirm linked-row deletion first.`);
      const { error: deleteError } = await admin.from('portal_order_items').delete().eq('id', itemId).eq('order_id', orderId);
      if (deleteError) throw deleteError;
      auditChanges = { deleted: current };
    } else {
      return fail('Unsupported correction action.', 'UNSUPPORTED_ACTION');
    }

    await addAudit(admin, orderId, actor, body, auditChanges);
    return json({ ok: true, data: await readConsole(admin, orderId) });
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
});
