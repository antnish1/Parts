const fs = require('fs');
const path = require('path');

function patch(filePath, from, to, label) {
  let source = fs.readFileSync(filePath, 'utf8');
  if (source.includes(to)) return;
  if (!source.includes(from)) {
    console.warn(`${label} marker not found; leaving existing generated markup unchanged`);
    return;
  }
  source = source.replace(from, to);
  fs.writeFileSync(filePath, source);
}

function patchRegex(filePath, regex, to, label) {
  let source = fs.readFileSync(filePath, 'utf8');
  if (source.includes(to)) return;
  if (!regex.test(source)) {
    console.warn(`${label} marker not found; leaving existing generated markup unchanged`);
    return;
  }
  source = source.replace(regex, to);
  fs.writeFileSync(filePath, source);
}

const orderDetailPath = path.resolve(__dirname, '../src/features/orders/OrderDetailPage.tsx');
patch(orderDetailPath, `        <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-[#eef2f6] pb-2">\n          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0f4c81]">Order Summary</p>\n          <p className="break-all text-sm font-semibold tracking-tight text-[#0f172a]">{order.final_order_no || order.order_no}</p>\n          <span className="text-xs font-normal text-[#667085]">{formatDate(order.created_at)}</span>\n        </div>`, `        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#eef2f6] pb-2">\n          <div className="flex min-w-0 flex-wrap items-center gap-2">\n            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0f4c81]">Order Summary</p>\n            <p className="break-all text-sm font-semibold tracking-tight text-[#0f172a]">{order.final_order_no || order.order_no}</p>\n            <span className="text-xs font-normal text-[#667085]">{formatDate(order.created_at)}</span>\n          </div>\n          <div className="flex items-center gap-2 rounded-md border border-[#d8e5f2] bg-[#f3f8ff] px-3 py-1.5 text-right">\n            <div><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">Total Ordered Qty</p><p className="text-sm font-bold text-[#0b1f3a]">{totalQty}</p></div>\n            <div className="h-7 w-px bg-[#d8e5f2]" />\n            <div><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">Total Value</p><p className="text-sm font-bold text-[#0f5fa8]">{formatMoney(totalValue)}</p></div>\n          </div>\n        </div>`, 'order summary totals');

const servicePath = path.resolve(__dirname, '../src/services/creditDispatch.service.ts');
patch(servicePath, `  issuer_signature_path: string | null;`, `  issuer_signature_path: string | null;\n  sales_employee_name: string | null;`, 'credit record sales employee');
patch(servicePath, `  remarks: string;\n  customerSignatureDataUrl: string;`, `  remarks: string;\n  salesEmployeeName?: string;\n  customerSignatureDataUrl: string;`, 'credit form sales employee');
patch(servicePath, `  if (!input.customerSignatureDataUrl) throw new Error('Customer signature is required.');`, `  if (!(input.salesEmployeeName ?? '').trim()) throw new Error('Sales employee name is required.');\n  if (!input.customerSignatureDataUrl) throw new Error('Customer signature is required.');`, 'sales employee validation');
patch(servicePath, `      remarks: input.remarks.trim() || null,\n      customer_signature_path: customerSignaturePath,`, `      remarks: input.remarks.trim() || null,\n      sales_employee_name: (input.salesEmployeeName ?? '').trim().toUpperCase(),\n      customer_signature_path: customerSignaturePath,`, 'sales employee insert');

const newCreditPath = path.resolve(__dirname, '../src/features/credit-dispatch/NewCreditDispatchPage.tsx');
patch(newCreditPath, `    remarks: '',\n    customerSignatureDataUrl: '',`, `    remarks: '',\n    salesEmployeeName: '',\n    customerSignatureDataUrl: '',`, 'new credit sales employee state');
patch(newCreditPath, `        setForm({ ...initialState(profile?.branch ?? ''), ...JSON.parse(saved), customerSignatureDataUrl: '', issuerSignatureDataUrl: '' });`, `        setForm({ ...initialState(profile?.branch ?? ''), ...JSON.parse(saved), documentDate: today, customerSignatureDataUrl: '', issuerSignatureDataUrl: '' });`, 'today document date for restored draft');
patch(newCreditPath, `      if (!form.customerSignatureDataUrl) return 'Customer signature is required.';`, `      if (!(form.salesEmployeeName ?? '').trim()) return 'Sales employee name is required.';\n      if (!form.customerSignatureDataUrl) return 'Customer signature is required.';`, 'sales employee form validation');
patch(newCreditPath, `          <div className="space-y-4">\n            <SignaturePad title="Customer Signature"`, `          <div className="space-y-4">\n            <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">\n              <Field label="Sales Employee Name"><input className={inputClass} value={form.salesEmployeeName ?? ''} onChange={(event) => update('salesEmployeeName', event.target.value.toUpperCase())} placeholder="Enter sales employee name" /></Field>\n            </section>\n            <SignaturePad title="Customer Signature"`, 'sales employee signature input');
patch(newCreditPath, `['Customer', form.customerName], ['Mobile', form.mobileNo], ['Customer Type', form.customerType],`, `['Customer', form.customerName], ['Mobile', form.mobileNo], ['Customer Type', form.customerType], ['Sales Employee', form.salesEmployeeName ?? ''],`, 'sales employee review');

const creditListPath = path.resolve(__dirname, '../src/features/credit-dispatch/CreditDispatchListPage.tsx');
patch(creditListPath, `const paymentModes = ['Cash', 'UPI', 'Bank', 'Cheque', 'Adjustment', 'Other'] as const;`, `const paymentModes = ['Cash', 'UPI', 'Bank', 'Cheque', 'Adjustment', 'Other'] as const;\n\nfunction isPaymentOverdue(row: CreditDispatchRecord) {\n  return row.approval_status === 'Approved' && row.recovery_status !== 'Closed' && Number(row.balance_amount || 0) > 0 && Boolean(row.due_date) && row.due_date < today;\n}\n\nfunction visibleRecoveryStatus(row: CreditDispatchRecord) {\n  if (!isPaymentOverdue(row)) return row.recovery_status;\n  return Number(row.total_received_amount || 0) > 0 ? 'Partial Payment - Overdue' : 'Payment Overdue';\n}`, 'credit overdue helpers');
patchRegex(creditListPath, /const overdueCount = rows\.filter\([\s\S]*?\)\.length;\n  const closedCount/, `const overdueRows = rows.filter(isPaymentOverdue);\n  const overdueBalance = overdueRows.reduce((sum, row) => sum + Number(row.balance_amount || 0), 0);\n  const closedCount`, 'credit overdue totals');
patchRegex(creditListPath, /<StatCard label="Overdue" value=\{String\(overdueCount\)\} icon=\{Clock\} \/>/, `<StatCard label="Overdue" value={formatMoney(overdueBalance)} icon={Clock} />`, 'overdue KPI amount');
patchRegex(creditListPath, /<tr key=\{row\.id\} className="align-top hover:bg-slate-50\/70">/g, `<tr key={row.id} className={\`align-top transition-colors \${isPaymentOverdue(row) ? 'bg-red-50 ring-1 ring-inset ring-red-200 hover:bg-red-100/70' : 'hover:bg-slate-50/70'}\`}>`, 'overdue desktop row highlight');
patchRegex(creditListPath, /<article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0\.5 hover:shadow-md">/g, `<article className={\`rounded-3xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md \${isPaymentOverdue(row) ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}\`}>`, 'overdue mobile card highlight');
patchRegex(creditListPath, /statusClass\(row\.recovery_status\)\}`}>\{row\.recovery_status\}<\/span>/g, `statusClass(visibleRecoveryStatus(row))}\`}>{visibleRecoveryStatus(row)}</span>`, 'overdue recovery badge');
patch(creditListPath, `const matchesStatus = statusFilter === 'All' || row.approval_status === statusFilter || row.recovery_status === statusFilter;`, `const recoveryStatus = visibleRecoveryStatus(row);\n      const matchesStatus = statusFilter === 'All' || row.approval_status === statusFilter || recoveryStatus === statusFilter;`, 'overdue status filtering');
patch(creditListPath, `[row.dispatch_no, row.branch, row.customer_name, row.customer_type, row.mobile_no, row.document_type, row.document_no, row.approval_status, row.recovery_status, row.credit_amount, row.balance_amount]`, `[row.dispatch_no, row.branch, row.customer_name, row.customer_type, row.mobile_no, row.document_type, row.document_no, row.approval_status, recoveryStatus, row.credit_amount, row.balance_amount]`, 'overdue status search');

console.log('KPI, order summary, and Credit Dispatch overdue polish applied.');
