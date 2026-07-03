import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const fail = (message: string, code = 'ORDER_CREATE_VALIDATION') => json({ ok: false, error: message, code });
const clean = (value: unknown) => String(value ?? '').trim();
const normalizePart = (value: unknown) => clean(value).replace(/\s+/g, '').toUpperCase();
const normalizeMachine = (value: unknown) => clean(value).replace(/\s+/g, '').toUpperCase();
const normalizeBranchKey = (value: unknown) => clean(value).replace(/[\s_-]+/g, '').toUpperCase();

type BranchMapping = { branch_name: string; branch_code: string };

function findBranchMapping(branches: BranchMapping[], value: string) {
  const key = normalizeBranchKey(value);
  return branches.find((branch) => normalizeBranchKey(branch.branch_name) === key || normalizeBranchKey(branch.branch_code) === key) ?? null;
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
      status: 'pending_approval',
      approval_status: 'pending_approval',
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
      row_status: 'pending_approval',
    }));
    const { error: itemError } = await adminClient.from('test_order_items').insert(itemRows);
    if (itemError) throw itemError;

    await adminClient.from('test_order_events').insert({ order_id: order.id, event_type: 'ORDER_CREATED', old_status: null, new_status: 'pending_approval', actor_id: profile.id, notes: `Created by ${profile.full_name || profile.role} with ${itemRows.length} item row(s)` });
    return json({ ok: true, id: order.id, order_no: order.order_no });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Order creation failed', 'ORDER_CREATE_FAILED');
  }
});
