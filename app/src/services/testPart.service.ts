import { supabase } from '../lib/supabase';

export type TestPart = {
  part_no: string;
  description: string | null;
  dnp: number | null;
  cat1: string | null;
  cat2: string | null;
};

export async function getTestParts(): Promise<TestPart[]> {
  const { data, error } = await supabase
    .from('test_part_master')
    .select('part_no, description, dnp, cat1, cat2')
    .eq('is_active', true)
    .order('part_no', { ascending: true })
    .limit(100);

  if (error) {
    console.error('Failed to load test parts', error);
    return [];
  }

  return data ?? [];
}
