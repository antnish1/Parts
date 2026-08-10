import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCheck } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../components/ui/Button';
import { PageCard } from '../../components/ui/PageCard';
import { getTadaDispatch, receiveTadaDispatch, type TadaReceiptResult } from '../../services/tada.service';

const exceptionReasons = ['Not Found in Packet', 'Document Incomplete', 'Wrong SVR', 'Damaged / Unreadable', 'Other'];
const statusLabels: Record<string, string> = {
  AWAITING_HQ_RECEIPT: 'Awaiting HQ Receipt', PARTIALLY_RECEIVED_HQ: 'Partial at HQ', AWAITING_ACCOUNTS_RECEIPT: 'Awaiting Accounts Receipt', PARTIALLY_RECEIVED_ACCOUNTS: 'Partial at Accounts', COMPLETED: 'Completed',
};
const locationLabels: Record<string, string> = {
  IN_TRANSIT_TO_HQ: 'In Transit to HQ', HQ: 'HQ', IN_TRANSIT_TO_ACCOUNTS: 'Moving to Accounts', ACCOUNTS: 'Accounts', MISSING_HQ: 'Not Received at HQ', MISSING_ACCOUNTS: 'Not Received at Accounts',
};

type ReceiptState = Record<string, { received: boolean; reason: string; remark: string }>;

export function TadaDispatchDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { dispatchId = '' } = useParams();
  const { profile } = useAuth();
  const [receiptState, setReceiptState] = useState<ReceiptState>({});
  const [message, setMessage] = useState('');

  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['tada-dispatch', dispatchId], queryFn: () => getTadaDispatch(dispatchId), enabled: Boolean(dispatchId) });
  const dispatch = data?.dispatch;
  const allItems = data?.items ?? [];

  const receiptStage = useMemo<'HQ' | 'ACCOUNTS' | null>(() => {
    if (!dispatch || !profile) return null;
    if (dispatch.status === 'AWAITING_HQ_RECEIPT' && ['manager', 'developer'].includes(profile.role)) return 'HQ';
    if (['AWAITING_ACCOUNTS_RECEIPT', 'PARTIALLY_RECEIVED_HQ'].includes(dispatch.status) && ['accounts', 'developer'].includes(profile.role)) return 'ACCOUNTS';
    return null;
  }, [dispatch, profile]);

  const receiptItems = useMemo(() => receiptStage === 'ACCOUNTS' ? allItems.filter((item) => item.hq_received === true) : allItems, [allItems, receiptStage]);

  useEffect(() => {
    if (!receiptStage || !receiptItems.length) return;
    setReceiptState(Object.fromEntries(receiptItems.map((item) => [item.id, { received: true, reason: '', remark: '' }])));
  }, [receiptStage, receiptItems.length]);

  const receiveMutation = useMutation({
    mutationFn: (payload: { stage: 'HQ' | 'ACCOUNTS'; results: TadaReceiptResult[] }) => receiveTadaDispatch(dispatchId, payload.stage, payload.results),
    onSuccess: async () => {
      setMessage('Receipt recorded successfully.');
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ['tada-dispatches'] }),
      ]);
    },
    onError: (mutationError) => setMessage(mutationError instanceof Error ? mutationError.message : 'Unable to record receipt.'),
  });

  function setAll(received: boolean) {
    setReceiptState(Object.fromEntries(receiptItems.map((item) => [item.id, { received, reason: received ? '' : (receiptState[item.id]?.reason ?? ''), remark: receiptState[item.id]?.remark ?? '' }])));
  }

  function submitReceipt() {
    if (!receiptStage) return;
    const results = receiptItems.map((item) => ({
      svr_item_id: item.id,
      received: receiptState[item.id]?.received ?? true,
      exception_reason: receiptState[item.id]?.reason ?? '',
      remark: receiptState[item.id]?.remark ?? '',
    }));
    const invalid = results.find((item) => !item.received && !item.exception_reason.trim());
    if (invalid) return setMessage('Select a reason for every SVR marked Not Received.');
    receiveMutation.mutate({ stage: receiptStage, results });
  }

  if (isLoading) return <PageCard eyebrow="TA/DA Bills" title="Loading Dispatch" description="Loading the latest TA/DA movement details."><p className="text-xs font-bold text-[#64748b]">Loading TA/DA movement details…</p></PageCard>;
  if (error || !dispatch) return <PageCard eyebrow="TA/DA Bills" title="Dispatch Not Available" description="The requested TA/DA dispatch could not be loaded."><p className="text-xs font-bold text-[#b91c1c]">{error instanceof Error ? error.message : 'Unable to load dispatch.'}</p></PageCard>;

  const hqReceivedCount = allItems.filter((item) => item.hq_received === true).length;
  const accountsReceivedCount = allItems.filter((item) => item.accounts_received === true).length;

  return (
    <PageCard eyebrow="TA/DA Bills" title={dispatch.dispatch_no} description={`${dispatch.branch_name_snapshot} • ${statusLabels[dispatch.status] ?? dispatch.status}`}>
      <button type="button" className="mb-3 inline-flex items-center gap-1 text-xs font-black text-[#1d4ed8]" onClick={() => navigate(-1)}><ArrowLeft className="h-3.5 w-3.5" />Back</button>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ['Office', dispatch.branch_name_snapshot], ['SVRs', String(dispatch.total_svr_count)], ['Dispatched', dispatch.dispatch_date], ['By', dispatch.dispatched_by], ['Mode', dispatch.dispatch_mode], ['Ref. No.', dispatch.reference_no ?? '-'],
        ].map(([label, value]) => <div key={label} className="rounded-md border border-[#dbe3ec] bg-white px-3 py-2"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">{label}</p><p className="mt-1 text-xs font-black text-[#172033]">{value}</p></div>)}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-md bg-[#f8fafc] px-3 py-2"><p className="text-[10px] font-black uppercase text-[#64748b]">Sent</p><p className="text-lg font-black text-[#172033]">{allItems.length}</p></div><div className="rounded-md bg-[#f8fafc] px-3 py-2"><p className="text-[10px] font-black uppercase text-[#64748b]">HQ Received</p><p className="text-lg font-black text-[#172033]">{hqReceivedCount}/{allItems.length}</p></div><div className="rounded-md bg-[#f8fafc] px-3 py-2"><p className="text-[10px] font-black uppercase text-[#64748b]">Accounts Received</p><p className="text-lg font-black text-[#172033]">{accountsReceivedCount}/{Math.max(hqReceivedCount, 0)}</p></div></div>

      {receiptStage ? <section className="mt-3 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black text-[#172033]">{receiptStage === 'HQ' ? 'Record HQ Receipt' : 'Record Accounts Receipt'}</p><p className="text-[11px] text-[#475569]">All SVRs are selected by default. Uncheck any document not physically received and record the reason.</p></div><div className="flex gap-2"><button className="text-[11px] font-black text-[#1d4ed8]" onClick={() => setAll(true)}>Mark All Received</button><button className="text-[11px] font-black text-[#475569]" onClick={() => setAll(false)}>Clear All</button></div></div>
        <div className="mt-2 space-y-2">{receiptItems.map((item) => {
          const state = receiptState[item.id] ?? { received: true, reason: '', remark: '' };
          return <div key={item.id} className="rounded-md border border-[#dbeafe] bg-white p-2.5"><div className="flex items-start gap-2"><input type="checkbox" className="mt-1 h-4 w-4" checked={state.received} onChange={(event) => setReceiptState((current) => ({ ...current, [item.id]: { ...state, received: event.target.checked, reason: event.target.checked ? '' : state.reason } }))} /><div className="min-w-0 flex-1"><div className="grid gap-1 text-xs md:grid-cols-[130px_1.2fr_1fr_1.2fr]"><span className="font-black text-[#172033]">{item.svr_no}</span><span>{item.engineer_name_snapshot}</span><span>{item.machine_no}</span><span className="truncate">{item.customer_name}</span></div>{!state.received ? <div className="mt-2 grid gap-2 md:grid-cols-2"><select className="rounded-md border border-[#d7dee8] px-2.5 py-2 text-xs" value={state.reason} onChange={(event) => setReceiptState((current) => ({ ...current, [item.id]: { ...state, reason: event.target.value } }))}><option value="">Reason not received</option>{exceptionReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select><input className="rounded-md border border-[#d7dee8] px-2.5 py-2 text-xs" value={state.remark} onChange={(event) => setReceiptState((current) => ({ ...current, [item.id]: { ...state, remark: event.target.value } }))} placeholder="Remark (optional)" /></div> : null}</div></div></div>;
        })}</div>
        {message ? <p className="mt-2 text-xs font-bold text-[#1e3a8a]">{message}</p> : null}
        <div className="mt-3 flex justify-end"><Button disabled={receiveMutation.isPending} onClick={submitReceipt}><CheckCheck className="h-4 w-4" />{receiveMutation.isPending ? 'Saving…' : `Mark ${receiptStage === 'HQ' ? 'HQ' : 'Accounts'} Receipt`}</Button></div>
      </section> : null}

      {!receiptStage && message ? <p className="mt-3 rounded-md bg-[#ecfdf5] px-3 py-2 text-xs font-bold text-[#166534]">{message}</p> : null}

      <section className="mt-3 rounded-lg border border-[#dbe3ec] bg-white p-3">
        <p className="mb-2 text-xs font-black text-[#172033]">SVR Movement</p>
        <div className="overflow-x-auto rounded-md border border-[#e2e8f0]"><table className="w-full min-w-[1100px] border-collapse text-left text-xs"><thead className="bg-[#f8fafc] text-[10px] uppercase tracking-[0.08em] text-[#64748b]"><tr><th className="px-2.5 py-2">SVR</th><th className="px-2.5 py-2">Engineer</th><th className="px-2.5 py-2">Date From</th><th className="px-2.5 py-2">Date To</th><th className="px-2.5 py-2">Machine</th><th className="px-2.5 py-2">Customer</th><th className="px-2.5 py-2">Current Location</th><th className="px-2.5 py-2">HQ</th><th className="px-2.5 py-2">Accounts</th></tr></thead><tbody className="divide-y divide-[#e2e8f0]">{allItems.map((item) => <tr key={item.id}><td className="px-2.5 py-2 font-black text-[#172033]">{item.svr_no}</td><td className="px-2.5 py-2">{item.engineer_name_snapshot}</td><td className="px-2.5 py-2">{item.date_from}</td><td className="px-2.5 py-2">{item.date_to}</td><td className="px-2.5 py-2">{item.machine_no}</td><td className="px-2.5 py-2">{item.customer_name}</td><td className="px-2.5 py-2 font-black">{locationLabels[item.current_location] ?? item.current_location}</td><td className="px-2.5 py-2">{item.hq_received === null ? 'Pending' : item.hq_received ? 'Received' : `Not Received${item.hq_exception_reason ? ` • ${item.hq_exception_reason}` : ''}`}</td><td className="px-2.5 py-2">{item.hq_received !== true ? '-' : item.accounts_received === null ? 'Pending' : item.accounts_received ? 'Received' : `Not Received${item.accounts_exception_reason ? ` • ${item.accounts_exception_reason}` : ''}`}</td></tr>)}</tbody></table></div>
      </section>

      <section className="mt-3 rounded-lg border border-[#dbe3ec] bg-white p-3"><p className="mb-2 text-xs font-black text-[#172033]">Traceability Timeline</p><div className="space-y-2">{(data?.events ?? []).map((event) => <div key={event.id} className="border-l-2 border-[#bfdbfe] pl-3"><p className="text-xs font-black text-[#172033]">{event.event_type.replace(/_/g, ' ')}</p><p className="text-[11px] text-[#64748b]">{new Date(event.created_at).toLocaleString()} • {event.actor_name_snapshot ?? 'System'}{event.actor_role_snapshot ? ` (${event.actor_role_snapshot})` : ''}</p></div>)}{!data?.events.length ? <p className="text-xs text-[#64748b]">No timeline events yet.</p> : null}</div></section>
    </PageCard>
  );
}
