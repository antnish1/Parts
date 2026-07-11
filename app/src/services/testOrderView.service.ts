import { supabase } from '../lib/supabase';
import { getEffectiveQty, getReceivedQty, getResolvedRowStatus, normalizePartNo } from '../lib/orderLogic';
import { currentBranchScopeIncludes, getCurrentPortalProfile } from './branchScope.service';
import { getBranchCalculationScope } from './branchCalculation.service';
import { withCentralOrderValues } from './centralBranchGroup.service';

export type TestOrderView = {
  id: string;
  order_no: string;
  branch: string;
  order_type: string;
  order_for: string;
  machine_no: string | null;
  customer_name: string | null;
  call_id: string | null;
  warranty_status: string | null;
  status: string;
  approval_status: string;
  employee_id: string | null;
  approver_id: string | null;
  processing_reference: string | null;
  processed_notes: string | null;
  processed_date: string | null;
  final_order_no: string | null;
  order_reg_date: string | null;
  dbms_invoice_no: string | null;
  dbms_invoice_date: string | null;
  received_date: string | null;
  docket_no: string | null;
  transport_name: string | null;
  created_at: string;
  approver?: { full_name: string | null; role: string | null } | null;
  employee?: { full_name: string | null; role: string | null } | null;
};

export type TestOrderBillingChunk = {
  id: string;
  item_id: string;
  order_id: string;
  order_no: string;
  part_no: string;
  billed_qty: number | null;
  received_qty: number | null;
  received_at: string | null;
  billing_date: string | null;
  order_reg_date: string | null;
  delivery_no: string | null;
  invoice_no: string | null;
  docket_no: string | null;
  transport_name: string | null;
  transport_mode: string | null;
  packing_detail: string | null;
  eway_bill_no: string | null;
  gst_invoice_no: string | null;
  raw_status: string | null;
  source: string | null;
  created_at: string;
};

export type TestOrderViewItem = {
  id: string;
  part_no: string;
  description: string | null;
  dnp: number | null;
  qty: number;
  edited_qty: number | null;
  billed_qty: number | null;
  value: number | null;
  edited_value: number | null;
  previous_30d_qty: number | null;
  in_transit_qty: number;
  order_reg_date: string | null;
  dbms_invoice_no: string | null;
  dbms_invoice_date: string | null;
  docket_no: string | null;
  transport_name: string | null;
  received_date: string | null;
  row_status: string | null;
  billing_chunks: TestOrderBillingChunk[];
};

export type TestOrderEvent = { id: string; event_type: string; old_status: string | null; new_status: string | null; notes: string | null; created_at: string; };
export type TestOrderCommentAttachment = { id: string; comment_id: string; original_file_name: string; mime_type: string; file_size_bytes: number; created_at: string; };
export type TestOrderComment = { id: string; comment_type: string; body: string | null; attachment_path: string | null; created_at: string; author?: { full_name: string | null; role: string | null } | null; attachments: TestOrderCommentAttachment[]; };

type RawOrderView = Omit<TestOrderView, 'approver' | 'employee'> & { approver?: { full_name: string | null; role: string | null } | Array<{ full_name: string | null; role: string | null }> | null; employee?: { full_name: string | null; role: string | null } | Array<{ full_name: string | null; role: string | null }> | null; };
type RawComment = Omit<TestOrderComment, 'author' | 'attachments'> & { author?: { full_name: string | null; role: string | null } | Array<{ full_name: string | null; role: string | null }> | null; };
type RawItem = Omit<TestOrderViewItem, 'billing_chunks' | 'in_transit_qty'>;
type TransitCandidate = RawItem & { order_id: string; billing_chunks?: TestOrderBillingChunk[]; portal_orders?: { branch: string | null; status: string | null; approval_status: string | null } | null };

const OPEN_TRANSIT_STATUSES = new Set(['APPROVED', 'PROCESSED', 'PARTIALLY DISPATCHED', 'DISPATCHED', 'PARTIALLY RECEIVED']);

function normalizeOrderView(order: RawOrderView): TestOrderView {
  const approver = Array.isArray(order.approver) ? order.approver[0] ?? null : order.approver ?? null;
  const employee = Array.isArray(order.employee) ? order.employee[0] ?? null : order.employee ?? null;
  return { ...order, approver, employee };
}

function normalizeComment(comment: RawComment, attachments: TestOrderCommentAttachment[]): TestOrderComment {
  const author = Array.isArray(comment.author) ? comment.author[0] ?? null : comment.author ?? null;
  return { ...comment, author, attachments };
}

function normalizeCommentText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function isTransitCandidate(row: TransitCandidate) {
  const resolvedStatus = getResolvedRowStatus(row);
  if (!OPEN_TRANSIT_STATUSES.has(resolvedStatus)) return false;
  const headerStatus = String(row.portal_orders?.status ?? '').toLowerCase();
  const approvalStatus = String(row.portal_orders?.approval_status ?? '').toLowerCase();
  if (headerStatus.includes('pending') || approvalStatus.includes('pending')) return false;
  if (headerStatus.includes('reject') || approvalStatus.includes('reject')) return false;
  if (headerStatus === 'received' || headerStatus === 'issued' || approvalStatus === 'received' || approvalStatus === 'issued') return false;
  return true;
}

export async function addTestOrderComment(orderId: string, body: string) {
  const text = normalizeCommentText(body);
  if (!orderId || !text) throw new Error('Comment is required.');

  const profile = await getCurrentPortalProfile();

  const { data: recent, error: recentError } = await supabase
    .from('portal_order_comments')
    .select('id, body, created_at')
    .eq('order_id', orderId)
    .eq('comment_type', 'user')
    .order('created_at', { ascending: false })
    .limit(5);
  if (recentError) throw recentError;

  const duplicate = (recent ?? []).some((comment) => normalizeCommentText(comment.body ?? '').toLowerCase() === text.toLowerCase());
  if (duplicate) throw new Error('Duplicate comment already exists for this order.');

  const { data, error } = await supabase
    .from('portal_order_comments')
    .insert({ order_id: orderId, author_id: profile?.id ?? null, comment_type: 'user', body: text })
    .select('id')
    .single();

  if (error) throw error;
  return data as { id: string };
}

async function getCommentAttachments(orderId: string, comments: Array<{ id: string }>) {
  if (!comments.length) return new Map<string, TestOrderCommentAttachment[]>();
  const map = new Map<string, TestOrderCommentAttachment[]>();
  const commentIds = comments.map((comment) => comment.id);
  const { data, error } = await supabase
    .from('portal_order_comment_attachments')
    .select('id, comment_id, original_file_name:original_filename, mime_type, file_size_bytes:size_bytes, created_at')
    .eq('order_id', orderId)
    .in('comment_id', commentIds)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Comment attachments are not available yet.', error.message);
    return map;
  }

  for (const attachment of (data ?? []) as TestOrderCommentAttachment[]) {
    const list = map.get(attachment.comment_id) ?? [];
    list.push(attachment);
    map.set(attachment.comment_id, list);
  }
  return map;
}

async function getBillingChunks(orderId: string, items: Array<{ id: string }>) {
  const map = new Map<string, TestOrderBillingChunk[]>();
  if (!items.length) return map;

  const { data, error } = await supabase
    .from('portal_order_item_billings')
    .select('id, item_id, order_id, order_no, part_no, billed_qty, received_qty, received_at, billing_date, order_reg_date, delivery_no, invoice_no, docket_no, transport_name, transport_mode, packing_detail, eway_bill_no, gst_invoice_no, raw_status, source, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Billing chunks are not available yet.', error.message);
    return map;
  }

  for (const chunk of (data ?? []) as TestOrderBillingChunk[]) {
    const list = map.get(chunk.item_id) ?? [];
    list.push(chunk);
    map.set(chunk.item_id, list);
  }
  return map;
}

async function getBillingChunksForItems(itemIds: string[]) {
  const map = new Map<string, TestOrderBillingChunk[]>();
  if (!itemIds.length) return map;

  const { data, error } = await supabase
    .from('portal_order_item_billings')
    .select('id, item_id, order_id, order_no, part_no, billed_qty, received_qty, received_at, billing_date, order_reg_date, delivery_no, invoice_no, docket_no, transport_name, transport_mode, packing_detail, eway_bill_no, gst_invoice_no, raw_status, source, created_at')
    .in('item_id', itemIds);

  if (error) {
    console.warn('In transit chunk lookup failed.', error.message);
    return map;
  }

  for (const chunk of (data ?? []) as TestOrderBillingChunk[]) {
    const list = map.get(chunk.item_id) ?? [];
    list.push(chunk);
    map.set(chunk.item_id, list);
  }
  return map;
}

async function getInTransitQtyByPart(branch: string, partNos: string[]) {
  const normalizedParts = [...new Set(partNos.map(normalizePartNo).filter(Boolean))];
  const result: Record<string, number> = {};
  const branchScope = withCentralOrderValues(await getBranchCalculationScope(branch));
  if (!branchScope.length || normalizedParts.length === 0) return result;

  const { data, error } = await supabase
    .from('portal_order_items')
    .select('id, order_id, part_no, description, dnp, qty, edited_qty, billed_qty, value, edited_value, previous_30d_qty, order_reg_date, dbms_invoice_no, dbms_invoice_date, docket_no, transport_name, received_date, row_status, portal_orders!inner(branch, status, approval_status)')
    .in('part_no', normalizedParts)
    .in('portal_orders.branch', branchScope)
    .neq('portal_orders.status', 'received')
    .neq('portal_orders.status', 'issued')
    .neq('portal_orders.status', 'rejected')
    .neq('portal_orders.approval_status', 'rejected');

  if (error) {
    console.warn('In transit lookup failed.', error.message);
    return result;
  }

  const rows = (data ?? []) as unknown as TransitCandidate[];
  const chunkMap = await getBillingChunksForItems(rows.map((row) => row.id));
  for (const row of rows) {
    const withChunks = { ...row, billing_chunks: chunkMap.get(row.id) ?? [] };
    if (!isTransitCandidate(withChunks)) continue;
    const part = normalizePartNo(row.part_no);
    result[part] = (result[part] ?? 0) + Math.max(0, getEffectiveQty(withChunks) - getReceivedQty(withChunks));
  }

  return result;
}

export async function getTestOrderView(orderId: string) {
  const { data: order, error: orderError } = await supabase
    .from('portal_orders')
    .select('id, order_no, branch, order_type, order_for, machine_no, customer_name, call_id, warranty_status, status, approval_status, employee_id, approver_id, processing_reference, processed_notes, processed_date, final_order_no, order_reg_date, dbms_invoice_no, dbms_invoice_date, received_date, docket_no, transport_name, created_at, approver:portal_profiles!portal_orders_approver_id_fkey(full_name, role))'
    .eq('id', orderId)
    .single();
  if (orderError) throw orderError;

  const rawOrder = order as unknown as RawOrderView;
  if (!(await currentBranchScopeIncludes(rawOrder.branch))) throw new Error('This order belongs to another branch.');
  const profile = await getCurrentPortalProfile();
  if (profile?.role === 'super' && rawOrder.approver_id !== profile.id) throw new Error('This order is assigned to another approver.');

  let employee: TestOrderView['employee'] = null;
  if (rawOrder.employee_id) {
    const { data: employeeProfile, error: employeeError } = await supabase
      .from('portal_profiles')
      .select('full_name, role')
      .eq('id', rawOrder.employee_id)
      .maybeSingle();
    if (employeeError) console.warn('Order employee lookup failed.', employeeError.message);
    else employee = employeeProfile;
  }

  const { data: items, error: itemError } = await supabase
    .from('portal_order_items')
    .select('id, part_no, description, dnp, qty, edited_qty, billed_qty, value, edited_value, previous_30d_qty, order_reg_date, dbms_invoice_no, dbms_invoice_date, docket_no, transport_name, received_date, row_status')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  if (itemError) throw itemError;

  const rawItems = (items ?? []) as RawItem[];
  const billingChunkMap = await getBillingChunks(orderId, rawItems);
  const inTransitMap = await getInTransitQtyByPart(rawOrder.branch, rawItems.map((item) => item.part_no));
  const itemsWithChunks = rawItems.map((item) => ({ ...item, billing_chunks: billingChunkMap.get(item.id) ?? [], in_transit_qty: inTransitMap[normalizePartNo(item.part_no)] ?? 0 }));

  const { data: events, error: eventError } = await supabase
    .from('portal_order_events')
    .select('id, event_type, old_status, new_status, notes, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (eventError) throw eventError;

  const { data: comments, error: commentError } = await supabase
    .from('portal_order_comments')
    .select('id, comment_type, body, attachment_path, created_at, author:portal_profiles!portal_order_comments_author_id_fkey(full_name, role)')
    .eq('order_id', orderId)
    .eq('comment_type', 'user')
    .order('created_at', { ascending: false })
    .limit(20);
  if (commentError) throw commentError;

  const rawComments = (comments ?? []) as unknown as RawComment[];
  const attachmentMap = await getCommentAttachments(orderId, rawComments);
  const commentsWithAttachments = rawComments.map((comment) => normalizeComment(comment, attachmentMap.get(comment.id) ?? []));

  return { order: { ...normalizeOrderView(rawOrder), employee }, items: itemsWithChunks, events: (events ?? []) as TestOrderEvent[], comments: commentsWithAttachments };
}
