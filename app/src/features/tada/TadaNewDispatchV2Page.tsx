import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Plus, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../components/ui/Button';
import { PageCard } from '../../components/ui/PageCard';
import { getTestBranches } from '../../services/testBranch.service';
import { createTadaDispatch, getTadaEngineers, type TadaCreateItem } from '../../services/tada.service';

const inputClass = 'w-full rounded-md border border-[#d7dee8] bg-white px-2.5 py-2 text-xs font-semibold text-[#172033] outline-none focus:border-[#2563eb] disabled:bg-[#f1f5f9] disabled:text-[#475569]';
const labelClass = 'mb-1 block text-[10px] font-black uppercase tracking-[0.1em] text-[#64748b]';

function addDays(date: string, days: number) {
  if (!date) return '';
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + Math.max(0, days - 1));
  return value.toISOString().slice(0, 10);
}

function inclusiveDays(from: string, to: string) {
  if (!from || !to) return 1;
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime();
  return end >= start ? Math.floor((end - start) / 86400000) + 1 : 1;
}

export function TadaNewDispatchV2Page() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const isBranchUser = profile?.role === 'branch';
  const [office, setOffice] = useState(profile?.branch ?? '');
  const [items, setItems] = useState<TadaCreateItem[]>([]);
  const [svrNo, setSvrNo] = useState('');
  const [engineerName, setEngineerName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [days, setDays] = useState(1);
  const [machineNo, setMachineNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [dispatchedBy, setDispatchedBy] = useState(profile?.fullName ?? '');
  const [dispatchMode, setDispatchMode] = useState<'Bus' | 'Transport' | 'By Hand'>('Bus');
  const [referenceNo, setReferenceNo] = useState('');
  const [message, setMessage] = useState('');

  const { data: branches = [] } = useQuery({ queryKey: ['test-branches'], queryFn: getTestBranches });
  const { data: engineers = [] } = useQuery({ queryKey: ['tada-engineers'], queryFn: getTadaEngineers });

  useEffect(() => {
    if (profile?.branch) setOffice(profile.branch);
    if (profile?.fullName) setDispatchedBy(profile.fullName);
  }, [profile?.branch, profile?.fullName]);

  const officeEngineers = useMemo(() => {
    const exact = engineers.filter((engineer) => engineer.branch_key === office);
    return exact.length ? exact : engineers;
  }, [engineers, office]);

  const mutation = useMutation({
    mutationFn: createTadaDispatch,
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ['tada-dispatches'] });
      navigate(`/ta-da/${id}`);
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Unable to submit TA/DA dispatch.'),
  });

  function changeFrom(next: string) {
    setDateFrom(next);
    const nextTo = !dateTo || dateTo < next ? next : dateTo;
    setDateTo(nextTo);
    setDays(inclusiveDays(next, nextTo));
  }

  function changeTo(next: string) {
    if (dateFrom && next < dateFrom) return;
    setDateTo(next);
    setDays(inclusiveDays(dateFrom, next));
  }

  function changeDays(next: number) {
    const safe = Math.max(1, Math.min(60, Number.isFinite(next) ? next : 1));
    setDays(safe);
    if (dateFrom) setDateTo(addDays(dateFrom, safe));
  }

  function addSvr(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    const normalizedSvr = svrNo.trim().toUpperCase();
    const engineer = engineers.find((row) => row.engineer_name.toUpperCase() === engineerName.trim().toUpperCase());
    if (!normalizedSvr || !engineerName.trim() || !dateFrom || !dateTo || !machineNo.trim() || !customerName.trim()) return setMessage('Complete all SVR fields before adding the row.');
    if (!engineer) return setMessage('Select the Service Engineer from the predefined autocomplete list.');
    if (items.some((item) => item.svr_no.toUpperCase() === normalizedSvr)) return setMessage(`SVR ${normalizedSvr} is already added to this dispatch.`);
    setItems((current) => [...current, {
      svr_no: normalizedSvr,
      engineer_id: engineer.id,
      engineer_name: engineer.engineer_name,
      date_from: dateFrom,
      date_to: dateTo,
      machine_no: machineNo.trim().toUpperCase(),
      customer_name: customerName.trim(),
    }]);
    setSvrNo(''); setEngineerName(''); setDateFrom(''); setDateTo(''); setDays(1); setMachineNo(''); setCustomerName('');
  }

  function submit() {
    setMessage('');
    if (!office) return setMessage('Select an Office.');
    if (!items.length) return setMessage('Add at least one SVR before finalizing the dispatch.');
    if (!dispatchDate || !dispatchedBy.trim()) return setMessage('Date of Dispatch and Dispatched By are required.');
    if ((dispatchMode === 'Bus' || dispatchMode === 'Transport') && !referenceNo.trim()) return setMessage('Ref. No. is required for Bus or Transport dispatch.');
    mutation.mutate({ branch: office, dispatchDate, dispatchedBy: dispatchedBy.trim(), dispatchMode, referenceNo: referenceNo.trim(), items });
  }

  const officeLabel = (branches.find((branch) => branch.id === office)?.display_name ?? office) || '-';

  return <PageCard eyebrow="TA/DA Bills" title="New TA/DA Dispatch" description="Prepare the SVR list and record dispatch details before sending the physical bills to Head Office.">
    <div className="space-y-3">
      <section className="rounded-lg border border-[#dbe3ec] bg-white p-3">
        <p className="text-xs font-black text-[#172033]">1. Office</p><p className="text-[11px] text-[#64748b]">Branch users are automatically assigned to their own office.</p>
        <div className="mt-2 max-w-md"><label className={labelClass}>Office</label><select className={inputClass} value={office} disabled={isBranchUser} onChange={(event) => setOffice(event.target.value)}><option value="">Select Office</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.display_name ?? branch.branch_name}</option>)}</select></div>
      </section>

      <section className="rounded-lg border border-[#dbe3ec] bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2"><div><p className="text-xs font-black text-[#172033]">2. SVR Details</p><p className="text-[11px] text-[#64748b]">Add every SVR included in this dispatch.</p></div><span className="rounded-full bg-[#e8f1ff] px-2.5 py-1 text-[11px] font-black text-[#1d4ed8]">{items.length} SVRs</span></div>
        <form onSubmit={addSvr} className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
          <div><label className={labelClass}>SVR No.</label><input className={inputClass} value={svrNo} onChange={(event) => setSvrNo(event.target.value)} /></div>
          <div className="xl:col-span-2"><label className={labelClass}>Name of Service Engineer</label><input list="tada-engineers" className={inputClass} value={engineerName} onChange={(event) => setEngineerName(event.target.value)} placeholder="Start typing engineer name" /><datalist id="tada-engineers">{officeEngineers.map((engineer) => <option key={engineer.id} value={engineer.engineer_name}>{engineer.branch_key}</option>)}</datalist></div>
          <div><label className={labelClass}>Date From</label><input type="date" className={inputClass} value={dateFrom} onChange={(event) => changeFrom(event.target.value)} /></div>
          <div><label className={labelClass}>Date To</label><input type="date" min={dateFrom || undefined} className={inputClass} value={dateTo} onChange={(event) => changeTo(event.target.value)} /></div>
          <div><label className={labelClass}>No. of Days</label><input type="number" min={1} max={60} className={inputClass} value={days} onChange={(event) => changeDays(Number(event.target.value))} /></div>
          <div className="md:col-span-2 xl:col-span-2"><label className={labelClass}>Machine No.</label><input className={inputClass} value={machineNo} onChange={(event) => setMachineNo(event.target.value)} /></div>
          <div className="md:col-span-2 xl:col-span-3"><label className={labelClass}>Customer's Name</label><input className={inputClass} value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></div>
          <div className="flex items-end xl:col-span-2"><Button type="submit" className="w-full"><Plus className="h-4 w-4" />Add SVR</Button></div>
        </form>
        {items.length ? <div className="mt-3 overflow-x-auto rounded-md border border-[#e2e8f0]"><table className="w-full min-w-[980px] border-collapse text-left text-xs"><thead className="bg-[#f8fafc] text-[10px] uppercase tracking-[0.08em] text-[#64748b]"><tr><th className="px-2.5 py-2">SVR</th><th className="px-2.5 py-2">Service Engineer</th><th className="px-2.5 py-2">Date From</th><th className="px-2.5 py-2">Date To</th><th className="px-2.5 py-2">Days</th><th className="px-2.5 py-2">Machine</th><th className="px-2.5 py-2">Customer</th><th className="px-2.5 py-2"></th></tr></thead><tbody className="divide-y divide-[#e2e8f0]">{items.map((item, index) => <tr key={`${item.svr_no}-${index}`}><td className="px-2.5 py-2 font-black">{item.svr_no}</td><td className="px-2.5 py-2">{item.engineer_name}</td><td className="px-2.5 py-2">{item.date_from}</td><td className="px-2.5 py-2">{item.date_to}</td><td className="px-2.5 py-2">{inclusiveDays(item.date_from,item.date_to)}</td><td className="px-2.5 py-2">{item.machine_no}</td><td className="px-2.5 py-2">{item.customer_name}</td><td className="px-2.5 py-2 text-right"><button type="button" className="inline-flex items-center gap-1 font-black text-[#dc2626]" onClick={() => setItems((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="h-3.5 w-3.5" />Remove</button></td></tr>)}</tbody></table></div> : null}
      </section>

      <section className="rounded-lg border border-[#dbe3ec] bg-white p-3">
        <p className="text-xs font-black text-[#172033]">3. Finalize Dispatch</p><p className="text-[11px] text-[#64748b]">Review the list, then record how the physical documents are being sent.</p>
        <div className="mt-2 grid gap-2 rounded-md bg-[#f8fafc] p-2.5 text-xs sm:grid-cols-3"><div><span className={labelClass}>Office</span><b>{officeLabel}</b></div><div><span className={labelClass}>Total SVRs</span><b>{items.length}</b></div><div><span className={labelClass}>Engineers</span><b>{new Set(items.map((item) => item.engineer_name)).size}</b></div></div>
        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <div><label className={labelClass}>Date of Dispatch</label><div className="relative"><CalendarDays className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#64748b]" /><input type="date" className={`${inputClass} pl-8`} value={dispatchDate} onChange={(event) => setDispatchDate(event.target.value)} /></div></div>
          <div><label className={labelClass}>Dispatched By</label><input className={inputClass} value={dispatchedBy} onChange={(event) => setDispatchedBy(event.target.value)} /></div>
          <div><label className={labelClass}>Dispatch Mode</label><select className={inputClass} value={dispatchMode} onChange={(event) => setDispatchMode(event.target.value as typeof dispatchMode)}><option value="Bus">Bus</option><option value="Transport">Transport</option><option value="By Hand">By Hand</option></select></div>
          <div><label className={labelClass}>Ref. No.</label><input className={inputClass} value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} placeholder="Courier / bus / bilty / vehicle / other ref." /></div>
        </div>
        {message ? <p className="mt-2 rounded-md bg-[#fff7ed] px-2.5 py-2 text-xs font-bold text-[#9a3412]">{message}</p> : null}
        <div className="mt-3 flex justify-end"><Button disabled={mutation.isPending || !items.length} onClick={submit}><Send className="h-4 w-4" />{mutation.isPending ? 'Submitting…' : 'Submit Dispatch'}</Button></div>
      </section>
    </div>
  </PageCard>;
}
