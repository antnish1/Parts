import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, CheckCircle2, Clock, CreditCard, FileSignature, IndianRupee, Plus, RotateCcw, Search, X, XCircle } from 'lucide-react';
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
import { creditDispatchProgressStatuses, getCreditDispatchProgressStatus, isCreditDispatchOverdue, isCreditDispatchPaymentStage } from '../../services/creditDispatchProgress';

const today = new Date().toISOString().slice(0, 10);
const paymentModes = ['Cash', 'UPI', 'Bank', 'Cheque', 'Adjustment', 'Other'] as const;
type PaymentMode = typeof paymentModes[number];

function statusClass(status: string) {
  if (status === 'Pending Accounts Approval' || status === 'Pending Manager Approval') return 'cd-status cd-status--pending-approval';
  if (status.startsWith('Correction Requested')) return 'cd-status cd-status--correction';
  if (status.startsWith('Rejected by')) return 'cd-status cd-status--rejected';
  if (status === 'Payment Pending') return 'cd-status cd-status--pending-payment';
  if (status === 'Partial Payment') return 'cd-status cd-status--partial';
  if (status === 'Payment Overdue') return 'cd-status cd-status--overdue';
  if (status === 'Partial Payment - Overdue') return 'cd-status cd-status--partial-overdue';
  if (status === 'Closed') return 'cd-status cd-status--closed';
  return 'cd-status cd-status--neutral';
}

type KpiKey = 'Pending Approval' | 'Overdue' | 'Pending Payment' | 'Rejected' | 'Closed' | 'Correction' | 'All';

function matchesKpi(row: CreditDispatchRecord, key: KpiKey) {
  const status = getCreditDispatchProgressStatus(row);
  if (key === 'All') return true;
  if (key === 'Pending Approval') return status === 'Pending Accounts Approval' || status === 'Pending Manager Approval';
  if (key === 'Overdue') return status === 'Payment Overdue' || status === 'Partial Payment - Overdue';
  if (key === 'Pending Payment') return status === 'Payment Pending' || status === 'Partial Payment';
  if (key === 'Rejected') return status === 'Rejected by Accounts' || status === 'Rejected by Manager';
  if (key === 'Closed') return status === 'Closed';
  return status === 'Correction Requested by Accounts' || status === 'Correction Requested by Manager';
}

function KpiCard({ label, count, amount, icon: Icon, selected, onClick }: { label: KpiKey; count: number; amount: number; icon: typeof CreditCard; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`w-full rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[10px] font-black uppercase tracking-[0.14em] ${selected ? 'text-blue-600' : 'text-slate-400'}`}>{label}</p>
          <p className="mt-1 text-xl font-black text-slate-950">{count}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{formatMoney(amount)}</p>
        </div>
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${selected ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}><Icon className="h-4 w-4" /></div>
      </div>
    </button>
  );
}

function Dialog({ title, description, children, onClose }: { title: string; description?: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center sm:justify-center" onMouseDown={onClose}>
      <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-4 shadow-2xl sm:max-w-lg sm:p-5" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">{title}</h2>
            {description ? <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p> : null}
          </div>
          <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ApprovalDialog({ row, action, isBusy, onClose, onSubmit }: { row: CreditDispatchRecord; action: CreditDispatchApprovalAction; isBusy: boolean; onClose: () => void; onSubmit: (note: string) => void }) {
  const approvalStage = row.approval_status === 'Pending Accounts Approval' ? 'Accounts' : 'Manager';
  const [note, setNote] = useState(action === 'Approved' ? `Approved by ${approvalStage}.` : '');
  const [error, setError] = useState('');
  const needsNote = action !== 'Approved';
  const actionText = action === 'Approved' ? 'Approve Request' : action === 'Rejected' ? 'Reject Request' : 'Send for Correction';

  function submit() {
    if (needsNote && !note.trim()) {
      setError(action === 'Rejected' ? 'Rejection reason is required.' : 'Correction note is required.');
      return;
    }
    onSubmit(note.trim() || actionText);
  }

  return (
    <Dialog title={actionText} description={`${row.dispatch_no ?? row.customer_name} • ${formatMoney(row.credit_amount)}`} onClose={onClose}>
      <div className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700">
        Customer: {row.customer_name}<br />Branch: {row.branch}<br />Document: {row.document_type} {row.document_no || ''}
      </div>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{needsNote ? 'Note / Reason' : 'Approval Note'}</span>
        <textarea className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Enter note" />
      </label>
      {error ? <p className="mt-2 rounded-2xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isBusy}>Cancel</Button>
        <Button type="button" variant={action === 'Rejected' ? 'danger' : 'primary'} onClick={submit} disabled={isBusy}>{isBusy ? 'Saving...' : actionText}</Button>
      </div>
    </Dialog>
  );
}

function PaymentDialog({ row, isBusy, onClose, onSubmit }: { row: CreditDispatchRecord; isBusy: boolean; onClose: () => void; onSubmit: (input: CreditDispatchPaymentInput) => void }) {
  const [receivedAmount, setReceivedAmount] = useState('');
  const [receivedDate, setReceivedDate] = useState(today);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');
  const [referenceNo, setReferenceNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const inputClass = 'w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100';

  function submit() {
    const amount = Number(receivedAmount);
    if (!amount || amount <= 0) {
      setError('Enter a valid received amount.');
      return;
    }
    if (amount > Number(row.balance_amount)) {
      setError('Received amount cannot be greater than balance amount.');
      return;
    }
    if (!receivedDate) {
      setError('Received date is required.');
      return;
    }
    onSubmit({ dispatchId: row.id, receivedAmount: amount, receivedDate, paymentMode, referenceNo, remarks });
  }

  return (
    <Dialog title="Add Received Payment" description={`${row.dispatch_no ?? row.customer_name} • Balance ${formatMoney(row.balance_amount)}`} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Received Amount</span>
          <input className={inputClass} type="number" min="0" max={row.balance_amount} value={receivedAmount} onChange={(event) => setReceivedAmount(event.target.value)} placeholder="0" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Received Date</span>
          <input className={inputClass} type="date" value={receivedDate} onChange={(event) => setReceivedDate(event.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Payment Mode</span>
          <select className={inputClass} value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as PaymentMode)}>{paymentModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Reference No.</span>
          <input className={inputClass} value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} placeholder="UTR / Cheque No. / Receipt No." />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Remarks</span>
          <textarea className={`${inputClass} min-h-24`} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Optional remarks" />
        </label>
      </div>
      {error ? <p className="mt-3 rounded-2xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={isBusy}>Cancel</Button>
        <Button type="button" onClick={submit} disabled={isBusy}>{isBusy ? 'Saving...' : 'Save Payment'}</Button>
      </div>
    </Dialog>
  );
}

type ActionProps = { row: CreditDispatchRecord; currentRole: string; canPay: boolean; canCorrect: boolean; currentBranch: string; isBusy: boolean; onApproval: (row: CreditDispatchRecord, action: CreditDispatchApprovalAction) => void; onPayment: (row: CreditDispatchRecord) => void; compact?: boolean };

function normalizeActionBranch(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function canReviewStage(row: CreditDispatchRecord, role: string) {
  if (role === 'developer') return row.approval_status === 'Pending Accounts Approval' || row.approval_status === 'Pending Manager Approval';
  if (role === 'accounts') return row.approval_status === 'Pending Accounts Approval';
  if (role === 'manager') return row.approval_status === 'Pending Manager Approval';
  return false;
}

function RowActions({ row, currentRole, canPay, canCorrect, currentBranch, isBusy, onApproval, onPayment, compact }: ActionProps) {
  const progressStatus = getCreditDispatchProgressStatus(row);
  const showCorrection = canCorrect && ['Correction Requested by Accounts', 'Correction Requested by Manager'].includes(row.approval_status) && normalizeActionBranch(row.branch) === normalizeActionBranch(currentBranch);
  const showApproval = canReviewStage(row, currentRole);
  const showPayment = canPay && isCreditDispatchPaymentStage(progressStatus);

  if (showCorrection) return <Link to={`/credit-dispatch/${row.id}/edit`}><Button type="button" className={compact ? 'cd-action cd-action--correct px-3 py-1.5 text-xs' : 'cd-action cd-action--correct w-full'}><RotateCcw className="h-4 w-4" />Edit & Resubmit</Button></Link>;
  if (!showApproval && !showPayment) return <span className="text-xs font-medium text-slate-400">—</span>;
  if (showPayment) return <Button type="button" className={compact ? 'cd-action cd-action--payment px-3 py-1.5 text-xs' : 'cd-action cd-action--payment w-full rounded-2xl'} disabled={isBusy} onClick={() => onPayment(row)}><IndianRupee className="h-4 w-4" />Add Payment</Button>;

  if (compact) {
    return (
      <details className="cd-review-menu">
        <summary className="cd-review-trigger" aria-label="Review approval actions">Review <span aria-hidden="true">▾</span></summary>
        <div className="cd-review-panel">
          <button type="button" className="cd-review-option cd-review-option--approve" disabled={isBusy} onClick={() => onApproval(row, 'Approved')}><Check className="h-3.5 w-3.5" />Approve</button>
          <button type="button" className="cd-review-option cd-review-option--reject" disabled={isBusy} onClick={() => onApproval(row, 'Rejected')}><XCircle className="h-3.5 w-3.5" />Reject</button>
          <button type="button" className="cd-review-option cd-review-option--correct" disabled={isBusy} onClick={() => onApproval(row, 'Correction Required')}><RotateCcw className="h-3.5 w-3.5" />Send for Correction</button>
        </div>
      </details>
    );
  }

  return (
    <div className="cd-row-actions grid grid-cols-3 gap-2">
      <Button type="button" className="cd-action cd-action--approve px-2 py-1.5 text-[11px]" disabled={isBusy} onClick={() => onApproval(row, 'Approved')}><Check className="h-3.5 w-3.5" />Approve</Button>
      <Button type="button" variant="danger" className="cd-action cd-action--reject px-2 py-1.5 text-[11px]" disabled={isBusy} onClick={() => onApproval(row, 'Rejected')}><XCircle className="h-3.5 w-3.5" />Reject</Button>
      <Button type="button" variant="secondary" className="cd-action cd-action--correct px-2 py-1.5 text-[11px]" disabled={isBusy} onClick={() => onApproval(row, 'Correction Required')}><RotateCcw className="h-3.5 w-3.5" />Correct</Button>
    </div>
  );
}

function DispatchCard(props: ActionProps) {
  const { row } = props;
  const progressStatus = getCreditDispatchProgressStatus(row);
  const isOverdue = isCreditDispatchOverdue(progressStatus);
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="truncate text-sm font-black text-slate-950">{row.dispatch_no ?? 'Pending No.'}</p><p className="mt-1 truncate text-xs font-semibold text-slate-500">{row.branch} • {row.customer_type}</p></div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${statusClass(progressStatus)}`}>{progressStatus}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Customer</p><p className="mt-1 truncate font-bold text-slate-800">{row.customer_name}</p><p className="text-xs font-semibold text-slate-500">{row.mobile_no}</p></div>
        <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Document</p><p className="mt-1 truncate font-bold text-slate-800">{row.document_type}</p><p className="text-xs font-semibold text-slate-500">{row.document_no || 'No document no.'}</p></div>
      </div>
      <div className="mt-4 rounded-2xl bg-slate-50 p-3"><div className="grid grid-cols-3 gap-2 text-center"><div><p className="text-[10px] font-black uppercase text-slate-400">Credit</p><p className="text-sm font-black text-slate-950">{formatMoney(row.credit_amount)}</p></div><div><p className="text-[10px] font-black uppercase text-slate-400">Received</p><p className="text-sm font-black text-emerald-700">{formatMoney(row.total_received_amount)}</p></div><div><p className="text-[10px] font-black uppercase text-slate-400">Balance</p><p className="text-sm font-black text-red-700">{formatMoney(row.balance_amount)}</p></div></div></div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3"><div className="flex items-center gap-2 text-xs font-bold text-slate-500">{isOverdue ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <Clock className="h-4 w-4 text-blue-500" />}Due {row.due_date}</div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${statusClass(progressStatus)}`}>{progressStatus}</span></div>
      {row.rejection_reason ? <p className="mt-3 rounded-2xl bg-red-50 p-3 text-xs font-bold text-red-700">Rejected: {row.rejection_reason}</p> : null}
      {row.correction_note ? <p className="mt-3 rounded-2xl bg-orange-50 p-3 text-xs font-bold text-orange-700">Correction: {row.correction_note}</p> : null}
      <div className="mt-4 border-t border-slate-100 pt-3"><RowActions {...props} /></div>
    </article>
  );
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '-', time: '' };
  return {
    date: new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date),
    time: new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(date),
  };
}

function getDueInDays(row: CreditDispatchRecord) {
  if (getCreditDispatchProgressStatus(row) === 'Closed') return { label: 'Closed', tone: 'text-emerald-700' };
  const due = new Date(row.due_date + 'T00:00:00');
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - todayDate.getTime()) / 86400000);
  if (days < 0) return { label: `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`, tone: 'text-red-700' };
  if (days === 0) return { label: 'Due today', tone: 'text-orange-700' };
  if (days <= 7) return { label: `Due in ${days} day${days === 1 ? '' : 's'}`, tone: 'text-amber-700' };
  return { label: `Due in ${days} days`, tone: 'text-slate-600' };
}

function DesktopTable({ rows, actionProps }: { rows: CreditDispatchRecord[]; actionProps: Omit<ActionProps, 'row'> }) {
  return (
    <div className="hidden overflow-x-auto rounded-3xl border border-slate-200 xl:block">
      <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-4 py-3">Dispatch</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Document</th><th className="px-4 py-3 text-right">Credit</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3">Created On</th><th className="px-4 py-3">Due Date</th><th className="px-4 py-3">Due in Days</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => {
            const created = formatCreatedAt(row.created_at);
            const due = getDueInDays(row);
            const status = getCreditDispatchProgressStatus(row);
            return <tr key={row.id} className="align-top hover:bg-slate-50/70"><td className="px-4 py-3"><p className="font-black text-slate-900">{row.dispatch_no ?? 'Pending No.'}</p><p className="mt-1 font-bold text-slate-500">{row.branch}</p></td><td className="px-4 py-3"><p className="font-black text-slate-800">{row.customer_name}</p><p className="mt-1 text-slate-500">{row.mobile_no} • {row.customer_type}</p></td><td className="px-4 py-3"><p className="font-bold text-slate-800">{row.document_type}</p><p className="mt-1 text-slate-500">{row.document_no || '-'}</p></td><td className="px-4 py-3 text-right font-black text-slate-900">{formatMoney(row.credit_amount)}</td><td className="px-4 py-3 text-right font-black text-red-700">{formatMoney(row.balance_amount)}</td><td className="px-4 py-3"><p className="font-medium text-slate-700">{created.date}</p><p className="mt-1 text-[11px] text-slate-500">{created.time}</p></td><td className="px-4 py-3 font-medium text-slate-700">{row.due_date}</td><td className={`px-4 py-3 font-semibold whitespace-nowrap ${due.tone}`}>{due.label}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black ${statusClass(status)}`}>{status}</span></td><td className="min-w-[118px] px-4 py-3"><RowActions row={row} {...actionProps} compact /></td></tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CreditDispatchListPage() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [kpiFilter, setKpiFilter] = useState<KpiKey>('Pending Approval');
  const [approvalTarget, setApprovalTarget] = useState<{ row: CreditDispatchRecord; action: CreditDispatchApprovalAction } | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<CreditDispatchRecord | null>(null);

  const dispatchQuery = useQuery({ queryKey: ['credit-dispatches'], queryFn: getCreditDispatches, refetchInterval: 30000 });
  const approvalMutation = useMutation({ mutationFn: (input: { id: string; action: CreditDispatchApprovalAction; note: string }) => updateCreditDispatchApproval(input.id, input.action, input.note, profile?.id), onSuccess: async () => { setApprovalTarget(null); await queryClient.invalidateQueries({ queryKey: ['credit-dispatches'] }); } });
  const paymentMutation = useMutation({ mutationFn: (input: CreditDispatchPaymentInput) => addCreditDispatchPayment(input), onSuccess: async () => { setPaymentTarget(null); await queryClient.invalidateQueries({ queryKey: ['credit-dispatches'] }); } });

  const rows = dispatchQuery.data ?? [];
  const kpiData = useMemo(() => {
    const keys: KpiKey[] = ['Pending Approval', 'Overdue', 'Pending Payment', 'Rejected', 'Closed', 'Correction', 'All'];
    return Object.fromEntries(keys.map((key) => {
      const matchingRows = rows.filter((row) => matchesKpi(row, key));
      return [key, {
        count: matchingRows.length,
        amount: matchingRows.reduce((sum, row) => sum + Number(row.credit_amount || 0), 0),
      }];
    })) as Record<KpiKey, { count: number; amount: number }>;
  }, [rows]);
  const currentRole = profile?.role ?? '';
  const canPay = ['branch', 'manager', 'admin', 'developer', 'super'].includes(currentRole);
  const canCorrect = currentRole === 'branch';
  const isBusy = approvalMutation.isPending || paymentMutation.isPending;

  const filteredRows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return rows.filter((row) => {
      const progressStatus = getCreditDispatchProgressStatus(row);
      const matchesKpiFilter = matchesKpi(row, kpiFilter);
      const matchesStatus = statusFilter === 'All' || progressStatus === statusFilter;
      const matchesSearch = !q || [row.dispatch_no, row.branch, row.customer_name, row.customer_type, row.mobile_no, row.document_type, row.document_no, progressStatus, row.credit_amount, row.balance_amount].some((value) => String(value ?? '').toLowerCase().includes(q));
      return matchesKpiFilter && matchesStatus && matchesSearch;
    });
  }, [kpiFilter, rows, searchText, statusFilter]);

  const actionProps = { currentRole, canPay, canCorrect, currentBranch: profile?.branch ?? '', isBusy, onApproval: (row: CreditDispatchRecord, action: CreditDispatchApprovalAction) => setApprovalTarget({ row, action }), onPayment: (row: CreditDispatchRecord) => setPaymentTarget(row) };

  return (
    <div data-cd-theme="tracker" className="cd-shell cd-tracker mx-auto max-w-7xl space-y-4 pb-20 xl:pb-0">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Credit Dispatch</p><h1 className="mt-1 text-xl font-black text-slate-950">Payment Recovery Tracker</h1><p className="mt-1 text-sm font-semibold text-slate-500">Approve requests, record payments, and track pending receipts.</p></div>{currentRole === 'branch' ? <Link to="/credit-dispatch/new"><Button className="w-full sm:w-auto"><Plus className="h-4 w-4" />New Request</Button></Link> : null}</div>
      <div className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-3">
          <KpiCard label="Pending Approval" count={kpiData['Pending Approval'].count} amount={kpiData['Pending Approval'].amount} icon={Clock} selected={kpiFilter === 'Pending Approval'} onClick={() => { setKpiFilter('Pending Approval'); setStatusFilter('All'); }} />
          <KpiCard label="Overdue" count={kpiData.Overdue.count} amount={kpiData.Overdue.amount} icon={AlertTriangle} selected={kpiFilter === 'Overdue'} onClick={() => { setKpiFilter('Overdue'); setStatusFilter('All'); }} />
          <KpiCard label="Pending Payment" count={kpiData['Pending Payment'].count} amount={kpiData['Pending Payment'].amount} icon={IndianRupee} selected={kpiFilter === 'Pending Payment'} onClick={() => { setKpiFilter('Pending Payment'); setStatusFilter('All'); }} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Rejected" count={kpiData.Rejected.count} amount={kpiData.Rejected.amount} icon={XCircle} selected={kpiFilter === 'Rejected'} onClick={() => { setKpiFilter('Rejected'); setStatusFilter('All'); }} />
          <KpiCard label="Closed" count={kpiData.Closed.count} amount={kpiData.Closed.amount} icon={CheckCircle2} selected={kpiFilter === 'Closed'} onClick={() => { setKpiFilter('Closed'); setStatusFilter('All'); }} />
          <KpiCard label="Correction" count={kpiData.Correction.count} amount={kpiData.Correction.amount} icon={RotateCcw} selected={kpiFilter === 'Correction'} onClick={() => { setKpiFilter('Correction'); setStatusFilter('All'); }} />
          <KpiCard label="All" count={kpiData.All.count} amount={kpiData.All.amount} icon={CreditCard} selected={kpiFilter === 'All'} onClick={() => { setKpiFilter('All'); setStatusFilter('All'); }} />
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm"><div className="mb-3 grid gap-2 md:grid-cols-[1fr_220px]"><label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500"><Search className="h-4 w-4" /><input className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search dispatch, customer, mobile, branch, document..." /></label><select className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{['All', ...creditDispatchProgressStatuses].map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
        {approvalMutation.error || paymentMutation.error ? <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{((approvalMutation.error || paymentMutation.error) as Error).message || 'Could not complete action.'}</div> : null}
        {dispatchQuery.isLoading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-56 animate-pulse rounded-3xl bg-slate-100" />)}</div> : dispatchQuery.error ? <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">Could not load Credit Dispatch records.</div> : rows.length === 0 ? <div className="grid place-items-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center"><FileSignature className="h-10 w-10 text-blue-500" /><h2 className="mt-3 text-lg font-black text-slate-950">No credit dispatch yet</h2><p className="mt-1 max-w-md text-sm font-semibold text-slate-500">Create the first digitally signed credit dispatch request from branch login.</p>{currentRole === 'branch' ? <Link to="/credit-dispatch/new" className="mt-4"><Button><Plus className="h-4 w-4" />Create Request</Button></Link> : null}</div> : filteredRows.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">No records match this search/filter.</div> : <><DesktopTable rows={filteredRows} actionProps={actionProps} /><div className="grid gap-3 md:grid-cols-2 xl:hidden">{filteredRows.map((row) => <DispatchCard key={row.id} row={row} {...actionProps} />)}</div></>}
      </div>
      {approvalTarget ? <ApprovalDialog row={approvalTarget.row} action={approvalTarget.action} isBusy={isBusy} onClose={() => setApprovalTarget(null)} onSubmit={(note) => approvalMutation.mutate({ id: approvalTarget.row.id, action: approvalTarget.action, note })} /> : null}
      {paymentTarget ? <PaymentDialog row={paymentTarget} isBusy={isBusy} onClose={() => setPaymentTarget(null)} onSubmit={(input) => paymentMutation.mutate(input)} /> : null}
    </div>
  );
}
