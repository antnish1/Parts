const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'features', 'credit-dispatch', 'CreditDispatchListPage.tsx');
if (!fs.existsSync(filePath)) process.exit(0);
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('resubmitCreditDispatchCorrection')) {
  content = content.replace(
    "} from '../../services/creditDispatch.service';",
    "} from '../../services/creditDispatch.service';\nimport { resubmitCreditDispatchCorrection, type CreditDispatchCorrectionInput } from '../../services/creditDispatchCorrection.service';"
  );
}

const correctionDialog = `
function CorrectionDialog({ row, isBusy, onClose, onSubmit }: { row: CreditDispatchRecord; isBusy: boolean; onClose: () => void; onSubmit: (input: CreditDispatchCorrectionInput) => void }) {
  const [customerName, setCustomerName] = useState(row.customer_name);
  const [customerType, setCustomerType] = useState<CreditDispatchRecord['customer_type']>(row.customer_type);
  const [mobileNo, setMobileNo] = useState(row.mobile_no);
  const [documentType, setDocumentType] = useState<CreditDispatchRecord['document_type']>(row.document_type);
  const [documentNo, setDocumentNo] = useState(row.document_no ?? '');
  const [documentDate, setDocumentDate] = useState(row.document_date);
  const [creditAmount, setCreditAmount] = useState(String(row.credit_amount ?? ''));
  const [tentativeClosureDays, setTentativeClosureDays] = useState<7 | 15 | 30>(row.tentative_closure_days);
  const [remarks, setRemarks] = useState(row.remarks ?? '');
  const [error, setError] = useState('');
  const inputClass = 'w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100';

  function submit() {
    const amount = Number(creditAmount);
    if (!customerName.trim()) return setError('Customer name is required.');
    if (!/^\\d{10}$/.test(mobileNo.trim())) return setError('Enter a valid 10 digit mobile number.');
    if (!documentNo.trim()) return setError('Document no. is required.');
    if (!documentDate) return setError('Document date is required.');
    if (!amount || amount <= 0) return setError('Credit amount must be greater than zero.');
    onSubmit({ dispatchId: row.id, customerName, customerType, mobileNo, documentType, documentNo, documentDate, creditAmount: amount, tentativeClosureDays, remarks });
  }

  return (
    <Dialog title="Correct & Resubmit" description={`${row.dispatch_no ?? row.customer_name} • Sent back by manager`} onClose={onClose}>
      {row.correction_note ? <div className="mb-3 rounded-2xl bg-orange-50 p-3 text-sm font-bold text-orange-700">Manager note: {row.correction_note}</div> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Customer Name <span className="text-red-500">*</span></span><input className={inputClass} value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
        <label className="block"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Mobile No. <span className="text-red-500">*</span></span><input className={inputClass} inputMode="numeric" maxLength={10} value={mobileNo} onChange={(event) => setMobileNo(event.target.value.replace(/\\D/g, '').slice(0, 10))} /></label>
        <label className="block"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Customer Type <span className="text-red-500">*</span></span><select className={inputClass} value={customerType} onChange={(event) => setCustomerType(event.target.value as CreditDispatchRecord['customer_type'])}>{['Major Account', 'Retailer', 'Customer'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="block"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Document Type <span className="text-red-500">*</span></span><select className={inputClass} value={documentType} onChange={(event) => setDocumentType(event.target.value as CreditDispatchRecord['document_type'])}>{['DC', 'Tax Invoice', 'PI'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="block"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Document No. <span className="text-red-500">*</span></span><input className={inputClass} value={documentNo} onChange={(event) => setDocumentNo(event.target.value)} /></label>
        <label className="block"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Document Date <span className="text-red-500">*</span></span><input className={inputClass} type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} /></label>
        <label className="block"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Credit Amount <span className="text-red-500">*</span></span><input className={inputClass} type="number" min="0" value={creditAmount} onChange={(event) => setCreditAmount(event.target.value)} /></label>
        <label className="block"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Tentative Closure <span className="text-red-500">*</span></span><select className={inputClass} value={tentativeClosureDays} onChange={(event) => setTentativeClosureDays(Number(event.target.value) as 7 | 15 | 30)}>{[7, 15, 30].map((days) => <option key={days} value={days}>Within {days} Days</option>)}</select></label>
        <label className="block sm:col-span-2"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Remarks</span><textarea className={`${inputClass} min-h-24`} value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label>
      </div>
      {error ? <p className="mt-3 rounded-2xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-2"><Button type="button" variant="secondary" onClick={onClose} disabled={isBusy}>Cancel</Button><Button type="button" onClick={submit} disabled={isBusy}>{isBusy ? 'Sending...' : 'Send Back for Approval'}</Button></div>
    </Dialog>
  );
}
`;

if (!content.includes('function CorrectionDialog')) {
  content = content.replace('\ntype ActionProps =', `${correctionDialog}\ntype ActionProps =`);
}

content = content.replace(
  "type ActionProps = { row: CreditDispatchRecord; canManage: boolean; canPay: boolean; isBusy: boolean; onApproval: (row: CreditDispatchRecord, action: CreditDispatchApprovalAction) => void; onPayment: (row: CreditDispatchRecord) => void; compact?: boolean };",
  "type ActionProps = { row: CreditDispatchRecord; canManage: boolean; canPay: boolean; canCorrect: boolean; isBusy: boolean; onApproval: (row: CreditDispatchRecord, action: CreditDispatchApprovalAction) => void; onPayment: (row: CreditDispatchRecord) => void; onCorrection: (row: CreditDispatchRecord) => void; compact?: boolean };"
);

content = content.replace(
  "function RowActions({ row, canManage, canPay, isBusy, onApproval, onPayment, compact }: ActionProps) {\n  const showApproval = canManage && row.approval_status === 'Pending Approval';\n  const showPayment = canPay && row.approval_status === 'Approved' && row.recovery_status !== 'Closed';\n  if (!showApproval && !showPayment) return <span className=\"text-xs font-bold text-slate-400\">No action</span>;\n  if (showPayment) return <Button type=\"button\" className={compact ? 'px-3 py-1.5 text-xs' : 'w-full rounded-2xl'} disabled={isBusy} onClick={() => onPayment(row)}><IndianRupee className=\"h-4 w-4\" />Payment</Button>;",
  "function RowActions({ row, canManage, canPay, canCorrect, isBusy, onApproval, onPayment, onCorrection, compact }: ActionProps) {\n  const showApproval = canManage && row.approval_status === 'Pending Approval';\n  const showPayment = canPay && row.approval_status === 'Approved' && row.recovery_status !== 'Closed';\n  const showCorrection = canCorrect && row.approval_status === 'Correction Required';\n  if (!showApproval && !showPayment && !showCorrection) return <span className=\"text-xs font-bold text-slate-400\">No action</span>;\n  if (showCorrection) return <Button type=\"button\" variant=\"secondary\" className={compact ? 'px-3 py-1.5 text-xs' : 'w-full rounded-2xl'} disabled={isBusy} onClick={() => onCorrection(row)}><RotateCcw className=\"h-4 w-4\" />Correct & Resubmit</Button>;\n  if (showPayment) return <Button type=\"button\" className={compact ? 'px-3 py-1.5 text-xs' : 'w-full rounded-2xl'} disabled={isBusy} onClick={() => onPayment(row)}><IndianRupee className=\"h-4 w-4\" />Payment</Button>;"
);

content = content.replace(
  "const [paymentTarget, setPaymentTarget] = useState<CreditDispatchRecord | null>(null);",
  "const [paymentTarget, setPaymentTarget] = useState<CreditDispatchRecord | null>(null);\n  const [correctionTarget, setCorrectionTarget] = useState<CreditDispatchRecord | null>(null);"
);
content = content.replace(
  "const paymentMutation = useMutation({ mutationFn: (input: CreditDispatchPaymentInput) => addCreditDispatchPayment(input), onSuccess: async () => { setPaymentTarget(null); await queryClient.invalidateQueries({ queryKey: ['credit-dispatches'] }); } });",
  "const paymentMutation = useMutation({ mutationFn: (input: CreditDispatchPaymentInput) => addCreditDispatchPayment(input), onSuccess: async () => { setPaymentTarget(null); await queryClient.invalidateQueries({ queryKey: ['credit-dispatches'] }); } });\n  const correctionMutation = useMutation({ mutationFn: (input: CreditDispatchCorrectionInput) => resubmitCreditDispatchCorrection(input), onSuccess: async () => { setCorrectionTarget(null); await queryClient.invalidateQueries({ queryKey: ['credit-dispatches'] }); } });"
);
content = content.replace(
  "const canPay = ['branch', 'manager', 'admin', 'developer', 'super'].includes(profile?.role ?? '');\n  const isBusy = approvalMutation.isPending || paymentMutation.isPending;",
  "const canPay = ['branch', 'manager', 'admin', 'developer', 'super'].includes(profile?.role ?? '');\n  const canCorrect = profile?.role === 'branch';\n  const isBusy = approvalMutation.isPending || paymentMutation.isPending || correctionMutation.isPending;"
);
content = content.replace(
  "const actionProps = { canManage, canPay, isBusy, onApproval: (row: CreditDispatchRecord, action: CreditDispatchApprovalAction) => setApprovalTarget({ row, action }), onPayment: (row: CreditDispatchRecord) => setPaymentTarget(row) };",
  "const actionProps = { canManage, canPay, canCorrect, isBusy, onApproval: (row: CreditDispatchRecord, action: CreditDispatchApprovalAction) => setApprovalTarget({ row, action }), onPayment: (row: CreditDispatchRecord) => setPaymentTarget(row), onCorrection: (row: CreditDispatchRecord) => setCorrectionTarget(row) };"
);
content = content.replaceAll('approvalMutation.error || paymentMutation.error', 'approvalMutation.error || paymentMutation.error || correctionMutation.error');
content = content.replaceAll('((approvalMutation.error || paymentMutation.error) as Error)', '((approvalMutation.error || paymentMutation.error || correctionMutation.error) as Error)');
content = content.replace(
  "{paymentTarget ? <PaymentDialog row={paymentTarget} isBusy={isBusy} onClose={() => setPaymentTarget(null)} onSubmit={(input) => paymentMutation.mutate(input)} /> : null}",
  "{paymentTarget ? <PaymentDialog row={paymentTarget} isBusy={isBusy} onClose={() => setPaymentTarget(null)} onSubmit={(input) => paymentMutation.mutate(input)} /> : null}\n      {correctionTarget ? <CorrectionDialog row={correctionTarget} isBusy={isBusy} onClose={() => setCorrectionTarget(null)} onSubmit={(input) => correctionMutation.mutate(input)} /> : null}"
);

fs.writeFileSync(filePath, content);
