import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText } from 'lucide-react';
import { formatMoney } from '../../services/creditDispatch.service';
import { getCreditCustomerLedger, riskTone } from '../../services/creditCustomer.service';

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-medium uppercase tracking-[0.13em] text-slate-400">{label}</p><p className="mt-1 text-lg font-semibold text-slate-900">{value}</p></div>;
}

export function CreditCustomerLedgerPage() {
  const customerId = new URLSearchParams(window.location.search).get('id') ?? '';
  const query = useQuery({ queryKey: ['credit-customer-ledger', customerId], queryFn: () => getCreditCustomerLedger(customerId), enabled: Boolean(customerId) });

  if (!customerId) return <div className="rounded-3xl bg-red-50 p-6 text-sm font-medium text-red-700">Missing customer id.</div>;
  if (query.isLoading) return <div className="rounded-3xl bg-white p-6 text-sm font-medium text-slate-500">Loading ledger...</div>;
  if (query.error || !query.data) return <div className="rounded-3xl bg-red-50 p-6 text-sm font-medium text-red-700">Unable to load customer ledger.</div>;

  const { summary, ledger } = query.data;

  return (
    <div data-cd-theme="ledger" className="cd-shell mx-auto max-w-7xl space-y-4 pb-20">
      <div className="cd-hero rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <Link to="/credit-dispatch/customers" className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-slate-500"><ArrowLeft className="h-4 w-4" />Back</Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[11px] font-medium uppercase tracking-[0.15em] text-blue-600">Customer Ledger</p><p className="mt-1 text-lg font-semibold text-slate-900">{summary.customer_name}</p><p className="mt-1 text-sm font-medium text-slate-500">{summary.mobile_no} • {summary.default_branch ?? '-'}</p></div><span className={`w-fit rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.1em] ${riskTone(summary.risk_category)}`}>{summary.risk_category}</span></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Total Credit" value={formatMoney(summary.total_credit)} /><Stat label="Received" value={formatMoney(summary.total_received)} /><Stat label="Outstanding" value={formatMoney(summary.outstanding)} /><Stat label="Overdue" value={formatMoney(summary.overdue)} /></div>
      <div className="grid gap-3 xl:hidden">{ledger.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-medium text-slate-500">No approved ledger entries yet.</div> : ledger.map((row) => <article key={`${row.entry_type}-${row.dispatch_id}-${row.sort_at}`} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{row.entry_type}</p><p className="mt-1 text-xs font-medium text-slate-500">{formatDate(row.transaction_date)} • {row.branch}</p></div><FileText className="h-4 w-4 text-blue-500" /></div><p className="mt-3 text-xs font-medium text-slate-500">{row.particulars}</p><div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center"><div><p className="text-[10px] uppercase text-slate-400">Debit</p><p className="text-xs font-semibold text-red-700">{formatMoney(row.debit)}</p></div><div><p className="text-[10px] uppercase text-slate-400">Credit</p><p className="text-xs font-semibold text-emerald-700">{formatMoney(row.credit)}</p></div><div><p className="text-[10px] uppercase text-slate-400">Balance</p><p className="text-xs font-semibold text-slate-900">{formatMoney(row.balance)}</p></div></div></article>)}</div>
      <div className="hidden overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm xl:block"><table className="min-w-full divide-y divide-slate-100 text-left text-xs"><thead className="bg-slate-50 text-[10px] font-medium uppercase tracking-[0.13em] text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Particulars</th><th className="px-4 py-3">Document</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th><th className="px-4 py-3 text-right">Balance</th></tr></thead><tbody className="divide-y divide-slate-100">{ledger.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm font-medium text-slate-500">No approved ledger entries yet.</td></tr> : ledger.map((row) => <tr key={`${row.entry_type}-${row.dispatch_id}-${row.sort_at}`} className="hover:bg-slate-50"><td className="px-4 py-3 font-medium text-slate-600">{formatDate(row.transaction_date)}</td><td className="px-4 py-3"><p className="font-semibold text-slate-900">{row.entry_type}</p><p className="text-slate-500">{row.particulars}</p></td><td className="px-4 py-3 font-medium text-slate-600">{row.document_type} {row.document_no || ''}</td><td className="px-4 py-3 font-medium text-slate-600">{row.branch}</td><td className="px-4 py-3 text-right font-semibold text-red-700">{formatMoney(row.debit)}</td><td className="px-4 py-3 text-right font-semibold text-emerald-700">{formatMoney(row.credit)}</td><td className="px-4 py-3 text-right font-semibold text-slate-900">{formatMoney(row.balance)}</td></tr>)}</tbody></table></div>
    </div>
  );
}
