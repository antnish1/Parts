import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const fail = (message: string, code = 'PART_LOOKUP_FAILED') => json({ ok: false, error: message, code });
const PAGE_SIZE = 1000;

const PART_COLUMNS = ['part_no', 'partno', 'part number', 'part_number', 'item_code', 'itemcode', 'material', 'material no', 'material_no', 'material number', 'materialnumber', 'Material', 'Material No', 'Material No.'];
const DESCRIPTION_COLUMNS = ['description', 'part_description', 'material_description', 'item_name', 'itemname', 'name', 'Description', 'Material Description'];
const DNP_COLUMNS = ['dnp', 'DNP', 'new rtl', 'new_rtl', 'rtl', 'RTL', 'price', 'sale_price', 'rate'];
const CAT1_COLUMNS = ['cat1', 'cat_1', 'category', 'category1', 'item_group', 'group', 'Cat1'];
const CAT2_COLUMNS = ['cat2', 'cat_2', 'category2', 'sub_category', 'subgroup', 'Cat2'];

type RawRow = Record<string, unknown>;
type Part = { part_no: string; description: string | null; dnp: number | null; cat1: string | null; cat2: string | null };

const clean = (value: unknown) => String(value ?? '').trim();
const normalizePartNo = (value: unknown) => clean(value).replace(/\s+/g, '').toUpperCase();

function normalizeKey(value: string) {
  return value.trim().replace(/[\s_./-]+/g, '').toLowerCase();
}

function readValue(row: RawRow, aliases: string[]) {
  const wanted = aliases.map(normalizeKey);
  const key = Object.keys(row).find((item) => wanted.includes(normalizeKey(item)));
  return key ? row[key] : null;
}

function readText(row: RawRow, aliases: string[]) {
  const value = readValue(row, aliases);
  return value == null ? '' : String(value).trim();
}

function readNumber(row: RawRow, aliases: string[]) {
  const value = readValue(row, aliases);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function mapPartMasterRow(row: RawRow): Part | null {
  const partNo = normalizePartNo(readText(row, PART_COLUMNS));
  if (!partNo) return null;

  return {
    part_no: partNo,
    description: readText(row, DESCRIPTION_COLUMNS) || null,
    dnp: readNumber(row, DNP_COLUMNS),
    cat1: readText(row, CAT1_COLUMNS) || null,
    cat2: readText(row, CAT2_COLUMNS) || null,
  };
}

function errorMessage(error: unknown) {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? '');
  return String(error);
}

async function loadByKnownColumns(adminClient: ReturnType<typeof createClient>, targets: string[]) {
  const found = new Map<string, Part>();

  for (const column of PART_COLUMNS) {
    const remaining = targets.filter((partNo) => !found.has(partNo));
    if (!remaining.length) break;

    const { data, error } = await adminClient
      .from('part_master')
      .select('*')
      .in(column, remaining)
      .limit(Math.max(remaining.length, 1));

    if (error) continue;

    ((data ?? []) as RawRow[]).forEach((row) => {
      const mapped = mapPartMasterRow(row);
      if (mapped && remaining.includes(mapped.part_no)) found.set(mapped.part_no, mapped);
    });
  }

  return found;
}

async function scanRemaining(adminClient: ReturnType<typeof createClient>, targets: string[], found: Map<string, Part>) {
  if (targets.every((partNo) => found.has(partNo))) return found;

  for (let start = 0; ; start += PAGE_SIZE) {
    const remaining = targets.filter((partNo) => !found.has(partNo));
    if (!remaining.length) break;

    const { data, error } = await adminClient
      .from('part_master')
      .select('*')
      .range(start, start + PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as RawRow[];
    page.forEach((row) => {
      const mapped = mapPartMasterRow(row);
      if (mapped && remaining.includes(mapped.part_no)) found.set(mapped.part_no, mapped);
    });

    if (page.length < PAGE_SIZE) break;
  }

  return found;
}

async function lookupParts(adminClient: ReturnType<typeof createClient>, partNos: string[]) {
  const targets = [...new Set(partNos.map(normalizePartNo).filter(Boolean))];
  if (!targets.length) return [];

  const directFound = await loadByKnownColumns(adminClient, targets);
  const allFound = await scanRemaining(adminClient, targets, directFound);
  return targets.map((partNo) => allFound.get(partNo)).filter(Boolean) as Part[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return fail('Unauthorized. Please logout and login again.', 'UNAUTHORIZED');

    const body = await req.json().catch(() => ({}));
    const bodyPartNos = Array.isArray(body.partNos) ? body.partNos : [];
    const partNos = bodyPartNos.length ? bodyPartNos : [body.partNo];
    const parts = await lookupParts(adminClient, partNos);

    return json({
      ok: true,
      part: bodyPartNos.length ? null : parts[0] ?? null,
      parts,
    });
  } catch (error) {
    return fail(errorMessage(error) || 'Part lookup failed.', 'PART_LOOKUP_FAILED');
  }
});
