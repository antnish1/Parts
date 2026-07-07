import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, CheckCircle2, Clock, CreditCard, FileSignature, IndianRupee, Plus, RotateCcw, Search, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../auth/useAuth';
import {
  addCreditDispatchPayment,
  getCreditDispatches,
  formatMoney,
  updateCreditDispatchApproval,
  type CreditDispatchApprovalAction,
  type CreditDispatchPaymentInput,
  type CreditDispatchRecord,
} from '../../services/creditDispatch.service';

const today = new Date().toISOString().slice(0, 10);
const paymentModes = ['Cash', 'UPI', 'Bank', 'Cheque', 'Adjustment', 'Other'] as const;

function statusClass(status: string) {
  if (status === 'Closed') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status.includes('Overdue')) return 'bg-red-100 text-red-700 border-red-200';
  if (status.includes('Partial')) return 'bg-amber-100 text-amber-700 border-amber-200';
  if (status === 'Approved') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (status === 'Rejected') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (status === 'Correction Required') return 'bg-orange-100 text-orange-700 border-orange-200';
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

type DispatchCardProps = {
  row: CreditDispatchRecord;
  canManage: boolean;
  canPay: boolean;
  isBusy: boolean;
  onApproval: (row: CreditDispatchRecord, action: CreditDispatchApprovalAction) => void;
  onPayment: (row: CreditDispatchRecord) => void;
};

function DispatchCard({ row, canManage, canPay, isBusy, onApproval, onPayment }: DispatchCardProps) {
  const isOverdue = row.recovery_status.includes('Overdue');
  const showApprovalActions = canManage && row.approval_status === 'Pending Approval';
  const showPaymentAction = canPay && row.approval_status === 'Approved' && row.recovery_status !== 'Closed';

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

      {row.rejection_reason ? <p className="mt-3 rounded-2xl bg-red-50 p-3 text-xs font-bold text-red-700">Rejected: {row.rejection_reason}</p> : null}
      {row.correction_note ? <p className="mt-3 rounded-2xl bg-orange-50 p-3 text-xs font-bold text-orange-700">Correction: {row.correction_note}</p> : null}

      {showApprovalActions ? (
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
          <Button type="button" className="rounded-2xl px-2 py-2 text-[11px]" disabled={isBusy} onClick={() => onApproval(row, 'Approved')}>
            <Check className="h-3.5 w-3.5" />
            Approve
          </Button>
          <Button type="button" variant="danger" className="rounded-2xl px-2 py-2 text-[11px]" disabled={isBusy} onClick={() => onApproval(row, 'Rejected')}>
            <XCircle className="h-3.5 w-3.5" />
            Reject
          </Button>
          <Button type="button" variant="secondary" className="rounded-2xl px-2 py-2 text-[11px]" disabled={isBusy} onClick={() => onApproval(row, 'Correction Required')}>
            <RotateCcw className="h-3.5 w-3.5" />
            Correct
          </Button>
        </div>
      ) : null}

      {showPaymentAction ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <Button type="button" className="w-full rounded-2xl" disabled={isBusy} onClick={() => onPayment(row)}>
            <IndianRupee className="h-4 w-4" />
            Add Received Payment
          </Button>
        </div>
      ) : null}
    </article>
  );
}

export function CreditDispatchListPage() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const dispatchQuery = useQuery({
    queryKey: ['credit-dispatches'],
    queryFn: getCreditDispatches,
    refetchInterval: 30000,
  });

  const approvalMutation = useMutation({
    mutationFn: (input: { id: string; action: CreditDispatchApprovalAction; note: string }) => updateCreditDispatchApproval(input.id, input.action, input.note, profile?.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credit-dispatches'] });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: (input: CreditDispatchPaymentInput) => addCreditDispatchPayment(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credit-dispatches'] });
    },
  });

  const rows = dispatchQuery.data ?? [];
  const totalCredit = rows.reduce((sum, row) => sum + Number(row.credit_amount || 0), 0);
  const totalBalance = rows.reduce((sum, row) => sum + Number(row.balance_amount || 0), 0);
  const overdueCount = rows.filter((row) => row.recovery_status.includes('Overdue')).length;
  const closedCount = rows.filter((row) => row.recovery_status === 'Closed').length;

  const canManage = ['manager', 'admin', 'developer', 'super'].includes(profile?.role ?? '');
  const canPay = ['branch', 'manager', 'admin', 'developer', 'super'].includes(profile?.role ?? '');
  const isBusy = approvalMutation.isPending || paymentMutation.isPending;

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === 'All' || row.approval_status === statusFilter || row.recovery_status === statusFilter;
      const matchesSearch = !normalizedSearch || [
        row.dispatch_no,
        row.branch,
        row.customer_name,
        row.customer_type,
        row.mobile_no,
        row.document_type,
        row.document_no,
        row.approval_status,
        row.recovery_status,
        row.credit_amount,
        row.balance_amount,
      ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch));
      return matchesStatus && matchesSearch;
    });
  }, [rows, searchText, statusFilter]);

  function handleApproval(row: CreditDispatchRecord, action: CreditDispatchApprovalAction) {
    let note = '';
    if (action === 'Approved') {
      if (!window.confirm(`Approve ${row.dispatch_no ?? row.customer_name}?`)) return;
      note = 'Approved by manager.';
    } else {
      const entered = window.prompt(action === 'Rejected' ? 'Enter rejection reason:' : 'Enter correction note:');
      if (!entered?.trim()) return;
      note = entered.trim();
    }
    approvalMutation.mutate({ id: row.id, action, note });
  }

  function handlePayment(row: CreditDispatchRecord) {
    const amountText = window.prompt(`Received amount? Balance is ${formatMoney(row.balance_amount)}`);
    if (!amountText) return;
    const receivedAmount = Number(amountText.replace(/,/g, ''));
    if (!receivedAmount || receivedAmount <= 0) {
      alert('Enter a valid received amount.');
      return;
    }

    const receivedDate = window.prompt('Received date (YYYY-MM-DD):', today) || today;
    const modeInput = window.prompt('Payment mode: Cash / UPI / Bank / Cheque / Adjustment / Other', 'UPI') || 'UPI';
    const paymentMode = paymentModes.find((mode) => mode.toLowerCase() === modeInput.trim().toLowerCase()) ?? 'Other';
    const referenceNo = window.prompt('Reference no. / UTR / Cheque no. (optional):') || '';
    const remarks = window.prompt('Payment remarks (optional):') || '';

    paymentMutation.mutate({
      dispatchId: row.id,
      receivedAmount,
      receivedDate,
      paymentMode,
      referenceNo,
      remarks,
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Credit Dispatch</p>
          <h1 className="mt-1 text-xl font-black text-slate-950">Payment Recovery Tracker</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">Approve requests, record payments, and track pending receipts.</p>
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
        <div className="mb-3 grid gap-2 md:grid-cols-[1fr_220px]">
          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">
            <Search className="h-4 w-4" />
            <input className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search dispatch, customer, mobile, branch, document..." />
          </label>
          <select className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {['All', 'Pending Approval', 'Approved', 'Correction Required', 'Rejected', 'Pending Payment', 'Partial Payment', 'Partial Payment - Overdue', 'Payment Overdue', 'Closed'].map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>

        {approvalMutation.error || paymentMutation.error ? (
          <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
            {((approvalMutation.error || paymentMutation.error) as Error).message || 'Could not complete action.'}
          </div>
        ) : null}

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
        ) : filteredRows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">No records match this search/filter.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredRows.map((row) => <DispatchCard key={row.id} row={row} canManage={canManage} canPay={canPay} isBusy={isBusy} onApproval={handleApproval} onPayment={handlePayment} />)}
          </div>
        )}
      </div>
    </div>
  );
}
