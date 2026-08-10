import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCheck, ChevronDown, MapPin, PackageCheck, ReceiptText } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../components/ui/Button';
import { PageCard } from '../../components/ui/PageCard';
import { getTadaDispatch, receiveTadaDispatch, type TadaReceiptResult } from '../../services/tada.service';
import { getTadaStatusMeta, tadaLocationMeta, TadaMiniBadge, TadaStatusBadge } from './tadaUi';

const exceptionReasons = ['Not Found in Packet', 'Document Incomplete', 'Wrong SVR', 'Damaged / Unreadable', 'Other'];
type ReceiptState = Record<string, { received: boolean; reason: string; remark: string }>;

function receiptBadge(value: boolean | null, missingReason?: string | null) {
  if (value === null) return <TadaMiniBadge className="border-slate-200 bg-slate-50 text-slate-700">Pending</TadaMiniBadge>;
  if (value) return <TadaMiniBadge className="border-emerald-200 bg-emerald-50 text-emerald-800">Received</TadaMiniBadge>;
  return <TadaMiniBadge className="border-red-200 bg-red-50 text-red-800">{missingReason ? `Missing • ${missingReason}` : 'Not Received'}</TadaMiniBadge>;
}

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
      await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ['tada-dispatches'] })]);
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
  const missingCount = allItems.filter((item) => item.hq_received === false || item.accounts_received === false).length;
  const statusMeta = getTadaStatusMeta(dispatch.status);

  return (
    <PageCard eyebrow="TA/DA Bills" title={dispatch.dispatch_no} description={`${dispatch.branch_name_snapshot} • ${statusMeta.label}`}>
      <div className={`-mx-1 rounded-xl border p-2.5 sm:p-3 ${statusMeta.surfaceClass}`}>
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="inline-flex items-center gap-1 text-xs font-black text-[#1d4ed8]" onClick={() => navigate(-1)}><ArrowLeft className="h-3.5 w-3.5" />Back</button>
          <TadaStatusBadge status={dispatch.status} />
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5 sm:gap-2">
          <div className="rounded-lg border border-white/80 bg-white/80 px-2 py-1.5 text-center"><p className="text-[9px] font-black uppercase text-[#64748b]">Sent</p><p className="text-base font-black leading-tight text-[#172033]">{allItems.length}</p></div>
          <div className="rounded-lg border border-white/80 bg-white/80 px-2 py-1.5 text-center"><p className="text-[9px] font-black uppercase text-[#64748b]">HQ</p><p className="text-base font-black leading-tight text-[#172033]">{hqReceivedCount}/{allItems.length}</p></div>
          <div className="rounded-lg border border-white/80 bg-white/80 px-2 py-1.5 text-center"><p className="text-[9px] font-black uppercase text-[#64748b]">Accounts</p><p className="text-base font-black leading-tight text-[#172033]">{accountsReceivedCount}/{hqReceivedCount}</p></div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-white/65 px-2.5 py-2 text-[10px] sm:grid-cols-3 lg:grid-cols-6">
          <p><span className="font-black text-[#64748b]">Date</span><br/><span className="font-bold text-[#172033]">{dispatch.dispatch_date}</span></p>
          <p><span className="font-black text-[#64748b]">Mode</span><br/><span className="font-bold text-[#172033]">{dispatch.dispatch_mode}</span></p>
          <p><span className="font-black text-[#64748b]">Ref.</span><br/><span className="font-bold text-[#172033]">{dispatch.reference_no ?? '-'}</span></p>
          <p><span className="font-black text-[#64748b]">Dispatched By</span><br/><span className="font-bold text-[#172033]">{dispatch.dispatched_by}</span></p>
          <p><span className="font-black text-[#64748b]">Office</span><br/><span className="font-bold text-[#172033]">{dispatch.branch_name_snapshot}</span></p>
          <p><span className="font-black text-[#64748b]">Exceptions</span><br/><span className={`font-black ${missingCount ? 'text-red-700' : 'text-emerald-700'}`}>{missingCount}</span></p>
        </div>
      </div>

      {receiptStage ? <section className={`mt-2 rounded-xl border p-2.5 sm:p-3 ${receiptStage === 'ACCOUNTS' ? 'border-blue-200 bg-blue-50/70' : 'border-amber-200 bg-amber-50/70'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0"><div className="flex items-center gap-1.5"><PackageCheck className="h-4 w-4 shrink-0 text-[#1d4ed8]"/><p className="text-xs font-black text-[#172033]">{receiptStage === 'HQ' ? 'HQ Receipt' : 'Accounts Receipt'}</p></div><p className="mt-0.5 text-[10px] leading-4 text-[#475569]">Checked = physically received. Uncheck only missing documents.</p></div>
          <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#172033]">{receiptItems.length} SVRs</span>
        </div>
        <div className="mt-2 flex gap-3 border-y border-black/5 py-1.5 text-[10px] font-black"><button className="text-[#1d4ed8]" onClick={() => setAll(true)}>All Received</button><button className="text-[#475569]" onClick={() => setAll(false)}>Clear All</button></div>

        <div className="mt-2 space-y-1.5">{receiptItems.map((item) => {
          const state = receiptState[item.id] ?? { received: true, reason: '', remark: '' };
          return <div key={item.id} className={`rounded-lg border bg-white p-2 ${state.received ? 'border-[#dbe3ec]' : 'border-red-200 bg-red-50/50'}`}>
            <div className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#2563eb]" checked={state.received} onChange={(event) => setReceiptState((current) => ({ ...current, [item.id]: { ...state, received: event.target.checked, reason: event.target.checked ? '' : state.reason } }))} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><p className="text-[11px] font-black text-[#172033]">{item.svr_no}</p>{state.received ? <TadaMiniBadge className="border-emerald-200 bg-emerald-50 text-emerald-800">Received</TadaMiniBadge> : <TadaMiniBadge className="border-red-200 bg-red-50 text-red-800">Not Received</TadaMiniBadge>}</div>
                <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-[#475569] sm:grid-cols-4"><p className="truncate"><b className="text-[#172033]">Engineer:</b> {item.engineer_name_snapshot}</p><p className="truncate"><b className="text-[#172033]">Machine:</b> {item.machine_no}</p><p className="col-span-2 truncate sm:col-span-2"><b className="text-[#172033]">Customer:</b> {item.customer_name}</p></div>
                {!state.received ? <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2"><select className="rounded-md border border-red-200 bg-white px-2 py-1.5 text-[11px]" value={state.reason} onChange={(event) => setReceiptState((current) => ({ ...current, [item.id]: { ...state, reason: event.target.value } }))}><option value="">Reason not received</option>{exceptionReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select><input className="rounded-md border border-red-200 bg-white px-2 py-1.5 text-[11px]" value={state.remark} onChange={(event) => setReceiptState((current) => ({ ...current, [item.id]: { ...state, remark: event.target.value } }))} placeholder="Remark (optional)" /></div> : null}
              </div>
            </div>
          </div>;
        })}</div>
        {message ? <p className="mt-2 rounded-md bg-white/80 px-2 py-1.5 text-[11px] font-bold text-[#1e3a8a]">{message}</p> : null}
        <div className="sticky bottom-1 z-10 mt-2 rounded-lg border border-white/70 bg-white/95 p-1.5 shadow-lg backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"><Button className="w-full sm:w-auto sm:float-right" disabled={receiveMutation.isPending} onClick={submitReceipt}><CheckCheck className="h-4 w-4" />{receiveMutation.isPending ? 'Saving…' : `Confirm ${receiptStage === 'HQ' ? 'HQ' : 'Accounts'} Receipt`}</Button><div className="clear-both" /></div>
      </section> : null}

      {!receiptStage && message ? <p className="mt-2 rounded-md bg-[#ecfdf5] px-3 py-2 text-xs font-bold text-[#166534]">{message}</p> : null}

      <section className="mt-2 rounded-xl border border-[#dbe3ec] bg-white p-2.5 sm:p-3">
        <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-[#475569]"/><p className="text-xs font-black text-[#172033]">SVR Movement</p></div><span className="text-[10px] font-bold text-[#64748b]">{allItems.length} records</span></div>

        <div className="space-y-1.5 md:hidden">{allItems.map((item) => {
          const location = tadaLocationMeta[item.current_location] ?? { label: item.current_location, badgeClass: 'border-slate-200 bg-slate-50 text-slate-700' };
          return <div key={item.id} className="rounded-lg border border-[#e2e8f0] p-2">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[11px] font-black text-[#172033]">{item.svr_no}</p><p className="truncate text-[10px] font-semibold text-[#475569]">{item.engineer_name_snapshot} • {item.machine_no}</p></div><TadaMiniBadge className={location.badgeClass}>{location.label}</TadaMiniBadge></div>
            <div className="mt-1 grid grid-cols-2 gap-x-2 text-[10px] text-[#475569]"><p className="truncate">{item.customer_name}</p><p className="text-right">{item.date_from === item.date_to ? item.date_from : `${item.date_from} → ${item.date_to}`}</p></div>
            <div className="mt-1.5 flex flex-wrap gap-1"><span className="text-[9px] font-black uppercase text-[#64748b]">HQ</span>{receiptBadge(item.hq_received, item.hq_exception_reason)}<span className="ml-1 text-[9px] font-black uppercase text-[#64748b]">Accounts</span>{item.hq_received !== true ? <TadaMiniBadge className="border-slate-200 bg-slate-50 text-slate-500">—</TadaMiniBadge> : receiptBadge(item.accounts_received, item.accounts_exception_reason)}</div>
          </div>;
        })}</div>

        <div className="hidden overflow-x-auto rounded-md border border-[#e2e8f0] md:block"><table className="w-full min-w-[1040px] border-collapse text-left text-xs"><thead className="bg-[#f8fafc] text-[10px] uppercase tracking-[0.08em] text-[#64748b]"><tr><th className="px-2.5 py-2">SVR</th><th className="px-2.5 py-2">Engineer</th><th className="px-2.5 py-2">Visit</th><th className="px-2.5 py-2">Machine / Customer</th><th className="px-2.5 py-2">Location</th><th className="px-2.5 py-2">HQ</th><th className="px-2.5 py-2">Accounts</th></tr></thead><tbody className="divide-y divide-[#e2e8f0]">{allItems.map((item) => {
          const location = tadaLocationMeta[item.current_location] ?? { label: item.current_location, badgeClass: 'border-slate-200 bg-slate-50 text-slate-700' };
          return <tr key={item.id}><td className="px-2.5 py-2 font-black text-[#172033]">{item.svr_no}</td><td className="px-2.5 py-2">{item.engineer_name_snapshot}</td><td className="px-2.5 py-2">{item.date_from === item.date_to ? item.date_from : `${item.date_from} → ${item.date_to}`}</td><td className="px-2.5 py-2"><b>{item.machine_no}</b><br/><span className="text-[10px] text-[#64748b]">{item.customer_name}</span></td><td className="px-2.5 py-2"><TadaMiniBadge className={location.badgeClass}>{location.label}</TadaMiniBadge></td><td className="px-2.5 py-2">{receiptBadge(item.hq_received, item.hq_exception_reason)}</td><td className="px-2.5 py-2">{item.hq_received !== true ? '—' : receiptBadge(item.accounts_received, item.accounts_exception_reason)}</td></tr>;
        })}</tbody></table></div>
      </section>

      <details className="group mt-2 rounded-xl border border-[#dbe3ec] bg-white p-2.5 sm:p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2"><div className="flex items-center gap-1.5"><ReceiptText className="h-4 w-4 text-[#475569]"/><p className="text-xs font-black text-[#172033]">Traceability Timeline</p></div><div className="flex items-center gap-1 text-[10px] font-bold text-[#64748b]">{data?.events.length ?? 0} events <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180"/></div></summary>
        <div className="mt-2 space-y-1.5">{(data?.events ?? []).map((event) => <div key={event.id} className="grid grid-cols-[5px_1fr] gap-2"><span className="mt-1 h-full min-h-7 rounded-full bg-[#bfdbfe]"/><div><p className="text-[11px] font-black text-[#172033]">{event.event_type.replace(/_/g, ' ')}</p><p className="text-[10px] text-[#64748b]">{new Date(event.created_at).toLocaleString()} • {event.actor_name_snapshot ?? 'System'}{event.actor_role_snapshot ? ` (${event.actor_role_snapshot})` : ''}</p></div></div>)}{!data?.events.length ? <p className="text-xs text-[#64748b]">No timeline events yet.</p> : null}</div>
      </details>
    </PageCard>
  );
}
