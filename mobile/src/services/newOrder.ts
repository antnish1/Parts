import { supabase } from '@/lib/supabase';

export type Approver = { id: string; full_name: string; branch: string; role: string };
export type PartLookup = { part_no: string; description: string | null; dnp: number | null; cat1: string | null; cat2: string | null };
export type NewOrderItem = { partNo: string; description: string; dnp: number; qty: number; previous30dQty?: number };
export type NewOrderInput = {
  branch: string;
  orderType: string;
  orderFor: string;
  approverId: string;
  machineNo?: string;
  customerName?: string;
  callId?: string;
  warrantyStatus?: string;
  items: NewOrderItem[];
};

export function normalizePartNo(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, '').toUpperCase();
}

export function normalizeMachineNo(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, '').toUpperCase();
}

export async function getApprovers(): Promise<Approver[]> {
  const { data, error } = await supabase
    .from('portal_profiles')
    .select('id, full_name, branch, role')
    .in('role', ['super', 'manager'])
    .eq('is_active', true)
    .order('role', { ascending: false })
    .order('full_name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Approver[];
}

export async function lookupPart(partNo: string): Promise<PartLookup | null> {
  const normalized = normalizePartNo(partNo);
  if (!normalized) return null;
  const { data, error } = await supabase.functions.invoke('lookup-part-action', { body: { partNo: normalized } });
  if (error) throw error;
  if (data?.error || data?.ok === false) throw new Error(String(data?.error || 'Part lookup failed.'));
  const row = data?.part as Partial<PartLookup> | null | undefined;
  if (!row?.part_no) return null;
  return {
    part_no: normalizePartNo(row.part_no),
    description: row.description ?? null,
    dnp: row.dnp == null || Number.isNaN(Number(row.dnp)) ? null : Number(row.dnp),
    cat1: row.cat1 ?? null,
    cat2: row.cat2 ?? null,
  };
}

export async function lookupMachine(machineNo: string): Promise<{ machine_no: string; customer_name: string } | null> {
  const normalized = normalizeMachineNo(machineNo);
  if (!normalized) return null;
  const aliases = ['machine_no', 'machine_number', 'machine', 'Machine No', 'Machine No.', 'Machine Number', 'MACHINE_NO'];
  const customerAliases = ['customer_name', 'customername', 'customer', 'Customer Name', 'Customer', 'party_name', 'name'];
  for (const column of aliases) {
    const { data, error } = await supabase.from('machine_master').select('*').eq(column, normalized).limit(1);
    if (error || !data?.length) continue;
    const raw = data[0] as Record<string, unknown>;
    const machineKey = Object.keys(raw).find((key) => aliases.some((alias) => alias.toLowerCase().replace(/[^a-z0-9]/g, '') === key.toLowerCase().replace(/[^a-z0-9]/g, '')));
    const customerKey = Object.keys(raw).find((key) => customerAliases.some((alias) => alias.toLowerCase().replace(/[^a-z0-9]/g, '') === key.toLowerCase().replace(/[^a-z0-9]/g, '')));
    return { machine_no: normalizeMachineNo(String(machineKey ? raw[machineKey] ?? normalized : normalized)), customer_name: String(customerKey ? raw[customerKey] ?? '' : '').trim() };
  }
  return null;
}

export async function getInTransitQty(branch: string, partNo: string) {
  const normalized = normalizePartNo(partNo);
  if (!branch.trim() || !normalized) return 0;
  const { data, error } = await supabase.rpc('portal_get_in_transit_qty', { p_branch: branch, p_part_nos: [normalized] });
  if (error) throw error;
  const row = (data ?? []).find((item: { part_no?: string | null }) => normalizePartNo(item.part_no) === normalized) as { in_transit_qty?: number | string | null } | undefined;
  const qty = Number(row?.in_transit_qty ?? 0);
  return Number.isFinite(qty) ? Math.max(0, qty) : 0;
}

export async function createOrder(input: NewOrderInput): Promise<{ id: string; order_no: string; warning?: string | null }> {
  const { data, error } = await supabase.functions.invoke('create-order-action', { body: input });
  if (error) throw error;
  if (data?.error || data?.ok === false) throw new Error(String(data?.error || 'Order creation failed.'));
  if (!data?.id || !data?.order_no) throw new Error('Order creation response was incomplete.');
  return { id: String(data.id), order_no: String(data.order_no), warning: data.machine_master_warning ?? null };
}
