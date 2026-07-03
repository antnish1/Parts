import { supabase } from '../lib/supabase';

export type TestProfileOption = {
  id: string;
  full_name: string;
  branch: string;
  role: string;
};

export async function getTestApprovers(): Promise<TestProfileOption[]> {
  const { data, error } = await supabase
    .from('test_profiles')
    .select('id, full_name, branch, role')
    .in('role', ['super', 'manager'])
    .eq('is_active', true)
    .order('role', { ascending: false })
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Failed to load test approvers', error);
    return [];
  }

  return data ?? [];
}
