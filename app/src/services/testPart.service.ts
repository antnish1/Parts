import { supabase } from '../lib/supabase';

export type TestPart = {
  part_no: string;
  description: string | null;
  dnp: number | null;
  cat1: string | null;
  cat2: string | null;
};

const PAGE_SIZE = 1000;

export async function getTestParts(): Promise<TestPart[]> {
  const rows: TestPart[] = [];

  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('test_part_master')
      .select('part_no, description, dnp, cat1, cat2')
      .eq('is_active', true)
      .order('part_no', { ascending: true })
      .range(start, start + PAGE_SIZE - 1);

    if (error) {
      console.error('Failed to load test parts', error);
      return rows;
    }

    const page = (data ?? []) as TestPart[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}
