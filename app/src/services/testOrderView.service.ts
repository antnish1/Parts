import { supabase } from '../lib/supabase';

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
};

export type TestOrderEvent = {
  id: string;
  event_type: string;
  old_status: string | null;
  new_status: string | null;
  notes: string | null;
  created_at: string;
};

export type TestOrderComment = {
  id: string;
  comment_type: string;
  body: string | null;
  attachment_path: string | null;
  created_at: string;
};

type RawOrderView = Omit<TestOrderView, 'approver'> & {
  approver?: { full_name: string | null; role: string | null } | Array<{ full_name: string | null; role: string | null }> | null;
};

function normalizeOrderView(order: RawOrderView): TestOrderView {
  const approver = Array.isArray(order.approver) ? order.approver[0] ?? null : order.approver ?? null;
  return { ...order, approver };
}

export async function addTestOrderComment(orderId: string, body: string) {
  const text = body.trim();
  if (!orderId || !text) throw new Error('Comment is required.');

  const { error } = await supabase.from('test_order_comments').insert({
    order_id: orderId,
    comment_type: 'user',
    body: text,
  });

  if (error) throw error;
}

export async function getTestOrderView(orderId: string) {
  const { data: order, error: orderError } = await supabase
    .from('test_orders')
    .select('id, order_no, branch, order_type, order_for, machine_no, customer_name, call_id, warranty_status, status, approval_status, created_at, approver:test_profiles!test_orders_approver_id_fkey(full_name, role)')
    .eq('id', orderId)
    .single();
  if (orderError) throw orderError;

  const { data: items, error: itemError } = await supabase
    .from('test_order_items')
    .select('id, part_no, description, dnp, qty, edited_qty, billed_qty, value, edited_value, previous_30d_qty')
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
    .order('created_at', { ascending: false })
    .limit(20);
  if (commentError) throw commentError;

  return {
    order: normalizeOrderView(order as unknown as RawOrderView),
    items: (items ?? []) as TestOrderViewItem[],
    events: (events ?? []) as TestOrderEvent[],
    comments: (comments ?? []) as TestOrderComment[],
  };
}
