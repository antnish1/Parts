import { supabase } from '../lib/supabase';

export type PartLocation = {
  id: string;
  part_no: string;
  location: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type ActionResponse<T> = {
  ok?: boolean;
  error?: string;
} & T;

function normalizePartNo(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

async function invokePartLocationAction<T>(body: Record<string, unknown>): Promise<ActionResponse<T>> {
  const { data, error } = await supabase.functions.invoke('part-location-action', { body });
  if (error) {
    const maybeResponse = error as { context?: Response; message?: string };
    if (maybeResponse.context) {
      try {
        const payload = await maybeResponse.context.clone().json();
        throw new Error(String(payload?.error || maybeResponse.message || 'Part location action failed.'));
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message !== 'Unexpected end of JSON input') throw parseError;
      }
    }
    throw new Error(maybeResponse.message || 'Part location action failed.');
  }
  if (data?.ok === false || data?.error) throw new Error(String(data.error || 'Part location action failed.'));
  return data as ActionResponse<T>;
}

export async function findPartLocations(partNo: string): Promise<PartLocation[]> {
  const normalized = normalizePartNo(partNo);
  if (!normalized) return [];
  const data = await invokePartLocationAction<{ locations: PartLocation[] }>({ action: 'lookup', partNo: normalized });
  return data.locations ?? [];
}

export async function getKnownPartLocations(query: string): Promise<string[]> {
  const term = query.trim();
  if (!term) return [];
  const data = await invokePartLocationAction<{ locations: string[] }>({ action: 'suggest', query: term });
  return data.locations ?? [];
}

export async function addPartLocation(partNo: string, location: string): Promise<PartLocation> {
  const data = await invokePartLocationAction<{ location: PartLocation }>({ action: 'add', partNo, location });
  return data.location;
}

export async function deactivatePartLocation(id: string): Promise<void> {
  await invokePartLocationAction<{ location: PartLocation }>({ action: 'deactivate', id });
}
