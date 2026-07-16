import { supabase } from '../lib/supabase';

export type SalesEmployee = {
  id: string;
  name: string;
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

export async function searchSalesEmployees(term: string): Promise<SalesEmployee[]> {
  const query = normalizeName(term);
  if (query.length < 2) return [];

  const { data, error } = await supabase
    .from('portal_sales_employees')
    .select('id,name')
    .eq('is_active', true)
    .ilike('name', `%${query}%`)
    .order('name', { ascending: true })
    .limit(12);

  if (error) throw error;
  return (data ?? []) as SalesEmployee[];
}

export async function ensureSalesEmployeeName(value: string): Promise<string> {
  const name = normalizeName(value);
  if (!name) throw new Error('Sales employee name is required.');

  const { data: sessionData } = await supabase.auth.getSession();
  const { error } = await supabase
    .from('portal_sales_employees')
    .upsert(
      {
        name,
        is_active: true,
        created_by: sessionData.session?.user.id ?? null,
      },
      { onConflict: 'name', ignoreDuplicates: true },
    );

  if (error) throw error;
  return name;
}
