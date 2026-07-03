import { supabase } from '../lib/supabase';

export type TestProcessingInfo = {
  processing_reference: string | null;
  processed_notes: string | null;
  processed_date: string | null;
};

export async function getTestProcessingInfo(orderId: string): Promise<TestProcessingInfo | null> {
  if (!orderId) return null;

  const { data, error } = await supabase
    .from('test_orders')
    .select('processing_reference, processed_notes, processed_date')
    .eq('id', orderId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}
