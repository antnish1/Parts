import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { formatMoney, getCreditDispatches } from '../../services/creditDispatch.service';

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p><p className="mt-2 text-xl font-black text-slate-950">{value}</p></div>;
}

const statuses = ['All', 'Pending Approval', 'Approved', 'Correction Required', 'Rejected', 'Pending Payment', 'Partial Payment', 'Partial Payment - Overdue', 'Payment Overdue', 'Closed'];

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function RequestReportsPage() {
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('All');
  const [status, setStatus] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const query = useQuery({ queryKey: ['credit-dispatches'], queryFn: getCreditDispatches, refetchInterval: 30000 });
  const rows = query.data ?? [];
  const branches = useMemo(() => ['All', ...Array.from(new Set(rows.map((row) => row.branch))).sort()], [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const createdDate = row.created_at?.slice(0, 10) ?? '';
      if (branch !== 'All' && row.branch !== branch) return false;
      if (status !== 'All' && row.approval_status !== status && row.recovery_status !== status) return false;
      if (fromDate && createdDate < fromDate) return false;
      if (toDate && createdDate > toDate) return false;
      if (!q) return true;
      return [row.dispatch_no, row.branch, row.customer_name, row.mobile_no, row.document_type, row.document_no, row.approval_status, row.recovery_status].some((value) => String(value ?? '').toLowerCase().includes(q));
    });
  }, [rows, search, branch, status, fromDate, toDate]);
  const totalCredit = filtered.reduce((sum, row) => sum + Number(row.credit_amount || 0), 0);
  const totalReceived = filtered.reduce((sum, row) => sum + Number(row.total_received_amount || 0), 0);
  const totalBalance = filtered.reduce((sum, row) => sum + Number(row.balance_amount || 0), 0);
  const overdueRows = filtered.filter((row) => row.recovery_status.includes('Overdue'));
  const dueSoonRows = filtered.filter((row) => {
    if (row.recovery_status === 'Closed') return false;
    const daysLeft = Math.ceil((new Date(row.due_date).getTime() - Date.now()) / 86400000);
    return daysLeft >= 0 && daysLeft <= 7;
  });

  function exportCsv() {
    const header = ['Dispatch No', 'Branch', 'Customer', 'Mobile', 'Document Type', 'Document No', 'Credit', 'Received', 'Balance', 'Due Date', 'Approval Status', 'Recovery Status'];
    const lines = filtered.map((row) => [row.dispatch_no, row.branch, row.customer_name, row.mobile_no, row.document_type, row.document_no, row.credit_amount, row.total_received_amount, row.balance_amount, row.due_date, row.approval_status, row.recovery_status].map(csvCell).join(','));
    const blob = new Blob([[header.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credit-dispatch-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div data-cd-theme="reports" className="cd-shell cd-reports mx-auto max-w-7xl space-y-4 pb-20">
      <div className="cd-hero rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><Link to="/credit-dispatch" className="mb-2 inline-flex items-center gap-2 text-sm font-black text-slate-500"><ArrowLeft className="h-4 w-4" />Back</Link><p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Credit Dispatch</p><h1 className="text-xl font-black text-slate-950">Reports</h1><p className="mt-1 text-sm font-semibold text-slate-500">Branch, status, due date and overdue recovery reporting.</p></div><Button type="button" onClick={exportCsv} disabled={filtered.length === 0}><Download className="h-4 w-4" />Export CSV</Button></div></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Stat label="Credit" value={formatMoney(totalCredit)} /><Stat label="Received" value={formatMoney(totalReceived)} /><Stat label="Balance" value={formatMoney(totalBalance)} /><Stat label="Overdue" value={String(overdueRows.length)} /><Stat label="Due in 7 Days" value={String(dueSoonRows.length)} /></div>
      <div className="grid gap-2 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm lg:grid-cols-[1fr_160px_210px_150px_150px]"><label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"><Search className="h-4 w-4 text-slate-400" /><input className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reports..." /></label><select className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold" value={branch} onChange={(event) => setBranch(event.target.value)}>{branches.map((item) => <option key={item} value={item}>{item}</option>)}</select><select className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold" value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select><input type="date" className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><input type="date" className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div>
      <div className="grid gap-3 lg:grid-cols-2"><section className="rounded-3xl border border-red-200 bg-red-50 p-4"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-red-700">Overdue follow-up</h2><div className="mt-3 space-y-2">{overdueRows.length === 0 ? <p className="text-sm font-bold text-red-700/70">No overdue records in this filter.</p> : overdueRows.slice(0, 8).map((row) => <Link key={row.id} to={'/credit-dispatch/view?id=' + row.id} className="block rounded-2xl bg-white p-3 text-sm font-bold text-red-800">{row.dispatch_no} • {row.customer_name} • {formatMoney(row.balance_amount)}</Link>)}</div></section><section className="rounded-3xl border border-amber-200 bg-amber-50 p-4"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-amber-700">Due in 7 days</h2><div className="mt-3 space-y-2">{dueSoonRows.length === 0 ? <p className="text-sm font-bold text-amber-700/70">No due-soon records in this filter.</p> : dueSoonRows.slice(0, 8).map((row) => <Link key={row.id} to={'/credit-dispatch/view?id=' + row.id} className="block rounded-2xl bg-white p-3 text-sm font-bold text-amber-800">{row.dispatch_no} • {row.customer_name} • Due {row.due_date}</Link>)}</div></section></div>
      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm"><table className="min-w-full divide-y divide-slate-100 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-4 py-3">Dispatch</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3 text-right">Credit</th><th className="px-4 py-3 text-right">Received</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{query.isLoading ? <tr><td colSpan={8} className="px-4 py-8 text-center font-bold text-slate-500">Loading...</td></tr> : filtered.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center font-bold text-slate-500">No records found.</td></tr> : filtered.map((row) => <tr key={row.id}><td className="px-4 py-3"><Link to={'/credit-dispatch/view?id=' + row.id} className="font-black text-blue-700">{row.dispatch_no}</Link></td><td className="px-4 py-3 font-bold">{row.branch}</td><td className="px-4 py-3"><p className="font-black">{row.customer_name}</p><p className="text-slate-500">{row.mobile_no}</p></td><td className="px-4 py-3 text-right font-black">{formatMoney(row.credit_amount)}</td><td className="px-4 py-3 text-right font-black text-emerald-700">{formatMoney(row.total_received_amount)}</td><td className="px-4 py-3 text-right font-black text-red-700">{formatMoney(row.balance_amount)}</td><td className="px-4 py-3 font-bold">{row.due_date}</td><td className="px-4 py-3 font-bold">{row.approval_status} / {row.recovery_status}</td></tr>)}</tbody></table></div>
    </div>
  );
}
