import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { FilePlus2, Search } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../components/ui/Button';
import { PageCard } from '../../components/ui/PageCard';
import { getTadaDispatches } from '../../services/tada.service';

const statusLabels: Record<string, string> = {
  AWAITING_HQ_RECEIPT: 'Awaiting HQ Receipt',
  PARTIALLY_RECEIVED_HQ: 'Partial at HQ',
  AWAITING_ACCOUNTS_RECEIPT: 'Awaiting Accounts',
  PARTIALLY_RECEIVED_ACCOUNTS: 'Partial at Accounts',
  COMPLETED: 'Completed',
};

export function TadaTrackingPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const { data: dispatches = [], isLoading, error } = useQuery({
    queryKey: ['tada-dispatches'],
    queryFn: getTadaDispatches,
    refetchInterval: 20000,
  });

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return dispatches;
    return dispatches.filter((item) => [item.dispatch_no, item.branch_name_snapshot, item.dispatched_by, item.status, item.reference_no ?? ''].some((value) => value.toLowerCase().includes(needle)));
  }, [dispatches, search]);

  const counts = {
    hq: dispatches.filter((item) => item.status === 'AWAITING_HQ_RECEIPT').length,
    partialHq: dispatches.filter((item) => item.status === 'PARTIALLY_RECEIVED_HQ').length,
    accounts: dispatches.filter((item) => item.status === 'AWAITING_ACCOUNTS_RECEIPT').length,
    partialAccounts: dispatches.filter((item) => item.status === 'PARTIALLY_RECEIVED_ACCOUNTS').length,
    completed: dispatches.filter((item) => item.status === 'COMPLETED').length,
  };

  const canCreate = profile?.role && ['branch', 'manager', 'hq', 'developer'].includes(profile.role);

  return (
    <PageCard eyebrow="Operations" title="TA/DA Bill Tracking" description="Track physical SVR and TA/DA bill movement from branch dispatch through HQ and Accounts receipt.">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative min-w-[240px] flex-1 max-w-xl"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#64748b]" /><input className="w-full rounded-md border border-[#d7dee8] bg-white py-2 pl-8 pr-2.5 text-xs font-semibold text-[#172033] outline-none focus:border-[#2563eb]" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search dispatch, office, dispatched by, ref. no. or status" /></div>
        {canCreate ? <Link to="/ta-da/new"><Button><FilePlus2 className="h-4 w-4" />New Dispatch</Button></Link> : null}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Awaiting HQ', counts.hq],
          ['Partial at HQ', counts.partialHq],
          ['Awaiting Accounts', counts.accounts],
          ['Partial at Accounts', counts.partialAccounts],
          ['Completed', counts.completed],
        ].map(([label, value]) => <div key={label} className="rounded-md border border-[#dbe3ec] bg-white px-3 py-2"><p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#64748b]">{label}</p><p className="mt-1 text-xl font-black text-[#172033]">{value}</p></div>)}
      </div>

      {error ? <p className="mt-3 rounded-md bg-[#fef2f2] p-2.5 text-xs font-bold text-[#b91c1c]">{error instanceof Error ? error.message : 'Failed to load TA/DA dispatches.'}</p> : null}
      {isLoading ? <p className="mt-3 text-xs font-bold text-[#64748b]">Loading TA/DA dispatches…</p> : null}

      <div className="mt-3 overflow-x-auto rounded-md border border-[#dbe3ec] bg-white">
        <table className="w-full min-w-[940px] border-collapse text-left text-xs">
          <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-[0.08em] text-[#64748b]"><tr><th className="px-3 py-2">Dispatch No.</th><th className="px-3 py-2">Office</th><th className="px-3 py-2">SVRs</th><th className="px-3 py-2">Dispatch Date</th><th className="px-3 py-2">Mode / Ref.</th><th className="px-3 py-2">Dispatched By</th><th className="px-3 py-2">Status</th></tr></thead>
          <tbody className="divide-y divide-[#e2e8f0]">{visible.map((item) => <tr key={item.id} tabIndex={0} role="button" className="cursor-pointer bg-white transition hover:bg-[#f8fbff] focus:bg-[#f8fbff] focus:outline-none" onClick={() => navigate(`/ta-da/${item.id}`)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') navigate(`/ta-da/${item.id}`); }}><td className="px-3 py-2 font-black text-[#1d4ed8]">{item.dispatch_no}</td><td className="px-3 py-2 font-bold text-[#172033]">{item.branch_name_snapshot}</td><td className="px-3 py-2">{item.total_svr_count}</td><td className="px-3 py-2">{item.dispatch_date}</td><td className="px-3 py-2">{item.dispatch_mode}{item.reference_no ? ` • ${item.reference_no}` : ''}</td><td className="px-3 py-2">{item.dispatched_by}</td><td className="px-3 py-2 font-black text-[#334155]">{statusLabels[item.status] ?? item.status}</td></tr>)}</tbody>
        </table>
        {!isLoading && visible.length === 0 ? <p className="p-4 text-center text-xs font-bold text-[#64748b]">No TA/DA dispatches found.</p> : null}
      </div>
    </PageCard>
  );
}
