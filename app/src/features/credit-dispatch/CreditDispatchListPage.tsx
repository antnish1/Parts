import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock, CreditCard, FileSignature, Plus, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { getCreditDispatches, formatMoney, type CreditDispatchRecord } from '../../services/creditDispatch.service';

function statusClass(status: string) {
  if (status === 'Closed') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status.includes('Overdue')) return 'bg-red-100 text-red-700 border-red-200';
  if (status.includes('Partial')) return 'bg-amber-100 text-amber-700 border-amber-200';
  if (status === 'Approved') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (status === 'Rejected') return 'bg-rose-100 text-rose-700 border-rose-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof CreditCard }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function DispatchCard({ row }: { row: CreditDispatchRecord }) {
  const isOverdue = row.recovery_status.includes('Overdue');
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950">{row.dispatch_no ?? 'Pending No.'}</p>
          <p className="mt-1 truncate text-xs font-semibold text-slate-500">{row.branch} • {row.customer_type}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${statusClass(row.recovery_status)}`}>
          {row.recovery_status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Customer</p>
          <p className="mt-1 truncate font-bold text-slate-800">{row.customer_name}</p>
          <p className="text-xs font-semibold text-slate-500">{row.mobile_no}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Document</p>
          <p className="mt-1 truncate font-bold text-slate-800">{row.document_type}</p>
          <p className="text-xs font-semibold text-slate-500">{row.document_no || 'No document no.'}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 p-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Credit</p>
            <p className="text-sm font-black text-slate-950">{formatMoney(row.credit_amount)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Received</p>
            <p className="text-sm font-black text-emerald-700">{formatMoney(row.total_received_amount)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Balance</p>
            <p className="text-sm font-black text-red-700">{formatMoney(row.balance_amount)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          {isOverdue ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <Clock className="h-4 w-4 text-blue-500" />}
          Due {row.due_date}
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${statusClass(row.approval_status)}`}>
          {row.approval_status}
        </span>
      </div>
    </article>
  );
}

export function CreditDispatchListPage() {
  const dispatchQuery = useQuery({
    queryKey: ['credit-dispatches'],
    queryFn: getCreditDispatches,
    refetchInterval: 30000,
  });

  const rows = dispatchQuery.data ?? [];
  const totalCredit = rows.reduce((sum, row) => sum + Number(row.credit_amount || 0), 0);
  const totalBalance = rows.reduce((sum, row) => sum + Number(row.balance_amount || 0), 0);
  const overdueCount = rows.filter((row) => row.recovery_status.includes('Overdue')).length;
  const closedCount = rows.filter((row) => row.recovery_status === 'Closed').length;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Credit Dispatch</p>
          <h1 className="mt-1 text-xl font-black text-slate-950">Payment Recovery Tracker</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">Track digitally signed credit dispatch approvals and pending receipts.</p>
        </div>
        <Link to="/credit-dispatch/new">
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            New Request
          </Button>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Credit" value={formatMoney(totalCredit)} icon={CreditCard} />
        <StatCard label="Pending Balance" value={formatMoney(totalBalance)} icon={AlertTriangle} />
        <StatCard label="Overdue" value={String(overdueCount)} icon={Clock} />
        <StatCard label="Closed" value={String(closedCount)} icon={CheckCircle2} />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">
          <Search className="h-4 w-4" />
          Search and filters will be added with Recovery Tracker phase.
        </div>

        {dispatchQuery.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-56 animate-pulse rounded-3xl bg-slate-100" />)}
          </div>
        ) : dispatchQuery.error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
            Could not load Credit Dispatch records. Make sure migration 020 is applied in Supabase.
          </div>
        ) : rows.length === 0 ? (
          <div className="grid place-items-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center">
            <FileSignature className="h-10 w-10 text-blue-500" />
            <h2 className="mt-3 text-lg font-black text-slate-950">No credit dispatch yet</h2>
            <p className="mt-1 max-w-md text-sm font-semibold text-slate-500">Create the first digitally signed credit dispatch request from branch login.</p>
            <Link to="/credit-dispatch/new" className="mt-4">
              <Button>
                <Plus className="h-4 w-4" />
                Create Request
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => <DispatchCard key={row.id} row={row} />)}
          </div>
        )}
      </div>
    </div>
  );
}
