import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, CircleAlert, FilePlus2, Landmark, Pencil, Search, ShieldAlert, Trash2, WalletCards } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../components/ui/Button';
import { PageCard } from '../../components/ui/PageCard';
import { developerDeleteTadaDispatch, getTadaDispatches, type TadaDispatch } from '../../services/tada.service';
import { TadaListDeveloperDeleteDialog } from './TadaListDeveloperDeleteDialog';
import { getTadaStatusMeta, TadaStatusBadge } from './tadaUi';

const statusOrder = [
  'AWAITING_HQ_RECEIPT',
  'PARTIALLY_RECEIVED_HQ',
  'AWAITING_ACCOUNTS_RECEIPT',
  'PARTIALLY_RECEIVED_ACCOUNTS',
  'COMPLETED',
] as const;

type StatusFilter = 'ALL' | typeof statusOrder[number];

export function TadaTrackingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [deleteTarget, setDeleteTarget] = useState<TadaDispatch | null>(null);
  const [developerMessage, setDeveloperMessage] = useState('');
  const { data: dispatches = [], isLoading, error } = useQuery({
    queryKey: ['tada-dispatches'],
    queryFn: getTadaDispatches,
    refetchInterval: 20000,
  });

  const isDeveloper = profile?.role === 'developer';
  const deleteMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => developerDeleteTadaDispatch(id, reason),
    onSuccess: async () => {
      setDeleteTarget(null);
      setDeveloperMessage('TA/DA list deleted. Permanent Developer audit snapshot retained.');
      await queryClient.invalidateQueries({ queryKey: ['tada-dispatches'] });
    },
    onError: (mutationError) => {
      setDeveloperMessage(mutationError instanceof Error ? mutationError.message : 'Unable to delete TA/DA list.');
    },
  });

  const counts = useMemo(() => Object.fromEntries(statusOrder.map((status) => [status, dispatches.filter((item) => item.status === status).length])) as Record<typeof statusOrder[number], number>, [dispatches]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return dispatches.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (!needle) return true;
      return [item.dispatch_no, item.branch_name_snapshot, item.dispatched_by, item.status, item.reference_no ?? '', item.dispatch_mode]
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [dispatches, search, statusFilter]);

  const canCreate = profile?.role && ['branch', 'manager', 'hq', 'developer'].includes(profile.role);
  const prioritizedStatuses = useMemo(() => {
    if (profile?.role === 'accounts') return ['AWAITING_ACCOUNTS_RECEIPT', 'PARTIALLY_RECEIVED_ACCOUNTS', 'COMPLETED', 'AWAITING_HQ_RECEIPT', 'PARTIALLY_RECEIVED_HQ'] as const;
    if (profile?.role === 'manager') return ['AWAITING_HQ_RECEIPT', 'PARTIALLY_RECEIVED_HQ', 'AWAITING_ACCOUNTS_RECEIPT', 'PARTIALLY_RECEIVED_ACCOUNTS', 'COMPLETED'] as const;
    return statusOrder;
  }, [profile?.role]);

  const kpiIcons: Record<string, typeof Landmark> = {
    AWAITING_HQ_RECEIPT: Landmark,
    PARTIALLY_RECEIVED_HQ: CircleAlert,
    AWAITING_ACCOUNTS_RECEIPT: WalletCards,
    PARTIALLY_RECEIVED_ACCOUNTS: CircleAlert,
    COMPLETED: CheckCircle2,
  };

  function openManage(item: TadaDispatch) {
    navigate(`/ta-da/${item.id}`);
  }

  return (
    <PageCard eyebrow="Operations" title="TA/DA Bill Tracking" description="Track SVR movement from branch dispatch through HQ and Accounts receipt.">
      <div className="sticky top-0 z-10 -mx-1 rounded-lg bg-white/95 px-1 pb-2 backdrop-blur md:static md:bg-transparent md:p-0">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#64748b]" /><input className="w-full rounded-md border border-[#d7dee8] bg-white py-2 pl-8 pr-2.5 text-xs font-semibold text-[#172033] outline-none focus:border-[#2563eb]" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search dispatch, office, ref. or person" /></div>
          {canCreate ? <Link to="/ta-da/new" className="shrink-0"><Button className="px-3"><FilePlus2 className="h-4 w-4" /><span className="hidden sm:inline">New Dispatch</span><span className="sm:hidden">New</span></Button></Link> : null}
        </div>
      </div>

      {isDeveloper ? <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-[10px] text-[#64748b]"><ShieldAlert className="h-4 w-4 shrink-0 text-red-700" /><p><b className="text-red-800">Developer controls active.</b> Use Manage to edit the list or individual SVRs at any stage, or Delete to remove the complete TA/DA list with a mandatory audit reason.</p></div> : null}
      {developerMessage ? <p className="mt-2 rounded-md border border-[#dbe3ec] bg-white px-3 py-2 text-[11px] font-bold text-[#334155]">{developerMessage}</p> : null}

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {prioritizedStatuses.map((status) => {
          const meta = getTadaStatusMeta(status);
          const Icon = kpiIcons[status];
          const active = statusFilter === status;
          return <button key={status} type="button" aria-pressed={active} onClick={() => setStatusFilter((current) => current === status ? 'ALL' : status)} className={`relative overflow-hidden rounded-lg border p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 ${meta.surfaceClass} ${active ? 'ring-2 ring-[#2563eb]/25 shadow-sm' : ''}`}>
            <span className={`absolute inset-y-0 left-0 w-1 ${meta.accentClass}`} />
            <div className="flex items-start justify-between gap-2 pl-1"><div className="min-w-0"><p className="truncate text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">{meta.shortLabel}</p><p className="mt-0.5 text-xl font-black leading-none text-[#172033]">{counts[status]}</p></div><Icon className="h-4 w-4 shrink-0 text-[#475569]" /></div>
            <p className="mt-1 pl-1 text-[10px] font-bold text-[#64748b]">Tap to filter</p>
          </button>;
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-bold text-[#64748b]">
        <span>{statusFilter === 'ALL' ? 'All dispatches' : getTadaStatusMeta(statusFilter).label} • {visible.length}</span>
        {statusFilter !== 'ALL' ? <button type="button" className="font-black text-[#1d4ed8]" onClick={() => setStatusFilter('ALL')}>Clear filter</button> : null}
      </div>

      {error ? <p className="mt-2 rounded-md bg-[#fef2f2] p-2.5 text-xs font-bold text-[#b91c1c]">{error instanceof Error ? error.message : 'Failed to load TA/DA dispatches.'}</p> : null}
      {isLoading ? <p className="mt-2 text-xs font-bold text-[#64748b]">Loading TA/DA dispatches…</p> : null}

      <div className="mt-2 space-y-2 md:hidden">
        {visible.map((item) => {
          const meta = getTadaStatusMeta(item.status);
          return <div key={item.id} role="button" tabIndex={0} onClick={() => navigate(`/ta-da/${item.id}`)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') navigate(`/ta-da/${item.id}`); }} className={`relative w-full cursor-pointer overflow-hidden rounded-lg border p-2.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${meta.surfaceClass}`}>
            <span className={`absolute inset-y-0 left-0 w-1 ${meta.accentClass}`} />
            <div className="flex items-start justify-between gap-2 pl-1"><div className="min-w-0"><p className="truncate text-xs font-black text-[#1d4ed8]">{item.dispatch_no}</p><p className="mt-0.5 truncate text-[11px] font-bold text-[#172033]">{item.branch_name_snapshot}</p></div><TadaStatusBadge status={item.status} compact /></div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 pl-1 text-[10px] text-[#475569]">
              <p><span className="font-black text-[#172033]">{item.total_svr_count}</span> SVRs</p>
              <p className="text-right">{item.dispatch_date}</p>
              <p className="truncate"><span className="font-bold">{item.dispatch_mode}</span>{item.reference_no ? ` • ${item.reference_no}` : ''}</p>
              <p className="truncate text-right">By {item.dispatched_by}</p>
            </div>
            {isDeveloper ? <div className="mt-2 flex gap-1.5 border-t border-black/5 pt-2 pl-1" onClick={(event) => event.stopPropagation()}>
              <button type="button" onClick={() => openManage(item)} className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-[#bfdbfe] bg-white text-[10px] font-black text-[#1d4ed8]"><Pencil className="h-3.5 w-3.5" />Manage / Edit</button>
              <button type="button" onClick={() => { setDeveloperMessage(''); setDeleteTarget(item); }} className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-3 text-[10px] font-black text-red-700"><Trash2 className="h-3.5 w-3.5" />Delete</button>
            </div> : null}
          </div>;
        })}
        {!isLoading && visible.length === 0 ? <p className="rounded-lg border border-dashed border-[#cbd5e1] p-5 text-center text-xs font-bold text-[#64748b]">No TA/DA dispatches found.</p> : null}
      </div>

      <div className="mt-2 hidden overflow-x-auto rounded-lg border border-[#dbe3ec] bg-white md:block">
        <table className={`w-full ${isDeveloper ? 'min-w-[1080px]' : 'min-w-[940px]'} border-collapse text-left text-xs`}>
          <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-[0.08em] text-[#64748b]"><tr><th className="px-3 py-2">Dispatch No.</th><th className="px-3 py-2">Office</th><th className="px-3 py-2">SVRs</th><th className="px-3 py-2">Dispatch Date</th><th className="px-3 py-2">Mode / Ref.</th><th className="px-3 py-2">Dispatched By</th><th className="px-3 py-2">Status</th>{isDeveloper ? <th className="w-[165px] px-3 py-2">Developer Actions</th> : null}</tr></thead>
          <tbody className="divide-y divide-[#e2e8f0]">{visible.map((item) => {
            const meta = getTadaStatusMeta(item.status);
            return <tr key={item.id} tabIndex={0} role="button" className={`cursor-pointer transition focus:outline-none ${meta.rowClass}`} onClick={() => navigate(`/ta-da/${item.id}`)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') navigate(`/ta-da/${item.id}`); }}><td className="border-l-4 px-3 py-2 font-black text-[#1d4ed8]" style={{ borderLeftColor: 'transparent' }}>{item.dispatch_no}</td><td className="px-3 py-2 font-bold text-[#172033]">{item.branch_name_snapshot}</td><td className="px-3 py-2">{item.total_svr_count}</td><td className="px-3 py-2">{item.dispatch_date}</td><td className="px-3 py-2">{item.dispatch_mode}{item.reference_no ? ` • ${item.reference_no}` : ''}</td><td className="px-3 py-2">{item.dispatched_by}</td><td className="px-3 py-2"><TadaStatusBadge status={item.status} /></td>{isDeveloper ? <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}><div className="flex gap-1.5"><button type="button" onClick={() => openManage(item)} className="inline-flex h-8 items-center gap-1 rounded-md border border-[#bfdbfe] bg-white px-2.5 text-[10px] font-black text-[#1d4ed8] hover:bg-blue-50"><Pencil className="h-3.5 w-3.5" />Manage</button><button type="button" onClick={() => { setDeveloperMessage(''); setDeleteTarget(item); }} className="inline-flex h-8 items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 text-[10px] font-black text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" />Delete</button></div></td> : null}</tr>;
          })}</tbody>
        </table>
        {!isLoading && visible.length === 0 ? <p className="p-4 text-center text-xs font-bold text-[#64748b]">No TA/DA dispatches found.</p> : null}
      </div>

      <TadaListDeveloperDeleteDialog open={Boolean(deleteTarget)} dispatchNo={deleteTarget?.dispatch_no ?? ''} busy={deleteMutation.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={(reason) => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id, reason })} />
    </PageCard>
  );
}
