import { supabase } from '../lib/supabase';

function sanitizeSearchTerm(value: string) {
  return value.trim().replace(/[,%()]/g, ' ').replace(/\s+/g, ' ');
}

export async function searchOrderIdsByItem(searchTerm: string): Promise<string[]> {
  const term = sanitizeSearchTerm(searchTerm);
  if (term.length < 2) return [];

  const compactPart = term.replace(/\s+/g, '').toUpperCase();
  const filters = [
    `part_no.ilike.%${term}%`,
    `description.ilike.%${term}%`,
  ];

  if (compactPart && compactPart !== term) filters.push(`part_no.ilike.%${compactPart}%`);

  const { data, error } = await supabase
    .from('portal_order_items')
    .select('order_id')
    .or(filters.join(','))
    .limit(5000);

  if (error) throw error;
  return [...new Set((data ?? []).map((row) => String(row.order_id || '')).filter(Boolean))];
}
