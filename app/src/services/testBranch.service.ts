import { supabase } from '../lib/supabase';

export type TestBranch = {
  id: string;
  branch_name: string;
  branch_code: string;
};

export async function getTestBranches(): Promise<TestBranch[]> {
  const { data, error } = await supabase
    .from('branch_mapping')
    .select('id, branch_name, branch_code')
    .eq('is_active', true)
    .order('branch_name', { ascending: true });

  if (error) {
    console.error('Failed to load portal branches', error);
    return [];
  }

  return data ?? [];
}
