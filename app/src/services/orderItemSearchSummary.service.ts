import { supabase } from '../lib/supabase';

export type OrderItemSearchSummary = {
  orderId: string;
  qty: number;
  value: number;
};

function sanitizeSearchTerm(value: string) {
  return value.trim().replace(/[,%()]/g, ' ').replace(/\s+/g, ' ');
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function searchOrderItemSummaries(searchTerm: string): Promise<Record<string, OrderItemSearchSummary>> {
  const term = sanitizeSearchTerm(searchTerm);
  if (term.length < 2) return {};

  const compactPart = term.replace(/\s+/g, '').toUpperCase();
  const filters = [`part_no.ilike.%${term}%`, `description.ilike.%${term}%`];
  if (compactPart && compactPart !== term) filters.push(`part_no.ilike.%${compactPart}%`);

  const { data, error } = await supabase
    .from('portal_order_items')
    .select('order_id, qty, edited_qty, dnp, value, edited_value')
    .or(filters.join(','))
    .limit(5000);

  if (error) throw error;

  return (data ?? []).reduce<Record<string, OrderItemSearchSummary>>((acc, row) => {
    const orderId = String(row.order_id || '');
    if (!orderId) return acc;
    const qty = toNumber(row.edited_qty ?? row.qty);
    const value = toNumber(row.edited_value ?? row.value ?? (toNumber(row.dnp) * qty));
    const current = acc[orderId] ?? { orderId, qty: 0, value: 0 };
    current.qty += qty;
    current.value += value;
    acc[orderId] = current;
    return acc;
  }, {});
}
