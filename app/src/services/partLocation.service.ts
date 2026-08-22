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

async function readFunctionError(error: unknown) {
  const maybeError = error as { context?: unknown; message?: string };
  const context = maybeError?.context;

  if (context && typeof context === 'object') {
    const json = (context as { json?: unknown }).json;
    if (typeof json === 'function') {
      try {
        const payload = await (json as () => Promise<{ error?: unknown }>)();
        if (payload?.error) return String(payload.error);
      } catch {
        // The response body may already be consumed or may not be JSON.
      }
    }
  }

  return maybeError?.message || 'Part location action failed.';
}

async function invokePartLocationAction<T>(body: Record<string, unknown>): Promise<ActionResponse<T>> {
  const { data, error } = await supabase.functions.invoke('part-location-action', { body });
  if (error) throw new Error(await readFunctionError(error));
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
