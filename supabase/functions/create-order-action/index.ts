import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const fail = (message: string, code = 'ORDER_CREATE_VALIDATION') => json({ ok: false, error: message, code });
const clean = (value: unknown) => String(value ?? '').trim();
const normalizePart = (value: unknown) => clean(value).replace(/\s+/g, '').toUpperCase();
const normalizeMachine = (value: unknown) => clean(value).replace(/\s+/g, '').toUpperCase();
const normalizeBranchKey = (value: unknown) => clean(value).replace(/[\s_-]+/g, '').toUpperCase();

const MACHINE_COLUMN_CANDIDATES = ['machine_no', 'machine_number', 'machine', 'machine no', 'machine no.', 'machine number', 'Machine No', 'Machine No.', 'Machine Number', 'MACHINE_NO'];
const CUSTOMER_COLUMN_CANDIDATES = ['customer_name', 'customername', 'customer', 'customer name', 'Customer Name', 'Customer', 'party_name', 'partyname', 'name'];
const INSERT_MACHINE_COLUMNS = ['machine_no', 'machine_number', 'Machine No', 'Machine No.', 'Machine Number'];
const INSERT_CUSTOMER_COLUMNS = ['customer_name', 'customername', 'customer', 'Customer Name', 'party_name', 'name'];

type BranchMapping = { branch_name: string; branch_code: string };
type MachineMasterSaveResult = { saved: boolean; warning?: string };

function findBranchMapping(branches: BranchMapping[], value: string) {
  const key = normalizeBranchKey(value);
  return branches.find((branch) => normalizeBranchKey(branch.branch_name) === key || normalizeBranchKey(branch.branch_code) === key) ?? null;
}

function errorMessage(error: unknown) {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? '');
  return String(error);
}

function uniqueInsertPayloads(machineNo: string, customerName: string) {
  const seen = new Set<string>();
  const payloads: Record<string, string>[] = [];

  for (const machineColumn of INSERT_MACHINE_COLUMNS) {
    for (const customerColumn of INSERT_CUSTOMER_COLUMNS) {
      const payload = { [machineColumn]: machineNo, [customerColumn]: customerName };
      const key = JSON.stringify(payload);
      if (!seen.has(key)) {
        seen.add(key);
        payloads.push(payload);
      }
    }
  }

  return payloads;
}

async function machineExists(adminClient: ReturnType<typeof createClient>, machineNo: string) {
  for (const column of MACHINE_COLUMN_CANDIDATES) {
    const { data, error } = await adminClient
      .from('machine_master')
      .select(column)
      .eq(column, machineNo)
      .limit(1);

    if (!error && data?.length) return true;
  }

  return false;
}

async function saveMissingMachine(adminClient: ReturnType<typeof createClient>, machineNo: string, customerName: string): Promise<MachineMasterSaveResult> {
  if (!machineNo || !customerName) return { saved: false };

  try {
    if (await machineExists(adminClient, machineNo)) return { saved: false };
  } catch (error) {
    console.warn('machine_master lookup skipped before order creation:', errorMessage(error));
  }

  const insertErrors: string[] = [];
  for (const payload of uniqueInsertPayloads(machineNo, customerName)) {
    const { error } = await adminClient.from('machine_master').insert(payload);
    if (!error) return { saved: true };

    const message = errorMessage(error);
    if (message) insertErrors.push(message);
  }

  const warning = insertErrors[0] || 'machine_master insert was skipped because no compatible column mapping worked.';
  console.warn('Order will be created, but missing machine was not saved to machine_master:', warning);
  return { saved: false, warning };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return fail('Unauthorized. Please logout and login again.', 'UNAUTHORIZED');
  const { data: profile, error: profileError } = await adminClient
    .from('test_profiles')
    .select('id,full_name,branch,role,is_active')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();
  if (profileError) return fail(profileError.message, 'PROFILE_LOOKUP_FAILED');
  if (!profile) return fail('No active profile is linked with this login. Please check test_profiles.auth_user_id.', 'PROFILE_NOT_LINKED');
  if (!profile.is_active) return fail('Only active users can create orders. Please activate this profile in Developer Workspace.', 'PROFILE_INACTIVE');
  if (!['branch', 'admin', 'super', 'manager', 'developer'].includes(profile.role)) return fail('Role cannot create orders', 'ROLE_NOT_ALLOWED');

  const body = await req.json().catch(() => ({}));
  const branch = clean(body.branch);
  const orderType = clean(body.orderType).toUpperCase();
  const orderFor = clean(body.orderFor) || 'Customer';
  const approverId = clean(body.approverId);
  const machineNo = normalizeMachine(body.machineNo);
  const customerName = clean(body.customerName);
  const callId = clean(body.callId);
  const warrantyStatus = clean(body.warrantyStatus) || (orderFor === 'Stock' ? 'NA' : 'UW');
  const items = Array.isArray(body.items) ? body.items : [];

  if (!branch || !orderType || !orderFor) return fail('Branch, order type and order for are required');

  const { data: branchRows, error: branchError } = await adminClient
    .from('test_branch_mapping')
    .select('branch_name, branch_code')
    .eq('is_active', true);
  if (branchError) return fail(branchError.message, 'BRANCH_LOOKUP_FAILED');
  const branches = (branchRows ?? []) as BranchMapping[];
  const submittedBranch = findBranchMapping(branches, branch);
  const profileBranch = findBranchMapping(branches, profile.branch ?? '');
  const canonicalBranch = submittedBranch?.branch_name ?? branch;

  if (profile.role === 'branch') {
    const submittedKey = normalizeBranchKey(submittedBranch?.branch_name ?? branch);
    const profileKey = normalizeBranchKey(profileBranch?.branch_name ?? profile.branch ?? '');
    if (!submittedKey || !profileKey || submittedKey !== profileKey) {
      return fail(`Branch user can create orders only for own branch. Login branch: ${profile.branch || 'Unassigned'}, selected branch: ${branch}`, 'BRANCH_MISMATCH');
    }
  }

  if (!approverId) return fail('Approver is required', 'APPROVER_REQUIRED');
  const { data: approver, error: approverError } = await adminClient
    .from('test_profiles')
    .select('id, full_name, role, is_active')
    .eq('id', approverId)
    .maybeSingle();
  if (approverError) return fail(approverError.message, 'APPROVER_LOOKUP_FAILED');
  if (!approver?.is_active || !['super', 'manager'].includes(approver.role)) return fail('Please select an active super or manager approver.', 'APPROVER_INVALID');

  if (orderType === 'VOR' && orderFor !== 'Customer') return fail('VOR order must be for Customer');
  if (orderFor === 'Customer' && (!machineNo || !customerName || !warrantyStatus)) return fail('Customer order requires machine, customer and machine type');
  if (items.length === 0) return fail('At least one item row is required');

  const parsedItems = items.map((item) => {
    const partNo = normalizePart(item.partNo);
    const description = clean(item.description);
    const dnp = Number(item.dnp ?? 0);
    const qty = Number(item.qty ?? 0);
    const previous30dQty = Number(item.previous30dQty ?? 0);
    return { partNo, description, dnp, qty, previous30dQty };
  });
  const invalid = parsedItems.find((item) => !item.partNo || !item.description || !Number.isFinite(item.dnp) || item.dnp < 0 || !Number.isInteger(item.qty) || item.qty < 1);
  if (invalid) return fail('Every item must have valid part, description, DNP and whole quantity above zero');
  const duplicate = parsedItems.find((item, index) => parsedItems.findIndex((candidate) => candidate.partNo === item.partNo) !== index);
  if (duplicate) return fail(`Duplicate item not allowed: ${duplicate.partNo}`, 'DUPLICATE_ITEM');

  try {
    const machineMasterResult = orderFor === 'Customer' ? await saveMissingMachine(adminClient, machineNo, customerName) : null;
    const initialStatus = approver.role === 'manager' ? 'pending_manager_approval' : 'pending_approval';

    const orderNo = `TEST-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
    const { data: order, error: orderError } = await adminClient.from('test_orders').insert({
      order_no: orderNo,
      branch: canonicalBranch,
      order_type: orderType,
      order_for: orderFor,
      employee_id: profile.id,
      approver_id: approverId,
      machine_no: orderFor === 'Stock' ? null : machineNo,
      customer_name: orderFor === 'Stock' ? null : customerName,
      call_id: callId || null,
      warranty_status: orderFor === 'Stock' ? 'NA' : warrantyStatus,
      status: initialStatus,
      approval_status: initialStatus,
    }).select('id,order_no').single();
    if (orderError) throw orderError;

    const itemRows = parsedItems.map((item) => ({
      order_id: order.id,
      part_no: item.partNo,
      description: item.description,
      dnp: item.dnp,
      qty: item.qty,
      value: Number((item.dnp * item.qty).toFixed(2)),
      previous_30d_qty: item.previous30dQty,
      row_status: initialStatus,
    }));
    const { error: itemError } = await adminClient.from('test_order_items').insert(itemRows);
    if (itemError) throw itemError;

    const machineNote = machineMasterResult?.warning ? ` Machine master save skipped: ${machineMasterResult.warning}` : '';
    await adminClient.from('test_order_events').insert({ order_id: order.id, event_type: 'ORDER_CREATED', old_status: null, new_status: initialStatus, actor_id: profile.id, notes: `Created by ${profile.full_name || profile.role}. Approver: ${approver.full_name || approver.role}. ${itemRows.length} item row(s).${machineNote}` });
    return json({ ok: true, id: order.id, order_no: order.order_no, machine_master_warning: machineMasterResult?.warning ?? null });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Order creation failed', 'ORDER_CREATE_FAILED');
  }
});
