import { supabase } from '@/lib/supabase';

export type TadaDispatch = { id: string; dispatch_no: string; branch_key: string; branch_name_snapshot: string; status: string; dispatch_date: string; dispatched_by: string; dispatch_mode: 'Bus' | 'Transport' | 'By Hand'; reference_no: string | null; total_svr_count: number; created_at: string };
export type TadaSvrItem = { id: string; dispatch_id: string; svr_no: string; engineer_id: string | null; engineer_name_snapshot: string; date_from: string; date_to: string; machine_no: string; customer_name: string; current_location: string; hq_received: boolean | null; hq_exception_reason: string | null; hq_remark: string | null; accounts_received: boolean | null; accounts_exception_reason: string | null; accounts_remark: string | null };
export type TadaEvent = { id: string; dispatch_id: string; svr_item_id: string | null; event_type: string; actor_name_snapshot: string | null; actor_role_snapshot: string | null; metadata: Record<string, unknown>; created_at: string };
export type TadaReceiptResult = { svr_item_id: string; received: boolean; exception_reason: string; remark: string };
export type TadaEngineer = { id: string; branch_key: string; engineer_name: string };
export type PortalBranch = { branch_key: string; display_name: string };
export type TadaCreateItem = { svr_no: string; engineer_id: string | null; engineer_name: string; date_from: string; date_to: string; machine_no: string; customer_name: string };

export const TADA_STATUSES = ['AWAITING_HQ_RECEIPT', 'PARTIALLY_RECEIVED_HQ', 'AWAITING_ACCOUNTS_RECEIPT', 'PARTIALLY_RECEIVED_ACCOUNTS', 'COMPLETED'] as const;
export function tadaStatusLabel(status: string) { return ({ AWAITING_HQ_RECEIPT: 'Awaiting HQ', PARTIALLY_RECEIVED_HQ: 'Partial HQ', AWAITING_ACCOUNTS_RECEIPT: 'Awaiting Accounts', PARTIALLY_RECEIVED_ACCOUNTS: 'Partial Accounts', COMPLETED: 'Completed' } as Record<string, string>)[status] ?? status; }
export function tadaLocationLabel(location: string) { return ({ IN_TRANSIT_TO_HQ: 'To HQ', HQ: 'At HQ', IN_TRANSIT_TO_ACCOUNTS: 'To Accounts', ACCOUNTS: 'Accounts', MISSING_HQ: 'Missing at HQ', MISSING_ACCOUNTS: 'Missing at Accounts' } as Record<string, string>)[location] ?? location; }

export async function getTadaBranches(): Promise<PortalBranch[]> {
  const { data, error } = await supabase.from('portal_branches').select('branch_key, display_name').eq('is_active', true).order('sort_order', { ascending: true }).order('display_name');
  if (error) throw error;
  return (data ?? []) as PortalBranch[];
}
export async function getTadaEngineers(): Promise<TadaEngineer[]> {
  const { data, error } = await supabase.from('portal_service_engineers').select('id, branch_key, engineer_name').eq('is_active', true).order('branch_key').order('engineer_name');
  if (error) throw error;
  return (data ?? []) as TadaEngineer[];
}
export async function getTadaDispatches(): Promise<TadaDispatch[]> {
  const { data, error } = await supabase.from('portal_tada_dispatches').select('id, dispatch_no, branch_key, branch_name_snapshot, status, dispatch_date, dispatched_by, dispatch_mode, reference_no, total_svr_count, created_at').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TadaDispatch[];
}
export async function getTadaDispatch(dispatchId: string) {
  const [dispatchResult, itemsResult, eventsResult] = await Promise.all([
    supabase.from('portal_tada_dispatches').select('id, dispatch_no, branch_key, branch_name_snapshot, status, dispatch_date, dispatched_by, dispatch_mode, reference_no, total_svr_count, created_at').eq('id', dispatchId).single(),
    supabase.from('portal_tada_svr_items').select('id, dispatch_id, svr_no, engineer_id, engineer_name_snapshot, date_from, date_to, machine_no, customer_name, current_location, hq_received, hq_exception_reason, hq_remark, accounts_received, accounts_exception_reason, accounts_remark').eq('dispatch_id', dispatchId).order('created_at'),
    supabase.from('portal_tada_events').select('id, dispatch_id, svr_item_id, event_type, actor_name_snapshot, actor_role_snapshot, metadata, created_at').eq('dispatch_id', dispatchId).order('created_at', { ascending: false }),
  ]);
  if (dispatchResult.error) throw dispatchResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (eventsResult.error) throw eventsResult.error;
  return { dispatch: dispatchResult.data as TadaDispatch, items: (itemsResult.data ?? []) as TadaSvrItem[], events: (eventsResult.data ?? []) as TadaEvent[] };
}
export async function createTadaDispatch(input: { branch: string; dispatchDate: string; dispatchedBy: string; dispatchMode: 'Bus' | 'Transport' | 'By Hand'; referenceNo: string; items: TadaCreateItem[] }) {
  const { data, error } = await supabase.rpc('portal_create_tada_dispatch', { p_branch: input.branch, p_dispatch_date: input.dispatchDate, p_dispatched_by: input.dispatchedBy, p_dispatch_mode: input.dispatchMode, p_reference_no: input.referenceNo, p_items: input.items });
  if (error) throw error;
  return String(data);
}
export async function receiveTadaDispatch(dispatchId: string, stage: 'HQ' | 'ACCOUNTS', results: TadaReceiptResult[]) {
  const { error } = await supabase.rpc('portal_receive_tada_dispatch', { p_dispatch_id: dispatchId, p_stage: stage, p_results: results });
  if (error) throw error;
}
