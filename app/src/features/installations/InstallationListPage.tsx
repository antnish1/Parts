import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FilePlus2, Search } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { PageCard } from '../../components/ui/PageCard';
import { INSTALLATION_VIEWER_PROFILE_ID, listInstallationEntries, type InstallationStatus } from '../../services/installations.service';

const PAGE_SIZE = 15;
const normalizeBranch = (value?: string | null) => String(value ?? '').trim().toUpperCase().replace(/\s+/g, '_');

export function InstallationListPage() {
  const navigate = useNavigate(); const { profile, session } = useAuth(); const [params, setParams] = useSearchParams();
  const query = useQuery({ queryKey: ['installation-entries'], queryFn: listInstallationEntries, staleTime: 20000, refetchOnWindowFocus: true });
  const entries = query.data ?? []; const status = (params.get('status') ?? 'all') as InstallationStatus | 'all';
  const search = params.get('q') ?? ''; const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const isManager = ['admin','manager','developer','hq'].includes(profile?.role ?? '') || normalizeBranch(profile?.branch) === 'JABALPUR_PARTS';
  const isViewer = profile?.id === INSTALLATION_VIEWER_PROFILE_ID || session?.user?.id === INSTALLATION_VIEWER_PROFILE_ID;
  const filtered = useMemo(() => entries.filter((entry) => {
    const needle = search.trim().toLowerCase();
    return (status === 'all' || entry.status === status) && (!needle || [entry.entry_no, entry.invoice_no, entry.customer_name, entry.branch, entry.equipment_registration_no].some((v) => String(v ?? '').toLowerCase().includes(needle)));
  }), [entries, search, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)); const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const totals = useMemo(() => ({
    all: entries.length, PENDING: entries.filter((e) => e.status === 'PENDING').length,
    COMPLETED: entries.filter((e) => e.status === 'COMPLETED').length, ACCEPTED: entries.filter((e) => e.status === 'ACCEPTED').length,
  }), [entries]);
  function update(key: string, value: string) { const next = new URLSearchParams(params); if (!value || value === 'all') next.delete(key); else next.set(key, value); if (key !== 'page') next.delete('page'); setParams(next, { replace: true }); }
  const cards = [
    ['all','Total Entries',totals.all], ['PENDING','Pending',totals.PENDING], ['COMPLETED','Completed',totals.COMPLETED], ['ACCEPTED','Accepted',totals.ACCEPTED],
  ] as const;
  return <PageCard eyebrow="Operations" title="Engine Installation Management" description="Engine and Rock Breaker installation documentation workflow">
    <div className="mb-3 flex items-center justify-end">{isManager ? <button onClick={() => navigate('/installations/new')} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#0f5fa8] px-4 text-xs font-semibold text-white hover:bg-[#0b4d8a]"><FilePlus2 className="h-4 w-4"/>Add New Entry</button> : null}</div>
    {isViewer ? <div className="mb-3 rounded-lg border border-[#b9d5ef] bg-[#eef7ff] px-3 py-2 text-xs font-semibold text-[#0b4d8a]">Service CRM queue: completed entries are ready for registration and acceptance.</div> : null}
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{cards.map(([key,label,count]) => { const active = status === key; return <button key={key} onClick={() => update('status', key)} className={`rounded-lg border p-3 text-left ${active ? 'border-[#0b1f3a] bg-[#0b1f3a] text-white' : 'border-[#d5deea] bg-[#f8fafc] text-[#0f172a]'}`}><span className={`text-[10px] font-semibold uppercase ${active ? 'text-[#dce8f5]' : 'text-[#64748b]'}`}>{label}</span><strong className={`mt-1 block text-xl ${active ? 'text-white' : 'text-[#0f172a]'}`}>{count}</strong></button>; })}</div>
    <div className="mt-3 rounded-lg border border-[#d8e0ea] bg-[#f8fafc] p-2"><label className="relative block"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[#64748b]"/><input value={search} onChange={(e) => update('q', e.target.value)} placeholder="Search entry, invoice, customer, branch or registration" className="h-9 w-full rounded-md border border-[#cbd5e1] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#0f5fa8]"/></label></div>
    {query.error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Could not load installation entries.</p> : null}
    <div className="mt-3 overflow-hidden rounded-lg border border-[#d8e0ea] bg-white"><div className="overflow-x-auto"><table className="w-full table-fixed text-left text-xs"><thead className="bg-[#eaf0f6] text-[10px] uppercase text-[#334155]"><tr><th className="w-[125px] px-3 py-2">Entry</th><th className="w-[100px] px-3 py-2">Date</th><th className="w-[105px] px-3 py-2">Type</th><th className="w-[120px] px-3 py-2">Branch</th><th className="w-[130px] px-3 py-2">Invoice</th><th className="px-3 py-2">Customer</th><th className="w-[80px] px-3 py-2 text-right">Qty</th><th className="w-[110px] px-3 py-2">Status</th><th className="w-[120px] px-3 py-2">Action</th></tr></thead><tbody>{visible.map((entry) => {
      const qty = (entry.portal_installation_items ?? []).reduce((s,i) => s + Number(i.quantity || 0), 0);
      const action = entry.status === 'PENDING' ? 'Complete Entry' : entry.status === 'COMPLETED' && isViewer ? 'Accept Entry' : 'Open';
      return <tr key={entry.id} onClick={() => navigate(`/installations/${entry.id}`)} className="cursor-pointer border-t border-[#e2e8f0] hover:bg-[#eef7ff]"><td className="truncate px-3 py-2 font-semibold text-[#075fb8]">{entry.entry_no}</td><td className="px-3 py-2">{new Date(entry.invoice_date).toLocaleDateString('en-IN')}</td><td className="px-3 py-2">{entry.equipment_type === 'ROCK_BREAKER' ? 'Rock Breaker' : 'Engine'}</td><td className="truncate px-3 py-2">{entry.branch}</td><td className="truncate px-3 py-2">{entry.invoice_no}</td><td className="truncate px-3 py-2">{entry.customer_name}</td><td className="px-3 py-2 text-right font-semibold">{qty}</td><td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${entry.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' : entry.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-800'}`}>{entry.status}</span></td><td className="px-3 py-2 text-[#075fb8]">{action}</td></tr>;
    })}</tbody></table></div>{!query.isLoading && filtered.length === 0 ? <div className="p-10 text-center text-sm text-[#64748b]">No installation entries found.</div> : null}</div>
    {filtered.length > 0 ? <div className="mt-2 flex items-center justify-between rounded-lg border border-[#d8e0ea] bg-white px-3 py-2 text-xs"><span>Showing {(safePage-1)*PAGE_SIZE+1}–{Math.min(safePage*PAGE_SIZE, filtered.length)} of {filtered.length}</span><div className="flex items-center gap-2"><button disabled={safePage<=1} onClick={() => update('page', String(safePage-1))} className="h-8 rounded-md border bg-white px-3 text-[#334155] disabled:opacity-40">Previous</button><span>Page {safePage} of {pageCount}</span><button disabled={safePage>=pageCount} onClick={() => update('page', String(safePage+1))} className="h-8 rounded-md border bg-white px-3 text-[#334155] disabled:opacity-40">Next</button></div></div> : null}
  </PageCard>;
}
