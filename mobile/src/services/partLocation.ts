import { supabase } from '@/lib/supabase';
import { lookupPart, normalizePartNo, type PartLookup } from '@/services/newOrder';

export type PartLocation = { id: string; part_no: string; location: string; created_at?: string | null; updated_at?: string | null };
type ActionResponse<T> = { ok?: boolean; error?: string } & T;

async function invoke<T>(body: Record<string, unknown>): Promise<ActionResponse<T>> {
  const { data, error } = await supabase.functions.invoke('part-location-action', { body });
  if (error) throw new Error(error.message || 'Part location action failed.');
  if (data?.ok === false || data?.error) throw new Error(String(data?.error || 'Part location action failed.'));
  return data as ActionResponse<T>;
}
export async function getPartLocationResult(partNo: string): Promise<{ part: PartLookup | null; locations: PartLocation[] }> {
  const normalized = normalizePartNo(partNo);
  if (!normalized) return { part: null, locations: [] };
  const [part, payload] = await Promise.all([lookupPart(normalized), invoke<{ locations: PartLocation[] }>({ action: 'lookup', partNo: normalized })]);
  return { part, locations: payload.locations ?? [] };
}
export async function getKnownPartLocations(query: string) {
  const term = query.trim(); if (!term) return [] as string[];
  const data = await invoke<{ locations: string[] }>({ action: 'suggest', query: term });
  return data.locations ?? [];
}
export async function addPartLocation(partNo: string, location: string) {
  const normalized = normalizePartNo(partNo); const clean = location.trim();
  if (!normalized || !clean) throw new Error('Part number and location are required.');
  const data = await invoke<{ location: PartLocation }>({ action: 'add', partNo: normalized, location: clean });
  return data.location;
}
export async function deactivatePartLocation(id: string) {
  await invoke<{ location: PartLocation }>({ action: 'deactivate', id });
}
