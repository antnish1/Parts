import { supabase } from '../lib/supabase';

export type TestPart = {
  part_no: string;
  description: string | null;
  dnp: number | null;
  cat1: string | null;
  cat2: string | null;
};

const PAGE_SIZE = 1000;
type RawRow = Record<string, unknown>;

function normalizeKey(value: string) {
  return value.trim().replace(/[\s_./-]+/g, '').toLowerCase();
}

function normalizePartNo(value: string | null | undefined) {
  return (value || '').trim().replace(/\s+/g, '').toUpperCase();
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

function mapPartMasterRow(row: RawRow): TestPart | null {
  const partNo = normalizePartNo(readText(row, ['part_no', 'partno', 'part number', 'part_number', 'item_code', 'itemcode', 'material', 'material no', 'material_no', 'material number', 'materialnumber', 'Material', 'Material No', 'Material No.']));
  if (!partNo) return null;

  return {
    part_no: partNo,
    description: readText(row, ['description', 'part_description', 'material_description', 'item_name', 'itemname', 'name', 'Description', 'Material Description']) || null,
    dnp: readNumber(row, ['dnp', 'DNP', 'new rtl', 'new_rtl', 'rtl', 'RTL', 'price', 'sale_price', 'rate']),
    cat1: readText(row, ['cat1', 'cat_1', 'category', 'category1', 'item_group', 'group', 'Cat1']) || null,
    cat2: readText(row, ['cat2', 'cat_2', 'category2', 'sub_category', 'subgroup', 'Cat2']) || null,
  };
}

async function getPartMasterRows() {
  const rows: RawRow[] = [];

  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('part_master')
      .select('*')
      .range(start, start + PAGE_SIZE - 1);

    if (error) {
      console.warn('Failed to load part_master', error.message);
      return rows;
    }

    const page = (data ?? []) as RawRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

export async function getTestParts(): Promise<TestPart[]> {
  const merged = new Map<string, TestPart>();
  const liveRows = await getPartMasterRows();

  liveRows.forEach((row) => {
    const mapped = mapPartMasterRow(row);
    if (mapped) merged.set(mapped.part_no, mapped);
  });

  return [...merged.values()].sort((a, b) => a.part_no.localeCompare(b.part_no));
}
