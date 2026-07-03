import { supabase } from '../lib/supabase';

export type TestMachine = {
  id: string;
  machine_no: string;
  customer_name: string;
};

export function normalizeMachineNo(machineNo: string) {
  return machineNo.trim().replace(/\s+/g, '').toUpperCase();
}

export async function getTestMachineByNo(machineNo: string): Promise<TestMachine | null> {
  const normalized = normalizeMachineNo(machineNo);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from('test_machine_master')
    .select('id, machine_no, customer_name')
    .eq('machine_no', normalized)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function saveTestMachineCustomer(machineNo: string, customerName: string) {
  const normalized = normalizeMachineNo(machineNo);
  const customer = customerName.trim();
  if (!normalized || !customer) throw new Error('Machine number and customer name are required.');

  const { error } = await supabase
    .from('test_machine_master')
    .insert({ machine_no: normalized, customer_name: customer });

  if (error) throw error;
  return { machine_no: normalized, customer_name: customer };
}
