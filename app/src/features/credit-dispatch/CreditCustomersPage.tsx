import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Search } from 'lucide-react';
import { formatMoney } from '../../services/creditDispatch.service';
import { getCreditCustomerOutstanding, riskTone, type CreditCustomerOutstanding } from '../../services/creditCustomer.service';

function SmallStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-medium uppercase tracking-[0.13em] text-slate-400">{label}</p><p className="mt-1 text-lg font-semibold text-slate-900">{value}</p></div>;
}

function CustomerCard({ row }: { row: CreditCustomerOutstanding }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{row.customer_name}</p><p className="mt-1 text-xs font-medium text-slate-500">{row.mobile_no} • {row.default_branch ?? '-'}</p></div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] ${riskTone(row.risk_category)}`}>{row.risk_category}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center">
        <div><p className="text-[10px] font-medium uppercase text-slate-400">Credit</p><p className="text-xs font-semibold text-slate-900">{formatMoney(row.total_credit)}</p></div>
        <div><p className="text-[10px] font-medium uppercase text-slate-400">Paid</p><p className="text-xs font-semibold text-emerald-700">{formatMoney(row.total_received)}</p></div>
        <div><p className="text-[10px] font-medium uppercase text-slate-400">Due</p><p className="text-xs font-semibold text-red-700">{formatMoney(row.outstanding)}</p></div>
      </div>
      {row.overdue > 0 ? <p className="mt-3 rounded-2xl bg-red-50 p-3 text-xs font-medium text-red-700">Overdue {formatMoney(row.overdue)}</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-2"><Link to={'/credit-dispatch/customers/profile?id=' + row.customer_id} className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">Profile</Link><Link to={'/credit-dispatch/customers/ledger?id=' + row.customer_id} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"><BookOpen className="h-4 w-4" />Ledger</Link></div>
    </article>
  );
}

export function CreditCustomersPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Outstanding');
  const query = useQuery({ queryKey: ['credit-customers'], queryFn: getCreditCustomerOutstanding, refetchInterval: 30000 });
  const rows = query.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === 'Overdue' && Number(row.overdue || 0) <= 0) return false;
      if (filter === 'Outstanding' && Number(row.outstanding || 0) <= 0) return false;
      if (!q) return true;
      return [row.customer_name, row.mobile_no, row.default_branch, row.customer_type, row.risk_category].some((value) => String(value ?? '').toLowerCase().includes(q));
    });
  }, [rows, search, filter]);

  const totalOutstanding = filtered.reduce((sum, row) => sum + Number(row.outstanding || 0), 0);
  const totalOverdue = filtered.reduce((sum, row) => sum + Number(row.overdue || 0), 0);

  return (
    <div data-cd-theme="customers" className="cd-shell mx-auto max-w-7xl space-y-4 pb-20">
      <div className="cd-hero rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><Link to="/credit-dispatch" className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-500"><ArrowLeft className="h-4 w-4" />Back</Link><p className="text-[11px] font-medium uppercase tracking-[0.15em] text-blue-600">Customer Outstanding</p></div><Link to="/credit-dispatch/customers/aging" className="inline-flex items-center justify-center rounded-2xl bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">Aging Report</Link></div></div>
      <div className="grid gap-3 sm:grid-cols-3"><SmallStat label="Customers" value={String(filtered.length)} /><SmallStat label="Outstanding" value={formatMoney(totalOutstanding)} /><SmallStat label="Overdue" value={formatMoney(totalOverdue)} /></div>
      <div className="grid gap-2 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[1fr_180px]"><label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"><Search className="h-4 w-4 text-slate-400" /><input className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer or mobile" /></label><select className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium" value={filter} onChange={(event) => setFilter(event.target.value)}>{['Outstanding', 'Overdue', 'All'].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
      {query.isLoading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-48 animate-pulse rounded-3xl bg-slate-100" />)}</div> : filtered.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-medium text-slate-500">No customer ledger found.</div> : <><div className="grid gap-3 md:grid-cols-2 xl:hidden">{filtered.map((row) => <CustomerCard key={row.customer_id} row={row} />)}</div><div className="hidden overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm xl:block"><table className="min-w-full divide-y divide-slate-100 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-medium uppercase tracking-[0.13em] text-slate-500"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3 text-right">Credit</th><th className="px-4 py-3 text-right">Received</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3 text-right">Overdue</th><th className="px-4 py-3">Risk</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((row) => <tr key={row.customer_id} className="hover:bg-slate-50"><td className="px-4 py-3"><p className="font-semibold text-slate-900">{row.customer_name}</p><p className="text-slate-500">{row.mobile_no} • {row.customer_type}</p></td><td className="px-4 py-3 font-medium text-slate-600">{row.default_branch ?? '-'}</td><td className="px-4 py-3 text-right font-medium">{formatMoney(row.total_credit)}</td><td className="px-4 py-3 text-right font-medium text-emerald-700">{formatMoney(row.total_received)}</td><td className="px-4 py-3 text-right font-semibold text-red-700">{formatMoney(row.outstanding)}</td><td className="px-4 py-3 text-right font-medium text-red-600">{formatMoney(row.overdue)}</td><td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${riskTone(row.risk_category)}`}>{row.risk_category}</span></td><td className="px-4 py-3"><div className="flex gap-2"><Link to={'/credit-dispatch/customers/profile?id=' + row.customer_id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">Profile</Link><Link to={'/credit-dispatch/customers/ledger?id=' + row.customer_id} className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700"><BookOpen className="h-4 w-4" />Ledger</Link></div></td></tr>)}</tbody></table></div></>}
    </div>
  );
}
