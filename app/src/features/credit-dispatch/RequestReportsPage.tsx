import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search } from 'lucide-react';
import { formatMoney, getCreditDispatches } from '../../services/creditDispatch.service';

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p><p className="mt-2 text-xl font-black text-slate-950">{value}</p></div>;
}

const statuses = ['All', 'Pending Approval', 'Approved', 'Correction Required', 'Rejected', 'Pending Payment', 'Partial Payment', 'Partial Payment - Overdue', 'Payment Overdue', 'Closed'];

export function RequestReportsPage() {
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('All');
  const [status, setStatus] = useState('All');
  const query = useQuery({ queryKey: ['credit-dispatches'], queryFn: getCreditDispatches, refetchInterval: 30000 });
  const rows = query.data ?? [];
  const branches = useMemo(() => ['All', ...Array.from(new Set(rows.map((row) => row.branch))).sort()], [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (branch !== 'All' && row.branch !== branch) return false;
      if (status !== 'All' && row.approval_status !== status && row.recovery_status !== status) return false;
      if (!q) return true;
      return [row.dispatch_no, row.branch, row.customer_name, row.mobile_no, row.document_type, row.document_no, row.approval_status, row.recovery_status].some((value) => String(value ?? '').toLowerCase().includes(q));
    });
  }, [rows, search, branch, status]);
  const totalCredit = filtered.reduce((sum, row) => sum + Number(row.credit_amount || 0), 0);
  const totalReceived = filtered.reduce((sum, row) => sum + Number(row.total_received_amount || 0), 0);
  const totalBalance = filtered.reduce((sum, row) => sum + Number(row.balance_amount || 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-20">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><Link to="/credit-dispatch" className="mb-2 inline-flex items-center gap-2 text-sm font-black text-slate-500"><ArrowLeft className="h-4 w-4" />Back</Link><p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Credit Dispatch</p><h1 className="text-xl font-black text-slate-950">Reports</h1><p className="mt-1 text-sm font-semibold text-slate-500">Branch and status reporting.</p></div>
      <div className="grid gap-3 sm:grid-cols-3"><Stat label="Credit" value={formatMoney(totalCredit)} /><Stat label="Received" value={formatMoney(totalReceived)} /><Stat label="Balance" value={formatMoney(totalBalance)} /></div>
      <div className="grid gap-2 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[1fr_180px_220px]"><label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"><Search className="h-4 w-4 text-slate-400" /><input className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reports..." /></label><select className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold" value={branch} onChange={(event) => setBranch(event.target.value)}>{branches.map((item) => <option key={item} value={item}>{item}</option>)}</select><select className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold" value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm"><table className="min-w-full divide-y divide-slate-100 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-4 py-3">Dispatch</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3 text-right">Credit</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{query.isLoading ? <tr><td colSpan={6} className="px-4 py-8 text-center font-bold text-slate-500">Loading...</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center font-bold text-slate-500">No records found.</td></tr> : filtered.map((row) => <tr key={row.id}><td className="px-4 py-3"><Link to={'/credit-dispatch/view?id=' + row.id} className="font-black text-blue-700">{row.dispatch_no}</Link></td><td className="px-4 py-3 font-bold">{row.branch}</td><td className="px-4 py-3"><p className="font-black">{row.customer_name}</p><p className="text-slate-500">{row.mobile_no}</p></td><td className="px-4 py-3 text-right font-black">{formatMoney(row.credit_amount)}</td><td className="px-4 py-3 text-right font-black text-red-700">{formatMoney(row.balance_amount)}</td><td className="px-4 py-3 font-bold">{row.approval_status} / {row.recovery_status}</td></tr>)}</tbody></table></div>
    </div>
  );
}
