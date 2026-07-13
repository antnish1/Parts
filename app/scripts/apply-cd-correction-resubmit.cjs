const fs = require('fs');
const path = require('path');

function patchFile(relativePath, transform) {
  const filePath = path.resolve(__dirname, '..', relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const next = transform(source);
  if (next !== source) fs.writeFileSync(filePath, next);
}

patchFile('src/services/creditDispatch.service.ts', (source) => {
  if (source.includes('export async function resubmitCorrectedCreditDispatch')) return source;
  const marker = 'export async function createCreditDispatch(input: CreditDispatchFormInput) {';
  if (!source.includes(marker)) throw new Error('Credit Dispatch service marker not found');
  const additions = `export async function getCreditDispatchById(dispatchId: string) {
  const { data, error } = await supabase
    .from('portal_credit_dispatches')
    .select('*')
    .eq('id', dispatchId)
    .single();
  if (error) throw error;
  return withDerivedRecoveryStatus(data as CreditDispatchRecord);
}

function normalizeBranch(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function resubmitCorrectedCreditDispatch(dispatchId: string, input: CreditDispatchFormInput, loggedInBranch: string) {
  validateRequestInput(input);
  const current = await getCreditDispatchById(dispatchId);
  if (current.approval_status !== 'Correction Required') throw new Error('This request is no longer awaiting correction.');
  if (normalizeBranch(current.branch) !== normalizeBranch(loggedInBranch)) throw new Error('This request belongs to another branch.');

  const customerSignaturePath = await uploadSignature(input.customerSignatureDataUrl, 'customer');
  const issuerSignaturePath = await uploadSignature(input.issuerSignatureDataUrl, 'issuer');
  const nowIso = new Date().toISOString();
  const dueDate = calculateDueDate(input.documentDate, input.tentativeClosureDays);

  const { data, error } = await supabase
    .from('portal_credit_dispatches')
    .update({
      customer_name: input.customerName.trim(),
      customer_type: input.customerType,
      mobile_no: input.mobileNo.trim(),
      document_type: input.documentType,
      document_no: input.documentNo.trim(),
      document_date: input.documentDate,
      credit_amount: input.creditAmount,
      tentative_closure_days: input.tentativeClosureDays,
      due_date: dueDate,
      remarks: input.remarks.trim() || null,
      customer_signature_path: customerSignaturePath,
      issuer_signature_path: issuerSignaturePath,
      customer_signed_at: nowIso,
      issuer_signed_at: nowIso,
      approval_status: 'Pending Approval',
      correction_note: null,
      rejection_reason: null,
      approved_by: null,
      approved_at: null,
      updated_at: nowIso,
    })
    .eq('id', dispatchId)
    .eq('approval_status', 'Correction Required')
    .eq('branch', current.branch)
    .select('*')
    .single();

  if (error) throw error;
  await addEvent(dispatchId, 'Corrected and Resubmitted', 'Branch corrected the complete request, captured fresh customer and issuer signatures, and resubmitted it for manager approval.');
  return data as CreditDispatchRecord;
}

`;
  return source.replace(marker, additions + marker);
});

patchFile('src/routes/AppRouter.tsx', (source) => {
  if (!source.includes("const EditCreditDispatchPage =")) {
    source = source.replace(
      "const NewCreditDispatchPage = lazyNamed(() => import('../features/credit-dispatch/NewCreditDispatchPage'), 'NewCreditDispatchPage');",
      "const NewCreditDispatchPage = lazyNamed(() => import('../features/credit-dispatch/NewCreditDispatchPage'), 'NewCreditDispatchPage');\nconst EditCreditDispatchPage = lazyNamed(() => import('../features/credit-dispatch/EditCreditDispatchPage'), 'EditCreditDispatchPage');",
    );
  }
  if (!source.includes('path="/credit-dispatch/:dispatchId/edit"')) {
    source = source.replace(
      '<Route path="/credit-dispatch/new" element={<NewCreditDispatchPage />} />',
      '<Route path="/credit-dispatch/new" element={<NewCreditDispatchPage />} />\n              <Route path="/credit-dispatch/:dispatchId/edit" element={<EditCreditDispatchPage />} />',
    );
  }
  return source;
});

patchFile('src/features/credit-dispatch/CreditDispatchListPage.tsx', (source) => {
  if (source.includes('Edit & Resubmit')) return source;

  source = source.replace(
    "type ActionProps = { row: CreditDispatchRecord; canManage: boolean; canPay: boolean; isBusy: boolean; onApproval: (row: CreditDispatchRecord, action: CreditDispatchApprovalAction) => void; onPayment: (row: CreditDispatchRecord) => void; compact?: boolean };",
    "type ActionProps = { row: CreditDispatchRecord; canManage: boolean; canPay: boolean; canCorrect: boolean; currentBranch: string; isBusy: boolean; onApproval: (row: CreditDispatchRecord, action: CreditDispatchApprovalAction) => void; onPayment: (row: CreditDispatchRecord) => void; compact?: boolean };",
  );

  source = source.replace(
    /function RowActions\(\{ row, canManage, canPay, isBusy, onApproval, onPayment, compact \}: ActionProps\) \{[\s\S]*?\n}\n\nfunction DispatchCard/,
    `function normalizeActionBranch(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function RowActions({ row, canManage, canPay, canCorrect, currentBranch, isBusy, onApproval, onPayment, compact }: ActionProps) {
  const progressStatus = getCreditDispatchProgressStatus(row);
  const showCorrection = canCorrect && progressStatus === 'Correction Required' && normalizeActionBranch(row.branch) === normalizeActionBranch(currentBranch);
  const showApproval = canManage && progressStatus === 'Pending Approval';
  const showPayment = canPay && isCreditDispatchPaymentStage(progressStatus);
  if (showCorrection) return <Link to={\`/credit-dispatch/\${row.id}/edit\`}><Button type="button" className={compact ? 'cd-action cd-action--correct px-3 py-1.5 text-xs' : 'cd-action cd-action--correct w-full'}><RotateCcw className="h-4 w-4" />Edit & Resubmit</Button></Link>;
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

function DispatchCard`,
  );

  source = source.replace(
    "  const canPay = ['branch', 'manager', 'admin', 'developer', 'super'].includes(profile?.role ?? '');",
    "  const canPay = ['branch', 'manager', 'admin', 'developer', 'super'].includes(profile?.role ?? '');\n  const canCorrect = profile?.role === 'branch';",
  );
  source = source.replace(
    /const actionProps = \{ canManage, canPay, isBusy,/,
    "const actionProps = { canManage, canPay, canCorrect, currentBranch: profile?.branch ?? '', isBusy,",
  );
  return source;
});

console.log('Credit Dispatch correction resubmission workflow applied.');
