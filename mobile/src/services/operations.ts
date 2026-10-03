import { supabase } from '@/lib/supabase';
import { getBilledQty, getEffectiveQty, getEffectiveValue, getOrderStatusLabel, getReceivedQty, getResolvedRowStatus, normalizeStatus, type LegacyLikeOrderItem } from '@/lib/orderLogic';
import { getCurrentPortalProfile } from '@/services/profile';
import type { OrderSummary } from '@/services/orders';

export type PendingIssueOrder = {
  id: string; order_no: string; final_order_no: string | null; branch: string; order_type: string; customer_name: string | null; contact_no: string | null;
  machine_no: string | null; call_id: string | null; received_date: string | null; total_qty: number; total_value: number; age_days: number;
};
export type PendingIssuePart = { id: string; order_id: string; part_no: string; description: string | null; effective_qty: number; billed_qty: number; received_qty: number; item_status: string; effective_value: number };
export type DelayedVorOrder = OrderSummary & { age_days: number };

type OrderRow = PendingIssueOrder & { order_for: string | null; status: string | null; issued_at: string | null; processed_date?: string | null };
type ItemRow = LegacyLikeOrderItem & { id: string; order_id: string; part_no?: string | null; description?: string | null };
type BillingRow = { item_id: string; billed_qty: number | string | null; received_qty: number | string | null; received_at: string | null };

function ageDays(value: string | null | undefined) { if (!value) return 0; const start = new Date(value); const today = new Date(); start.setHours(0,0,0,0); today.setHours(0,0,0,0); return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000)); }
async function scopedOrders(select: string) {
  const profile = await getCurrentPortalProfile();
  if (!profile?.is_active) return [] as Record<string, unknown>[];
  let query = supabase.from('portal_orders').select(select).order('created_at', { ascending: false }).limit(1000);
  if (profile.role === 'branch') query = query.eq('branch', profile.branch ?? '__NO_BRANCH_SCOPE__');
  const { data, error } = await query; if (error) throw error; return (data ?? []) as unknown as Record<string, unknown>[];
}
async function getItemsAndBillings(orderIds: string[]) {
  if (!orderIds.length) return { items: [] as ItemRow[], billings: [] as BillingRow[] };
  const { data: items, error: itemError } = await supabase.from('portal_order_items').select('id,order_id,part_no,description,qty,edited_qty,value,edited_value,billed_qty,row_status,status,approval_status').in('order_id', orderIds);
  if (itemError) throw itemError;
  const itemRows = (items ?? []) as unknown as ItemRow[];
  const itemIds = itemRows.map((item) => item.id);
  if (!itemIds.length) return { items: itemRows, billings: [] as BillingRow[] };
  const { data: billings, error: billingError } = await supabase.from('portal_order_item_billings').select('item_id,billed_qty,received_qty,received_at').in('item_id', itemIds);
  if (billingError) throw billingError;
  return { items: itemRows, billings: (billings ?? []) as BillingRow[] };
}
function hydrate(items: ItemRow[], billings: BillingRow[]) {
  const map = new Map<string, BillingRow[]>();
  for (const row of billings) map.set(row.item_id, [...(map.get(row.item_id) ?? []), row]);
  return items.map((item) => ({ ...item, billing_chunks: map.get(item.id) ?? [] }));
}

export async function getPendingIssueOrders(): Promise<PendingIssueOrder[]> {
  const raw = await scopedOrders('id,order_no,final_order_no,branch,order_type,order_for,customer_name,contact_no,machine_no,call_id,status,received_date,issued_at,created_at');
  const orders = raw as unknown as OrderRow[];
  const candidates = orders.filter((order) => String(order.order_for ?? '').toLowerCase() === 'customer' && !order.issued_at && normalizeStatus(order.status) !== 'ISSUED');
  const { items, billings } = await getItemsAndBillings(candidates.map((order) => order.id));
  const hydrated = hydrate(items, billings);
  const byOrder = new Map<string, ItemRow[]>();
  for (const item of hydrated) byOrder.set(item.order_id, [...(byOrder.get(item.order_id) ?? []), item]);
  return candidates.flatMap((order) => {
    const orderItems = byOrder.get(order.id) ?? [];
    if (!orderItems.length || getOrderStatusLabel(orderItems) !== 'RECEIVED') return [];
    const latest = orderItems.flatMap((item) => item.billing_chunks ?? []).map((chunk) => chunk.received_at).filter((v): v is string => Boolean(v)).sort().at(-1) ?? null;
    const received = order.received_date || latest;
    return [{ id: order.id, order_no: order.order_no, final_order_no: order.final_order_no, branch: order.branch, order_type: order.order_type, customer_name: order.customer_name, contact_no: order.contact_no, machine_no: order.machine_no, call_id: order.call_id, received_date: received, total_qty: orderItems.reduce((sum, item) => sum + getEffectiveQty(item), 0), total_value: orderItems.reduce((sum, item) => sum + getEffectiveValue(item), 0), age_days: ageDays(received) }];
  }).sort((a,b) => b.age_days - a.age_days);
}
export async function getPendingIssueParts(orderId: string): Promise<PendingIssuePart[]> {
  const { items, billings } = await getItemsAndBillings([orderId]);
  return hydrate(items, billings).map((item) => ({ id: item.id, order_id: item.order_id, part_no: String(item.part_no ?? ''), description: item.description ?? null, effective_qty: getEffectiveQty(item), billed_qty: getBilledQty(item), received_qty: getReceivedQty(item), item_status: getResolvedRowStatus(item), effective_value: getEffectiveValue(item) }));
}
export async function markOrderIssued(orderId: string, documentType: string, documentNo: string) {
  const clean = documentNo.trim().toUpperCase(); if (!clean) throw new Error('Issued document number is required.');
  const { data, error } = await supabase.rpc('mark_portal_order_issued', { p_order_id: orderId, p_document_type: documentType, p_document_no: clean });
  if (error) throw error; return data;
}
export async function getDelayedVorOrders(): Promise<DelayedVorOrder[]> {
  const raw = await scopedOrders('id,order_no,branch,order_type,order_for,machine_no,customer_name,status,approval_status,approver_id,processing_reference,processed_date,final_order_no,dbms_invoice_no,dbms_invoice_date,received_date,docket_no,transport_name,total_qty,total_value,comment_count,created_at');
  const vor = (raw as unknown as OrderSummary[]).filter((order) => String(order.order_type ?? '').toUpperCase() === 'VOR');
  const { items, billings } = await getItemsAndBillings(vor.map((order) => order.id));
  const hydrated = hydrate(items, billings);
  const eligible = new Set<string>();
  for (const item of hydrated) if (['PROCESSED','PARTIALLY DISPATCHED'].includes(getResolvedRowStatus(item))) eligible.add(item.order_id);
  return vor.filter((order) => eligible.has(order.id)).map((order) => ({ ...order, age_days: ageDays(order.processed_date) })).sort((a,b) => b.age_days - a.age_days);
}
export async function getApprovedAdminOrders(): Promise<OrderSummary[]> {
  const profile = await getCurrentPortalProfile();
  if (!profile?.is_active || !['admin','developer'].includes(profile.role ?? '')) return [];
  const { data, error } = await supabase.from('portal_orders').select('id,order_no,branch,order_type,order_for,machine_no,customer_name,status,approval_status,approver_id,processing_reference,processed_date,final_order_no,dbms_invoice_no,dbms_invoice_date,received_date,docket_no,transport_name,total_qty,total_value,comment_count,created_at').eq('status','approved').order('created_at',{ascending:false}).limit(500);
  if (error) throw error; return (data ?? []) as OrderSummary[];
}
async function adminAction(body: Record<string,string>) { const { data, error } = await supabase.functions.invoke('admin-order-action',{body}); if (error) throw error; if (data?.error) throw new Error(String(data.error)); return data; }
export async function processApprovedOrder(order: Pick<OrderSummary,'id'|'order_no'>, finalOrderNo: string, notes = '') {
  const ref = finalOrderNo.trim().toUpperCase(); if (!ref) throw new Error('Final order number is required.'); if (ref === order.order_no.toUpperCase()) throw new Error('Final order number cannot be same as temporary order number.');
  return adminAction({ action:'process', orderId:order.id, processingReference:ref, processedNotes:notes.trim() });
}
export async function rejectApprovedOrder(orderId: string, reason: string) { return adminAction({ action:'reject', orderId, reason:reason.trim() }); }
