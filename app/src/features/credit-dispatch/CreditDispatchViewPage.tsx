import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { formatMoney } from '../../services/creditDispatch.service';
import { formatDateTime, getCreditDispatchDetail } from '../../services/creditDispatchDetail.service';

function Box({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-slate-900">{value || '-'}</p></div>;
}

export function CreditDispatchViewPage() {
  const [params] = useSearchParams();
  const recordId = params.get('id') ?? '';
  const query = useQuery({ queryKey: ['credit-dispatch-detail', recordId], queryFn: () => getCreditDispatchDetail(recordId), enabled: Boolean(recordId) });

  if (!recordId) return <div className="rounded-3xl bg-red-50 p-6 font-bold text-red-700">Missing record id.</div>;
  if (query.isLoading) return <div className="rounded-3xl bg-white p-6 font-bold text-slate-600">Loading...</div>;
  if (query.error || !query.data) return <div className="rounded-3xl bg-red-50 p-6 font-bold text-red-700">Unable to load record.</div>;

  const { dispatch, payments, events } = query.data;

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-20 print:pb-0">
      <div className="flex items-center justify-between print:hidden">
        <Link to="/credit-dispatch" className="inline-flex items-center gap-2 text-sm font-black text-slate-600"><ArrowLeft className="h-4 w-4" />Back</Link>
        <Button type="button" onClick={() => window.print()}><Printer className="h-4 w-4" />Print / PDF</Button>
      </div>
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm print:border-none print:shadow-none">
        <div className="border-b border-slate-100 pb-4"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">Frontier Commercial Vehicle Pvt. Ltd.</p><h1 className="mt-1 text-2xl font-black text-slate-950">Credit Dispatch Slip</h1><p className="mt-1 text-sm font-bold text-slate-500">{dispatch.dispatch_no ?? 'Pending No.'}</p></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3"><Box label="Branch" value={dispatch.branch} /><Box label="Customer" value={dispatch.customer_name} /><Box label="Mobile" value={dispatch.mobile_no} /><Box label="Document" value={`${dispatch.document_type} ${dispatch.document_no || ''}`} /><Box label="Due Date" value={dispatch.due_date} /><Box label="Status" value={`${dispatch.approval_status} / ${dispatch.recovery_status}`} /></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3"><Box label="Credit Amount" value={formatMoney(dispatch.credit_amount)} /><Box label="Received" value={formatMoney(dispatch.total_received_amount)} /><Box label="Balance" value={formatMoney(dispatch.balance_amount)} /></div>
      </section>
      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm print:hidden"><h2 className="text-lg font-black text-slate-950">Payments</h2><div className="mt-3 space-y-2">{payments.length === 0 ? <p className="text-sm font-bold text-slate-500">No payments recorded.</p> : payments.map((payment) => <div key={payment.id} className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{payment.received_date} • {payment.payment_mode} • {formatMoney(payment.received_amount)} • {payment.reference_no || '-'}</div>)}</div></section>
      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm print:hidden"><h2 className="text-lg font-black text-slate-950">Timeline</h2><div className="mt-3 space-y-2">{events.length === 0 ? <p className="text-sm font-bold text-slate-500">No timeline yet.</p> : events.map((event) => <div key={event.id} className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{event.event_type} • {formatDateTime(event.created_at)}{event.event_note ? ` • ${event.event_note}` : ''}</div>)}</div></section>
    </div>
  );
}
