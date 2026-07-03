import { supabase } from '../lib/supabase';

export type DeveloperCommentInboxRow = {
  id: string;
  order_id: string;
  comment: string;
  created_at: string;
  created_by: string | null;
  order_no: string;
  final_order_no: string | null;
  branch: string;
  status: string;
};

export async function getDeveloperCommentsInbox() {
  const { data, error } = await supabase
    .from('test_order_comments')
    .select('id, order_id, comment, created_at, created_by, test_orders(order_no, final_order_no, branch, status)')
    .order('created_at', { ascending: false })
    .limit(25);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const order = Array.isArray(row.test_orders) ? row.test_orders[0] : row.test_orders;
    return {
      id: row.id,
      order_id: row.order_id,
      comment: row.comment,
      created_at: row.created_at,
      created_by: row.created_by,
      order_no: order?.order_no ?? '-',
      final_order_no: order?.final_order_no ?? null,
      branch: order?.branch ?? '-',
      status: order?.status ?? '-',
    };
  }) as DeveloperCommentInboxRow[];
}
