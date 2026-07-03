import { supabase } from '../lib/supabase';
import { currentBranchScopeIncludes } from './branchScope.service';

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
  order_reg_date: string | null;
  dbms_invoice_no: string | null;
  dbms_invoice_date: string | null;
  docket_no: string | null;
  transport_name: string | null;
  received_date: string | null;
  row_status: string | null;
};

export type TestOrderEvent = { id: string; event_type: string; old_status: string | null; new_status: string | null; notes: string | null; created_at: string; };
export type TestOrderCommentAttachment = { id: string; comment_id: string; original_file_name: string; mime_type: string; file_size_bytes: number; created_at: string; };
export type TestOrderComment = { id: string; comment_type: string; body: string | null; attachment_path: string | null; created_at: string; attachments: TestOrderCommentAttachment[]; };

type RawOrderView = Omit<TestOrderView, 'approver'> & { approver?: { full_name: string | null; role: string | null } | Array<{ full_name: string | null; role: string | null }> | null; };
function normalizeOrderView(order: RawOrderView): TestOrderView { const approver = Array.isArray(order.approver) ? order.approver[0] ?? null : order.approver ?? null; return { ...order, approver }; }
function normalizeCommentText(value: string) { return value.trim().replace(/\s+/g, ' '); }

export async function addTestOrderComment(orderId: string, body: string) {
  const text = normalizeCommentText(body);
  if (!orderId || !text) throw new Error('Comment is required.');

  const { data: recent, error: recentError } = await supabase
    .from('test_order_comments')
    .select('id, body, created_at')
    .eq('order_id', orderId)
    .eq('comment_type', 'user')
    .order('created_at', { ascending: false })
    .limit(5);
  if (recentError) throw recentError;
  const duplicate = (recent ?? []).some((comment) => normalizeCommentText(comment.body ?? '').toLowerCase() === text.toLowerCase());
  if (duplicate) throw new Error('Duplicate comment already exists for this order.');

  const { error } = await supabase.from('test_order_comments').insert({ order_id: orderId, comment_type: 'user', body: text });
  if (error) throw error;
}

async function getCommentAttachments(orderId: string, comments: Array<{ id: string }>) {
  if (!comments.length) return new Map<string, TestOrderCommentAttachment[]>();
  const map = new Map<string, TestOrderCommentAttachment[]>();
  const commentIds = comments.map((comment) => comment.id);
  const { data, error } = await supabase
    .from('test_order_comment_attachments')
    .select('id, comment_id, original_file_name, mime_type, file_size_bytes, created_at')
    .eq('order_id', orderId)
    .in('comment_id', commentIds)
    .is('deleted_at', null)
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

export async function getTestOrderView(orderId: string) {
  const { data: order, error: orderError } = await supabase
    .from('test_orders')
    .select('id, order_no, branch, order_type, order_for, machine_no, customer_name, call_id, warranty_status, status, approval_status, processing_reference, processed_notes, processed_date, final_order_no, order_reg_date, dbms_invoice_no, dbms_invoice_date, received_date, docket_no, transport_name, created_at, approver:test_profiles!test_orders_approver_id_fkey(full_name, role)')
    .eq('id', orderId)
    .single();
  if (orderError) throw orderError;
  if (!(await currentBranchScopeIncludes((order as RawOrderView).branch))) throw new Error('This order belongs to another branch.');

  const { data: items, error: itemError } = await supabase
    .from('test_order_items')
    .select('id, part_no, description, dnp, qty, edited_qty, billed_qty, value, edited_value, previous_30d_qty, order_reg_date, dbms_invoice_no, dbms_invoice_date, docket_no, transport_name, received_date, row_status')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  if (itemError) throw itemError;

  const { data: events, error: eventError } = await supabase
    .from('test_order_events')
    .select('id, event_type, old_status, new_status, notes, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (eventError) throw eventError;

  const { data: comments, error: commentError } = await supabase
    .from('test_order_comments')
    .select('id, comment_type, body, attachment_path, created_at')
    .eq('order_id', orderId)
    .eq('comment_type', 'user')
    .order('created_at', { ascending: false })
    .limit(20);
  if (commentError) throw commentError;

  const rawComments = comments ?? [];
  const attachmentMap = await getCommentAttachments(orderId, rawComments);
  const commentsWithAttachments = rawComments.map((comment) => ({
    ...comment,
    attachments: attachmentMap.get(comment.id) ?? [],
  })) as TestOrderComment[];

  return { order: normalizeOrderView(order as unknown as RawOrderView), items: (items ?? []) as TestOrderViewItem[], events: (events ?? []) as TestOrderEvent[], comments: commentsWithAttachments };
}
