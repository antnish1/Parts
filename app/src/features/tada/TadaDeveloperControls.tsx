import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Pencil, Save, ShieldAlert, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { getTestBranches } from '../../services/testBranch.service';
import {
  developerDeleteTadaDispatch,
  developerDeleteTadaSvr,
  developerUpdateTadaDispatch,
  developerUpdateTadaSvr,
  getTadaEngineers,
  type TadaDispatch,
  type TadaSvrItem,
} from '../../services/tada.service';

type Props = {
  dispatch: TadaDispatch;
  items: TadaSvrItem[];
  onChanged: () => Promise<unknown> | void;
  onDispatchDeleted: () => void;
};

const inputClass = 'h-9 w-full rounded-md border border-[#cbd5e1] bg-white px-2.5 text-xs font-semibold text-[#172033] outline-none focus:border-[#2563eb]';
const labelClass = 'mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-[#64748b]';
type DeleteTarget = { type: 'dispatch' } | { type: 'svr'; item: TadaSvrItem } | null;

export function TadaDeveloperControls({ dispatch, items, onChanged, onDispatchDeleted }: Props) {
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [branch, setBranch] = useState(dispatch.branch_key);
  const [dispatchDate, setDispatchDate] = useState(dispatch.dispatch_date);
  const [dispatchedBy, setDispatchedBy] = useState(dispatch.dispatched_by);
  const [dispatchMode, setDispatchMode] = useState<TadaDispatch['dispatch_mode']>(dispatch.dispatch_mode);
  const [referenceNo, setReferenceNo] = useState(dispatch.reference_no ?? '');
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id ?? '');

  const selectedItem = useMemo(() => items.find((item) => item.id === selectedItemId) ?? items[0], [items, selectedItemId]);
  const [svrNo, setSvrNo] = useState(selectedItem?.svr_no ?? '');
  const [engineerName, setEngineerName] = useState(selectedItem?.engineer_name_snapshot ?? '');
  const [dateFrom, setDateFrom] = useState(selectedItem?.date_from ?? '');
  const [dateTo, setDateTo] = useState(selectedItem?.date_to ?? '');
  const [machineNo, setMachineNo] = useState(selectedItem?.machine_no ?? '');
  const [customerName, setCustomerName] = useState(selectedItem?.customer_name ?? '');

  const { data: engineers = [] } = useQuery({ queryKey: ['tada-engineers'], queryFn: getTadaEngineers });
  const { data: branches = [] } = useQuery({ queryKey: ['test-branches'], queryFn: getTestBranches });

  useEffect(() => {
    setBranch(dispatch.branch_key);
    setDispatchDate(dispatch.dispatch_date);
    setDispatchedBy(dispatch.dispatched_by);
    setDispatchMode(dispatch.dispatch_mode);
    setReferenceNo(dispatch.reference_no ?? '');
  }, [dispatch]);

  useEffect(() => {
    if (!selectedItem) return;
    setSvrNo(selectedItem.svr_no);
    setEngineerName(selectedItem.engineer_name_snapshot);
    setDateFrom(selectedItem.date_from);
    setDateTo(selectedItem.date_to);
    setMachineNo(selectedItem.machine_no);
    setCustomerName(selectedItem.customer_name);
  }, [selectedItem]);

  const updateDispatch = useMutation({
    mutationFn: () => developerUpdateTadaDispatch({ dispatchId: dispatch.id, branch, dispatchDate, dispatchedBy, dispatchMode, referenceNo, reason }),
    onSuccess: async () => { setMessage('Dispatch details updated.'); await onChanged(); },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Could not update dispatch.'),
  });

  const updateSvr = useMutation({
    mutationFn: () => {
      if (!selectedItem) throw new Error('Select an SVR.');
      const engineer = engineers.find((item) => item.engineer_name.toUpperCase() === engineerName.trim().toUpperCase());
      if (!engineer) throw new Error('Select a Service Engineer from the predefined list.');
      return developerUpdateTadaSvr({ itemId: selectedItem.id, svrNo, engineerId: engineer.id, engineerName: engineer.engineer_name, dateFrom, dateTo, machineNo, customerName, reason });
    },
    onSuccess: async () => { setMessage('SVR details updated.'); await onChanged(); },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Could not update SVR.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      if (deleteTarget.type === 'dispatch') return developerDeleteTadaDispatch(dispatch.id, reason);
      return developerDeleteTadaSvr(deleteTarget.item.id, reason);
    },
    onSuccess: async () => {
      const wasDispatch = deleteTarget?.type === 'dispatch';
      setDeleteTarget(null);
      if (wasDispatch) return onDispatchDeleted();
      setMessage('SVR deleted from the dispatch.');
      await onChanged();
    },
    onError: (error) => { setDeleteTarget(null); setMessage(error instanceof Error ? error.message : 'Delete failed.'); },
  });

  const reasonReady = reason.trim().length >= 3;

  return <details className="mt-2 rounded-xl border border-red-200 bg-red-50/40 p-2.5 sm:p-3">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
      <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-red-700"/><div><p className="text-xs font-black text-[#172033]">Developer Controls</p><p className="text-[10px] text-[#64748b]">Edit or delete at any stage. All actions are audited.</p></div></div>
      <span className="rounded-full border border-red-200 bg-white px-2 py-1 text-[9px] font-black uppercase text-red-700">Developer only</span>
    </summary>

    <div className="mt-3 rounded-lg border border-red-100 bg-white p-2.5">
      <label className={labelClass}>Mandatory Override Reason</label>
      <input className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this correction or deletion required?" />
      <p className="mt-1 text-[9px] text-[#64748b]">The reason, developer identity, time and before/after snapshot are saved permanently.</p>
    </div>

    <div className="mt-2 grid gap-2 lg:grid-cols-2">
      <section className="rounded-lg border border-[#dbe3ec] bg-white p-2.5">
        <div className="mb-2 flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5 text-[#1d4ed8]"/><p className="text-[11px] font-black text-[#172033]">Edit Dispatch Details</p></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelClass}>Office</label><select className={inputClass} value={branch} onChange={(e) => setBranch(e.target.value)}>{branches.map((item) => <option key={item.id} value={item.id}>{item.display_name ?? item.branch_name}</option>)}</select></div>
          <div><label className={labelClass}>Dispatch Date</label><input type="date" className={inputClass} value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} /></div>
          <div><label className={labelClass}>Dispatch Mode</label><select className={inputClass} value={dispatchMode} onChange={(e) => setDispatchMode(e.target.value as TadaDispatch['dispatch_mode'])}><option>Bus</option><option>Transport</option><option>By Hand</option></select></div>
          <div><label className={labelClass}>Ref. No.</label><input className={inputClass} value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} /></div>
          <div className="col-span-2"><label className={labelClass}>Dispatched By</label><input className={inputClass} value={dispatchedBy} onChange={(e) => setDispatchedBy(e.target.value)} /></div>
        </div>
        <button type="button" disabled={!reasonReady || updateDispatch.isPending} onClick={() => updateDispatch.mutate()} className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-md bg-[#0f5fa8] px-3 text-[11px] font-black text-white disabled:opacity-40"><Save className="h-3.5 w-3.5"/>Save Dispatch Changes</button>
      </section>

      <section className="rounded-lg border border-[#dbe3ec] bg-white p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5 text-[#1d4ed8]"/><p className="text-[11px] font-black text-[#172033]">Edit / Delete SVR</p></div><span className="text-[9px] font-bold text-[#64748b]">{items.length} SVRs</span></div>
        <label className={labelClass}>Select SVR</label>
        <select className={inputClass} value={selectedItem?.id ?? ''} onChange={(e) => setSelectedItemId(e.target.value)}>{items.map((item) => <option key={item.id} value={item.id}>{item.svr_no} • {item.engineer_name_snapshot}</option>)}</select>
        {selectedItem ? <div className="mt-2 grid grid-cols-2 gap-2">
          <div><label className={labelClass}>SVR No.</label><input className={inputClass} value={svrNo} onChange={(e) => setSvrNo(e.target.value.toUpperCase())} /></div>
          <div><label className={labelClass}>Engineer</label><input list="developer-tada-engineers" className={inputClass} value={engineerName} onChange={(e) => setEngineerName(e.target.value)} /><datalist id="developer-tada-engineers">{engineers.map((item) => <option key={item.id} value={item.engineer_name}>{item.branch_key}</option>)}</datalist></div>
          <div><label className={labelClass}>Date From</label><input type="date" className={inputClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
          <div><label className={labelClass}>Date To</label><input type="date" min={dateFrom || undefined} className={inputClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
          <div><label className={labelClass}>Machine No.</label><input className={inputClass} value={machineNo} onChange={(e) => setMachineNo(e.target.value.toUpperCase())} /></div>
          <div><label className={labelClass}>Customer</label><input className={inputClass} value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
        </div> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" disabled={!reasonReady || !selectedItem || updateSvr.isPending} onClick={() => updateSvr.mutate()} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#0f5fa8] px-3 text-[11px] font-black text-white disabled:opacity-40"><Save className="h-3.5 w-3.5"/>Save SVR Changes</button>
          <button type="button" disabled={!reasonReady || !selectedItem || items.length <= 1} onClick={() => selectedItem && setDeleteTarget({ type: 'svr', item: selectedItem })} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 text-[11px] font-black text-red-700 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5"/>Delete SVR</button>
        </div>
      </section>
    </div>

    {message ? <p className="mt-2 rounded-md border border-[#dbe3ec] bg-white px-2.5 py-2 text-[11px] font-bold text-[#334155]">{message}</p> : null}

    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-white p-2.5">
      <div><p className="text-[11px] font-black text-red-800">Delete Complete TA/DA List</p><p className="text-[9px] text-[#64748b]">Removes the live dispatch, SVRs, receipts and timeline. A permanent developer audit snapshot remains.</p></div>
      <button type="button" disabled={!reasonReady} onClick={() => setDeleteTarget({ type: 'dispatch' })} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-red-600 px-3 text-[11px] font-black text-white hover:bg-red-700 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5"/>Delete List</button>
    </div>

    <ConfirmDialog open={Boolean(deleteTarget)} title={deleteTarget?.type === 'dispatch' ? 'Delete complete TA/DA list?' : `Delete SVR ${deleteTarget?.type === 'svr' ? deleteTarget.item.svr_no : ''}?`} message={deleteTarget?.type === 'dispatch' ? `This will permanently remove ${dispatch.dispatch_no} from the live TA/DA workflow. The audit snapshot will be retained.` : 'This SVR will be removed from the dispatch and receipt totals/status will be recalculated.'} confirmLabel={deleteTarget?.type === 'dispatch' ? 'Delete TA/DA List' : 'Delete SVR'} tone="danger" busy={deleteMutation.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteMutation.mutate()} />
  </details>;
}
