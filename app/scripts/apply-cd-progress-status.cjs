const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function patch(relativePath, transforms) {
  const filePath = path.join(root, relativePath);
  let source = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [from, to] of transforms) {
    if (source.includes(to)) continue;
    if (!source.includes(from)) throw new Error(`Pattern not found in ${relativePath}: ${from.slice(0, 100)}`);
    source = source.replace(from, to);
    changed = true;
  }

  if (changed) fs.writeFileSync(filePath, source);
}

patch('src/features/credit-dispatch/CreditDispatchListPage.tsx', [
  [
    "} from '../../services/creditDispatch.service';",
    "} from '../../services/creditDispatch.service';\nimport { creditDispatchProgressStatuses, getCreditDispatchProgressStatus, isCreditDispatchOverdue, isCreditDispatchPaymentStage } from '../../services/creditDispatchProgress';",
  ],
  [
    "  const showApproval = canManage && row.approval_status === 'Pending Approval';\n  const showPayment = canPay && row.approval_status === 'Approved' && row.recovery_status !== 'Closed';",
    "  const progressStatus = getCreditDispatchProgressStatus(row);\n  const showApproval = canManage && progressStatus === 'Pending Approval';\n  const showPayment = canPay && isCreditDispatchPaymentStage(progressStatus);",
  ],
  [
    "  const isOverdue = row.recovery_status.includes('Overdue');",
    "  const progressStatus = getCreditDispatchProgressStatus(row);\n  const isOverdue = isCreditDispatchOverdue(progressStatus);",
  ],
  [
    "${statusClass(row.recovery_status)}`}>{row.recovery_status}</span>",
    "${statusClass(progressStatus)}`}>{progressStatus}</span>",
  ],
  [
    "<div className=\"space-y-1.5\"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black ${statusClass(row.approval_status)}`}>{row.approval_status}</span><br /><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black ${statusClass(row.recovery_status)}`}>{row.recovery_status}</span></div>",
    "<span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black ${statusClass(getCreditDispatchProgressStatus(row))}`}>{getCreditDispatchProgressStatus(row)}</span>",
  ],
  [
    "  const overdueCount = rows.filter((row) => row.recovery_status.includes('Overdue')).length;\n  const closedCount = rows.filter((row) => row.recovery_status === 'Closed').length;",
    "  const overdueCount = rows.filter((row) => isCreditDispatchOverdue(getCreditDispatchProgressStatus(row))).length;\n  const closedCount = rows.filter((row) => getCreditDispatchProgressStatus(row) === 'Closed').length;",
  ],
  [
    "      const matchesStatus = statusFilter === 'All' || row.approval_status === statusFilter || row.recovery_status === statusFilter;\n      const matchesSearch = !q || [row.dispatch_no, row.branch, row.customer_name, row.customer_type, row.mobile_no, row.document_type, row.document_no, row.approval_status, row.recovery_status, row.credit_amount, row.balance_amount].some((value) => String(value ?? '').toLowerCase().includes(q));",
    "      const progressStatus = getCreditDispatchProgressStatus(row);\n      const matchesStatus = statusFilter === 'All' || progressStatus === statusFilter;\n      const matchesSearch = !q || [row.dispatch_no, row.branch, row.customer_name, row.customer_type, row.mobile_no, row.document_type, row.document_no, progressStatus, row.credit_amount, row.balance_amount].some((value) => String(value ?? '').toLowerCase().includes(q));",
  ],
  [
    "{['All', 'Pending Approval', 'Approved', 'Correction Required', 'Rejected', 'Pending Payment', 'Partial Payment', 'Partial Payment - Overdue', 'Payment Overdue', 'Closed'].map((status) => <option key={status} value={status}>{status}</option>)}",
    "{['All', ...creditDispatchProgressStatuses].map((status) => <option key={status} value={status}>{status}</option>)}",
  ],
  [
    "<div className=\"mx-auto max-w-7xl space-y-4 pb-20 xl:pb-0\">",
    "<div data-cd-theme=\"tracker\" className=\"cd-shell cd-tracker mx-auto max-w-7xl space-y-4 pb-20 xl:pb-0\">",
  ],
]);

patch('src/features/credit-dispatch/RequestReportsPage.tsx', [
  [
    "import { formatMoney, getCreditDispatches } from '../../services/creditDispatch.service';",
    "import { formatMoney, getCreditDispatches } from '../../services/creditDispatch.service';\nimport { creditDispatchProgressStatuses, getCreditDispatchProgressStatus, isCreditDispatchOverdue } from '../../services/creditDispatchProgress';",
  ],
  [
    "const statuses = ['All', 'Pending Approval', 'Approved', 'Correction Required', 'Rejected', 'Pending Payment', 'Partial Payment', 'Partial Payment - Overdue', 'Payment Overdue', 'Closed'];",
    "const statuses = ['All', ...creditDispatchProgressStatuses];",
  ],
  [
    "      if (status !== 'All' && row.approval_status !== status && row.recovery_status !== status) return false;",
    "      const progressStatus = getCreditDispatchProgressStatus(row);\n      if (status !== 'All' && progressStatus !== status) return false;",
  ],
  [
    "      return [row.dispatch_no, row.branch, row.customer_name, row.mobile_no, row.document_type, row.document_no, row.approval_status, row.recovery_status].some((value) => String(value ?? '').toLowerCase().includes(q));",
    "      return [row.dispatch_no, row.branch, row.customer_name, row.mobile_no, row.document_type, row.document_no, getCreditDispatchProgressStatus(row)].some((value) => String(value ?? '').toLowerCase().includes(q));",
  ],
  [
    "  const overdueRows = filtered.filter((row) => row.recovery_status.includes('Overdue'));",
    "  const overdueRows = filtered.filter((row) => isCreditDispatchOverdue(getCreditDispatchProgressStatus(row)));",
  ],
  [
    "    if (row.recovery_status === 'Closed') return false;",
    "    if (getCreditDispatchProgressStatus(row) === 'Closed') return false;",
  ],
  [
    "const header = ['Dispatch No', 'Branch', 'Customer', 'Mobile', 'Document Type', 'Document No', 'Credit', 'Received', 'Balance', 'Due Date', 'Approval Status', 'Recovery Status'];",
    "const header = ['Dispatch No', 'Branch', 'Customer', 'Mobile', 'Document Type', 'Document No', 'Credit', 'Received', 'Balance', 'Due Date', 'Progress Status'];",
  ],
  [
    "[row.dispatch_no, row.branch, row.customer_name, row.mobile_no, row.document_type, row.document_no, row.credit_amount, row.total_received_amount, row.balance_amount, row.due_date, row.approval_status, row.recovery_status]",
    "[row.dispatch_no, row.branch, row.customer_name, row.mobile_no, row.document_type, row.document_no, row.credit_amount, row.total_received_amount, row.balance_amount, row.due_date, getCreditDispatchProgressStatus(row)]",
  ],
  [
    "{row.approval_status} / {row.recovery_status}",
    "{getCreditDispatchProgressStatus(row)}",
  ],
]);

for (const relativePath of [
  'src/features/credit-dispatch/CreditDispatchDetailPage.tsx',
  'src/features/credit-dispatch/CreditDispatchViewPage.tsx',
]) {
  patch(relativePath, [
    [
      "import { formatMoney } from '../../services/creditDispatch.service';",
      "import { formatMoney } from '../../services/creditDispatch.service';\nimport { getCreditDispatchProgressStatus } from '../../services/creditDispatchProgress';",
    ],
    [
      "value={`${dispatch.approval_status} / ${dispatch.recovery_status}`}",
      "value={getCreditDispatchProgressStatus(dispatch)}",
    ],
  ]);
}

console.log('Credit Dispatch progressive status patch applied.');
