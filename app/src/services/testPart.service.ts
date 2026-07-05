import { supabase } from '../lib/supabase';

export type TestPart = {
  part_no: string;
  description: string | null;
  dnp: number | null;
  cat1: string | null;
  cat2: string | null;
};

function normalizePartNo(value: string | null | undefined) {
  return (value || '').trim().replace(/\s+/g, '').toUpperCase();
}

function normalizePartResponse(part: unknown): TestPart | null {
  if (!part || typeof part !== 'object') return null;
  const row = part as Partial<TestPart>;
  const partNo = normalizePartNo(row.part_no);
  if (!partNo) return null;

  return {
    part_no: partNo,
    description: row.description ?? null,
    dnp: row.dnp == null || Number.isNaN(Number(row.dnp)) ? null : Number(row.dnp),
    cat1: row.cat1 ?? null,
    cat2: row.cat2 ?? null,
  };
}

function friendlyPartError(message: string) {
  const text = message.toLowerCase();
  if (text.includes('failed to fetch') || text.includes('send a request')) {
    return 'Could not connect to lookup-part-action. Please deploy the Edge Function and try again.';
  }
  if (text.includes('non-2xx')) {
    return 'Part lookup was rejected by lookup-part-action. Please redeploy lookup-part-action and try again.';
  }
  return message || 'Part lookup failed.';
}

async function readFunctionError(error: unknown) {
  const maybeError = error as { message?: string; context?: Response };
  if (maybeError?.context) {
    try {
      const body = await maybeError.context.clone().json();
      if (body?.error) return friendlyPartError(String(body.error));
    } catch {
      // Ignore body parse error and use fallback message.
    }
  }
  return friendlyPartError(maybeError?.message ?? 'Part lookup failed.');
}

export async function lookupTestPartByNo(partNo: string): Promise<TestPart | null> {
  const normalized = normalizePartNo(partNo);
  if (!normalized) return null;

  const { data, error } = await supabase.functions.invoke('lookup-part-action', {
    body: { partNo: normalized },
  });

  if (error) throw new Error(await readFunctionError(error));
  if (data?.ok === false || data?.error) throw new Error(friendlyPartError(String(data.error || 'Part lookup failed.')));
  return normalizePartResponse(data?.part);
}

export async function lookupTestPartsByNos(partNos: string[]): Promise<TestPart[]> {
  const normalized = [...new Set(partNos.map(normalizePartNo).filter(Boolean))];
  if (!normalized.length) return [];

  const { data, error } = await supabase.functions.invoke('lookup-part-action', {
    body: { partNos: normalized },
  });

  if (error) throw new Error(await readFunctionError(error));
  if (data?.ok === false || data?.error) throw new Error(friendlyPartError(String(data.error || 'Part lookup failed.')));
  return ((data?.parts ?? []) as unknown[]).map(normalizePartResponse).filter(Boolean) as TestPart[];
}

export async function getTestParts(): Promise<TestPart[]> {
  // Deprecated: New Order no longer downloads the full production part_master to the browser.
  // Use lookupTestPartByNo() or lookupTestPartsByNos() so part_master is searched on the backend only when needed.
  return [];
}
