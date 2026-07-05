import { supabase } from '../lib/supabase';

export type TestMachine = {
  id: string;
  machine_no: string;
  customer_name: string;
};

type RawRow = Record<string, unknown>;
const MACHINE_COLUMNS = ['machine_no', 'machine_number', 'machine', 'machine no', 'machine no.', 'machine number', 'Machine No', 'Machine No.', 'Machine Number', 'MACHINE_NO'];
const CUSTOMER_COLUMNS = ['customer_name', 'customername', 'customer', 'customer name', 'Customer Name', 'Customer', 'party_name', 'partyname', 'name'];

export function normalizeMachineNo(machineNo: string) {
  return machineNo.trim().replace(/\s+/g, '').toUpperCase();
}

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

function mapMachine(row: RawRow): TestMachine | null {
  const machineNo = normalizeMachineNo(readText(row, MACHINE_COLUMNS));
  const customerName = readText(row, CUSTOMER_COLUMNS);
  if (!machineNo) return null;

  return {
    id: String(row.id ?? machineNo),
    machine_no: machineNo,
    customer_name: customerName || '',
  };
}

async function findInMachineMaster(normalized: string) {
  for (const column of MACHINE_COLUMNS) {
    const { data, error } = await supabase
      .from('machine_master')
      .select('*')
      .eq(column, normalized)
      .limit(1);

    if (error) continue;
    const mapped = ((data ?? []) as RawRow[]).map(mapMachine).find(Boolean);
    if (mapped) return mapped;
  }

  const { data, error } = await supabase.from('machine_master').select('*').limit(2500);
  if (error) {
    console.warn('Failed to search machine_master', error.message);
    return null;
  }

  return ((data ?? []) as RawRow[]).map(mapMachine).find((row) => row?.machine_no === normalized) ?? null;
}

export async function getTestMachineByNo(machineNo: string): Promise<TestMachine | null> {
  const normalized = normalizeMachineNo(machineNo);
  if (!normalized) return null;
  return findInMachineMaster(normalized);
}

export async function saveTestMachineCustomer(machineNo: string, customerName: string) {
  const normalized = normalizeMachineNo(machineNo);
  const customer = customerName.trim();
  if (!normalized || !customer) throw new Error('Machine number and customer name are required.');

  const { data, error } = await supabase.functions.invoke('save-machine-master', {
    body: { machineNo: normalized, customerName: customer },
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return { machine_no: normalized, customer_name: customer };
}
