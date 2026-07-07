import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, FileSignature, IndianRupee, Save, Send } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../auth/useAuth';
import { calculateDueDate, createCreditDispatch, formatMoney, type CreditDispatchFormInput } from '../../services/creditDispatch.service';
import { SignaturePad } from './SignaturePad';

const customerTypes = ['Major Account', 'Retailer', 'Customer'] as const;
const documentTypes = ['DC', 'Tax Invoice', 'PI'] as const;
const closureOptions = [7, 15, 30] as const;

const today = new Date().toISOString().slice(0, 10);

type FormState = Omit<CreditDispatchFormInput, 'creditAmount' | 'customerSignatureDataUrl' | 'issuerSignatureDataUrl'> & {
  creditAmount: string;
  customerSignatureDataUrl: string;
  issuerSignatureDataUrl: string;
};

function initialState(branch: string): FormState {
  return {
    branch,
    customerName: '',
    customerType: 'Customer',
    mobileNo: '',
    documentType: 'DC',
    documentNo: '',
    documentDate: today,
    creditAmount: '',
    tentativeClosureDays: 7,
    remarks: '',
    customerSignatureDataUrl: '',
    issuerSignatureDataUrl: '',
  };
}

function StepPill({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] ${active ? 'border-blue-200 bg-blue-50 text-blue-700' : done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'}`}>
      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className={`h-2 w-2 rounded-full ${active ? 'bg-blue-500' : 'bg-slate-300'}`} />}
      {label}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-100';

export function NewCreditDispatchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const draftKey = `credit-dispatch-draft:${profile?.id ?? 'guest'}`;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => initialState(profile?.branch ?? ''));

  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        setForm({ ...initialState(profile?.branch ?? ''), ...JSON.parse(saved), customerSignatureDataUrl: '', issuerSignatureDataUrl: '' });
        return;
      } catch {
        localStorage.removeItem(draftKey);
      }
    }
    setForm((current) => ({ ...current, branch: profile?.branch ?? current.branch }));
  }, [draftKey, profile?.branch]);

  useEffect(() => {
    const { customerSignatureDataUrl, issuerSignatureDataUrl, ...safeDraft } = form;
    localStorage.setItem(draftKey, JSON.stringify(safeDraft));
  }, [draftKey, form]);

  const dueDate = useMemo(() => calculateDueDate(form.documentDate, form.tentativeClosureDays), [form.documentDate, form.tentativeClosureDays]);
  const creditAmountNumber = Number(form.creditAmount || 0);

  const createMutation = useMutation({
    mutationFn: () => createCreditDispatch({ ...form, creditAmount: creditAmountNumber }),
    onSuccess: async () => {
      localStorage.removeItem(draftKey);
      await queryClient.invalidateQueries({ queryKey: ['credit-dispatches'] });
      navigate('/credit-dispatch');
    },
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateStep(targetStep = step) {
    if (targetStep === 0) {
      if (!form.customerName.trim()) return 'Customer name is required.';
      if (!/^\d{10}$/.test(form.mobileNo.trim())) return 'Enter a valid 10 digit mobile number.';
    }
    if (targetStep === 1) {
      if (!form.documentDate) return 'Document date is required.';
      if (!creditAmountNumber || creditAmountNumber <= 0) return 'Credit amount must be greater than zero.';
    }
    if (targetStep === 2) {
      if (!form.customerSignatureDataUrl) return 'Customer signature is required.';
      if (!form.issuerSignatureDataUrl) return 'Issuing official signature is required.';
    }
    return '';
  }

  function goNext() {
    const error = validateStep();
    if (error) {
      alert(error);
      return;
    }
    setStep((current) => Math.min(current + 1, 3));
  }

  function submit() {
    for (let index = 0; index <= 2; index += 1) {
      const error = validateStep(index);
      if (error) {
        setStep(index);
        alert(error);
        return;
      }
    }
    createMutation.mutate();
  }

  const steps = ['Customer', 'Document', 'Signatures', 'Review'];

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link to="/credit-dispatch" className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-blue-700">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-blue-700">
          Branch: {profile?.branch ?? 'Unassigned'}
        </span>
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Credit Dispatch</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">New signed credit request</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">Digital replacement for manual credit dispatch slip.</p>
          </div>
          <div className="rounded-3xl bg-slate-950 px-4 py-3 text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">Amount</p>
            <p className="text-xl font-black">{formatMoney(creditAmountNumber)}</p>
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {steps.map((label, index) => <StepPill key={label} label={label} active={step === index} done={step > index} />)}
        </div>
      </section>

      <div className="mt-4 space-y-4">
        {step === 0 ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600"><ClipboardCheck className="h-5 w-5" /></div>
              <div>
                <h2 className="text-lg font-black text-slate-950">Customer details</h2>
                <p className="text-sm font-semibold text-slate-500">Capture who has received the goods/document on credit.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer Name">
                <input className={inputClass} value={form.customerName} onChange={(event) => update('customerName', event.target.value)} placeholder="Enter customer name" />
              </Field>
              <Field label="Mobile No.">
                <input className={inputClass} inputMode="numeric" maxLength={10} value={form.mobileNo} onChange={(event) => update('mobileNo', event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10 digit mobile no." />
              </Field>
              <Field label="Customer Type">
                <select className={inputClass} value={form.customerType} onChange={(event) => update('customerType', event.target.value as FormState['customerType'])}>
                  {customerTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Branch">
                <input className={`${inputClass} bg-slate-50`} value={form.branch} readOnly />
              </Field>
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600"><IndianRupee className="h-5 w-5" /></div>
              <div>
                <h2 className="text-lg font-black text-slate-950">Document & amount</h2>
                <p className="text-sm font-semibold text-slate-500">No part details are required in this workflow.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Document Type">
                <select className={inputClass} value={form.documentType} onChange={(event) => update('documentType', event.target.value as FormState['documentType'])}>
                  {documentTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Document No.">
                <input className={inputClass} value={form.documentNo} onChange={(event) => update('documentNo', event.target.value)} placeholder="DC / Invoice / PI number" />
              </Field>
              <Field label="Document Date">
                <input className={inputClass} type="date" value={form.documentDate} onChange={(event) => update('documentDate', event.target.value)} />
              </Field>
              <Field label="Credit Amount">
                <input className={inputClass} type="number" min="0" inputMode="decimal" value={form.creditAmount} onChange={(event) => update('creditAmount', event.target.value)} placeholder="0" />
              </Field>
              <Field label="Tentative Closure">
                <select className={inputClass} value={form.tentativeClosureDays} onChange={(event) => update('tentativeClosureDays', Number(event.target.value) as FormState['tentativeClosureDays'])}>
                  {closureOptions.map((days) => <option key={days} value={days}>Within {days} Days</option>)}
                </select>
              </Field>
              <Field label="Due Date">
                <input className={`${inputClass} bg-slate-50`} value={dueDate} readOnly />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Remarks">
                  <textarea className={`${inputClass} min-h-24 resize-y`} value={form.remarks} onChange={(event) => update('remarks', event.target.value)} placeholder="Optional remarks" />
                </Field>
              </div>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <SignaturePad
              title="Customer Signature"
              subtitle="Customer acceptance"
              agreement="I confirm receipt of goods/document on credit and agree to clear the pending amount within the selected closure period."
              value={form.customerSignatureDataUrl}
              onChange={(value) => update('customerSignatureDataUrl', value)}
            />
            <SignaturePad
              title="Issuer Signature"
              subtitle="Issuing official confirmation"
              agreement="I confirm that this credit dispatch entry is correct and submitted for manager approval."
              value={form.issuerSignatureDataUrl}
              onChange={(value) => update('issuerSignatureDataUrl', value)}
            />
          </div>
        ) : null}

        {step === 3 ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><FileSignature className="h-5 w-5" /></div>
              <div>
                <h2 className="text-lg font-black text-slate-950">Review & submit</h2>
                <p className="text-sm font-semibold text-slate-500">This will be sent to all manager-role users for approval.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['Customer', form.customerName],
                ['Mobile', form.mobileNo],
                ['Customer Type', form.customerType],
                ['Document', `${form.documentType}${form.documentNo ? ` • ${form.documentNo}` : ''}`],
                ['Credit Amount', formatMoney(creditAmountNumber)],
                ['Due Date', dueDate],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
                  <p className="mt-1 break-words text-sm font-black text-slate-900">{value}</p>
                </div>
              ))}
            </div>
            {createMutation.error ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                {(createMutation.error as Error).message || 'Could not submit credit dispatch request.'}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-2xl backdrop-blur lg:left-48">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Button type="button" variant="secondary" className="px-3" disabled={step === 0 || createMutation.isPending} onClick={() => setStep((current) => Math.max(current - 1, 0))}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="hidden items-center gap-2 text-xs font-bold text-slate-500 sm:flex">
            <Save className="h-4 w-4" />
            Draft auto-saved on this device
          </div>
          {step < 3 ? (
            <Button type="button" onClick={goNext} disabled={createMutation.isPending}>
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={createMutation.isPending}>
              <Send className="h-4 w-4" />
              {createMutation.isPending ? 'Submitting...' : 'Submit'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
