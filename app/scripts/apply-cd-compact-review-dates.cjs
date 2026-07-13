const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/features/credit-dispatch/CreditDispatchListPage.tsx');
let source = fs.readFileSync(filePath, 'utf8');

const rowActionsPattern = /function RowActions\([\s\S]*?\n}\n\nfunction DispatchCard/;
const rowActionsReplacement = `function RowActions({ row, canManage, canPay, isBusy, onApproval, onPayment, compact }: ActionProps) {
  const progressStatus = getCreditDispatchProgressStatus(row);
  const showApproval = canManage && progressStatus === 'Pending Approval';
  const showPayment = canPay && isCreditDispatchPaymentStage(progressStatus);
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

function DispatchCard`;

if (!source.includes('className="cd-review-menu"')) {
  if (!rowActionsPattern.test(source)) throw new Error('RowActions block not found');
  source = source.replace(rowActionsPattern, rowActionsReplacement);
}

const desktopTablePattern = /function DesktopTable\([\s\S]*?\n}\n\nexport function CreditDispatchListPage/;
const desktopTableReplacement = `function formatCreatedAt(value: string) {
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
  if (days < 0) return { label: \`Overdue by \${Math.abs(days)} day\${Math.abs(days) === 1 ? '' : 's'}\`, tone: 'text-red-700' };
  if (days === 0) return { label: 'Due today', tone: 'text-orange-700' };
  if (days <= 7) return { label: \`Due in \${days} day\${days === 1 ? '' : 's'}\`, tone: 'text-amber-700' };
  return { label: \`Due in \${days} days\`, tone: 'text-slate-600' };
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
            return <tr key={row.id} className="align-top hover:bg-slate-50/70"><td className="px-4 py-3"><p className="font-black text-slate-900">{row.dispatch_no ?? 'Pending No.'}</p><p className="mt-1 font-bold text-slate-500">{row.branch}</p></td><td className="px-4 py-3"><p className="font-black text-slate-800">{row.customer_name}</p><p className="mt-1 text-slate-500">{row.mobile_no} • {row.customer_type}</p></td><td className="px-4 py-3"><p className="font-bold text-slate-800">{row.document_type}</p><p className="mt-1 text-slate-500">{row.document_no || '-'}</p></td><td className="px-4 py-3 text-right font-black text-slate-900">{formatMoney(row.credit_amount)}</td><td className="px-4 py-3 text-right font-black text-red-700">{formatMoney(row.balance_amount)}</td><td className="px-4 py-3"><p className="font-medium text-slate-700">{created.date}</p><p className="mt-1 text-[11px] text-slate-500">{created.time}</p></td><td className="px-4 py-3 font-medium text-slate-700">{row.due_date}</td><td className={\`px-4 py-3 font-semibold whitespace-nowrap \${due.tone}\`}>{due.label}</td><td className="px-4 py-3"><span className={\`inline-flex rounded-full border px-2 py-1 text-[10px] font-black \${statusClass(status)}\`}>{status}</span></td><td className="min-w-[118px] px-4 py-3"><RowActions row={row} {...actionProps} compact /></td></tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CreditDispatchListPage`;

if (!source.includes('function getDueInDays')) {
  if (!desktopTablePattern.test(source)) throw new Error('DesktopTable block not found');
  source = source.replace(desktopTablePattern, desktopTableReplacement);
}

fs.writeFileSync(filePath, source);
console.log('Compact Credit Dispatch review menu and date columns applied.');
