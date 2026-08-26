import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, RotateCcw, Send } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../auth/useAuth';
import {
  calculateDueDate,
  getCreditDispatchById,
  resubmitCorrectedCreditDispatch,
  type CreditDispatchFormInput,
} from '../../services/creditDispatch.service';
import { SalesEmployeeAutocomplete } from './SalesEmployeeAutocomplete';
import { SignaturePad } from './SignaturePad';

const customerTypes = ['Major Account', 'Retailer', 'Customer'] as const;
const documentTypes = ['DC', 'Tax Invoice', 'PI'] as const;
const closureOptions = [7, 15, 30] as const;
type EditState = Omit<CreditDispatchFormInput, 'creditAmount'> & { creditAmount: string };

function normalize(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

export function EditCreditDispatchPage() {
  const { dispatchId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [form, setForm] = useState<EditState | null>(null);

  const requestQuery = useQuery({
    queryKey: ['credit-dispatch', dispatchId],
    queryFn: () => getCreditDispatchById(dispatchId),
    enabled: Boolean(dispatchId),
  });

  useEffect(() => {
    const row = requestQuery.data;
    if (!row) return;
    setForm({
      branch: row.branch,
      customerName: row.customer_name,
      customerType: row.customer_type,
      mobileNo: row.mobile_no,
      documentType: row.document_type,
      documentNo: row.document_no ?? '',
      documentDate: row.document_date,
      creditAmount: String(row.credit_amount ?? ''),
      tentativeClosureDays: row.tentative_closure_days,
      remarks: row.remarks ?? '',
      salesEmployeeName: row.sales_employee_name ?? '',
      customerSignatureDataUrl: '',
      issuerSignatureDataUrl: '',
    });
  }, [requestQuery.data]);

  const dueDate = useMemo(() => form ? calculateDueDate(form.documentDate, form.tentativeClosureDays) : '', [form]);
  const ownsRequest = normalize(profile?.branch) === normalize(requestQuery.data?.branch);
  const canEdit = profile?.role === 'branch' && ownsRequest && requestQuery.data?.approval_status === 'Correction Required';

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form || !requestQuery.data) throw new Error('Request is not ready.');
      const amount = Number(form.creditAmount);
      if (!form.customerName.trim()) throw new Error('Customer name is required.');
      if (!/^\d{10}$/.test(form.mobileNo.trim())) throw new Error('Enter a valid 10 digit mobile number.');
      if (!form.documentNo.trim()) throw new Error('Document number is required.');
      if (!form.documentDate) throw new Error('Document date is required.');
      if (!amount || amount <= 0) throw new Error('Credit amount must be greater than zero.');
      if (!form.salesEmployeeName?.trim()) throw new Error('Sales employee name is required.');
      if (!form.customerSignatureDataUrl || !form.issuerSignatureDataUrl) throw new Error('Fresh customer and issuer signatures are required.');
      return resubmitCorrectedCreditDispatch(dispatchId, {
        ...form,
        branch: requestQuery.data.branch,
        customerName: form.customerName.toUpperCase(),
        documentNo: form.documentNo.toUpperCase(),
        remarks: form.remarks.toUpperCase(),
        salesEmployeeName: form.salesEmployeeName.toUpperCase(),
        creditAmount: amount,
      }, profile?.branch ?? '');
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['credit-dispatches'] }),
        queryClient.invalidateQueries({ queryKey: ['credit-dispatch-nav-counter'] }),
      ]);
      navigate('/credit-dispatch');
    },
  });

  function update<K extends keyof EditState>(key: K, value: EditState[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }

  if (requestQuery.isLoading || !form) return <div className="rounded-xl border bg-white p-5 text-sm text-slate-500">Loading correction request…</div>;
  if (requestQuery.error) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Could not load this request.</div>;
  if (!canEdit) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">This request is not available for correction by your branch.</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-24">
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft className="h-4 w-4" />Back</button>
      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
        <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-orange-600" /><div><h1 className="font-semibold text-orange-900">Manager correction required</h1><p className="mt-1 text-sm text-orange-800">{requestQuery.data?.correction_note || 'Please review and correct the request.'}</p><p className="mt-2 text-xs text-orange-700">Both customer and issuer signatures must be captured again before resubmission.</p></div></div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Credit Dispatch Correction</p><h2 className="mt-1 text-lg font-semibold text-slate-950">Edit complete request</h2></div><span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">{requestQuery.data?.dispatch_no ?? 'Pending No.'}</span></div>
        <div className="grid gap-3 md:grid-cols-2">
          <label><span className="mb-1 block text-xs font-semibold text-slate-500">Customer Name</span><input className={inputClass} value={form.customerName} onChange={(e) => update('customerName', e.target.value)} /></label>
          <label><span className="mb-1 block text-xs font-semibold text-slate-500">Mobile No.</span><input className={inputClass} value={form.mobileNo} maxLength={10} onChange={(e) => update('mobileNo', e.target.value.replace(/\D/g, '').slice(0, 10))} /></label>
          <label><span className="mb-1 block text-xs font-semibold text-slate-500">Customer Type</span><select className={inputClass} value={form.customerType} onChange={(e) => update('customerType', e.target.value as EditState['customerType'])}>{customerTypes.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label><span className="mb-1 block text-xs font-semibold text-slate-500">Branch</span><input className={`${inputClass} bg-slate-50`} value={form.branch} readOnly /></label>
          <label><span className="mb-1 block text-xs font-semibold text-slate-500">Document Type</span><select className={inputClass} value={form.documentType} onChange={(e) => update('documentType', e.target.value as EditState['documentType'])}>{documentTypes.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label><span className="mb-1 block text-xs font-semibold text-slate-500">Document No.</span><input className={inputClass} value={form.documentNo} onChange={(e) => update('documentNo', e.target.value)} /></label>
          <label><span className="mb-1 block text-xs font-semibold text-slate-500">Document Date</span><input className={inputClass} type="date" value={form.documentDate} onChange={(e) => update('documentDate', e.target.value)} /></label>
          <label><span className="mb-1 block text-xs font-semibold text-slate-500">Credit Amount</span><input className={inputClass} type="number" min="0" value={form.creditAmount} onChange={(e) => update('creditAmount', e.target.value)} /></label>
          <label><span className="mb-1 block text-xs font-semibold text-slate-500">Tentative Closure</span><select className={inputClass} value={form.tentativeClosureDays} onChange={(e) => update('tentativeClosureDays', Number(e.target.value) as EditState['tentativeClosureDays'])}>{closureOptions.map((x) => <option key={x} value={x}>Within {x} Days</option>)}</select></label>
          <label><span className="mb-1 block text-xs font-semibold text-slate-500">Due Date</span><input className={`${inputClass} bg-slate-50`} value={dueDate} readOnly /></label>
          <label className="md:col-span-2"><span className="mb-1 block text-xs font-semibold text-slate-500">Sales Employee Name</span><SalesEmployeeAutocomplete inputClassName={inputClass} value={form.salesEmployeeName ?? ''} onChange={(value) => update('salesEmployeeName', value)} /></label>
          <label className="md:col-span-2"><span className="mb-1 block text-xs font-semibold text-slate-500">Remarks</span><textarea className={`${inputClass} min-h-24`} value={form.remarks} onChange={(e) => update('remarks', e.target.value)} /></label>
        </div>
      </section>

      <SignaturePad title="New Customer Signature" subtitle="Required after correction" agreement="I confirm the corrected credit dispatch details and agree to clear the pending amount within the selected closure period." value={form.customerSignatureDataUrl} onChange={(value) => update('customerSignatureDataUrl', value)} />
      <SignaturePad title="New Issuer Signature" subtitle="Required after correction" agreement="I confirm that the corrected credit dispatch entry is complete and ready for manager approval." value={form.issuerSignatureDataUrl} onChange={(value) => update('issuerSignatureDataUrl', value)} />

      {mutation.error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{(mutation.error as Error).message}</div> : null}
      <div className="sticky bottom-3 flex justify-end rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur"><Button onClick={() => mutation.mutate()} disabled={mutation.isPending}><RotateCcw className="h-4 w-4" />{mutation.isPending ? 'Resubmitting…' : 'Save Changes & Resubmit'}<Send className="h-4 w-4" /></Button></div>
    </div>
  );
}
