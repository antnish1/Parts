import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { formatMoney } from '../../services/creditDispatch.service';
import { formatDateTime, getCreditDispatchDetail } from '../../services/creditDispatchDetail.service';

function Box({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-3 print:rounded-none print:border print:border-slate-200 print:bg-white print:p-1.5"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 print:text-[8px] print:leading-3">{label}</p><p className="mt-1 text-sm font-black text-slate-900 print:mt-0.5 print:text-[10px] print:leading-4">{value || '-'}</p></div>;
}

function SignatureBox({ label, url }: { label: string; url: string | null }) {
  return <div className="rounded-2xl border border-slate-200 p-3 print:rounded-none print:p-1.5"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 print:text-[8px] print:leading-3">{label}</p>{url ? <img src={url} alt={label} className="mt-2 h-24 w-full object-contain print:mt-1 print:h-14" /> : <div className="mt-2 grid h-24 place-items-center rounded-xl bg-slate-50 text-xs font-bold text-slate-400 print:mt-1 print:h-14 print:rounded-none print:text-[9px]">Signature not available</div>}</div>;
}

export function CreditDispatchDetailPage() {
  const recordId = new URLSearchParams(window.location.search).get('id') ?? '';
  const query = useQuery({ queryKey: ['credit-dispatch-detail', recordId], queryFn: () => getCreditDispatchDetail(recordId), enabled: Boolean(recordId) });

  if (!recordId) return <div className="rounded-3xl bg-red-50 p-6 font-bold text-red-700">Missing record id.</div>;
  if (query.isLoading) return <div className="rounded-3xl bg-white p-6 font-bold text-slate-600">Loading...</div>;
  if (query.error || !query.data) return <div className="rounded-3xl bg-red-50 p-6 font-bold text-red-700">Unable to load record.</div>;

  const { dispatch, payments, events, customerSignatureUrl, issuerSignatureUrl } = query.data;

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-20 print:max-w-none print:space-y-0 print:pb-0">
      <style>{'@media print { @page { size: A4; margin: 10mm; } html, body { background: white !important; } }'}</style>
      <div className="flex items-center justify-between print:hidden"><Link to="/credit-dispatch" className="inline-flex items-center gap-2 text-sm font-black text-slate-600"><ArrowLeft className="h-4 w-4" />Back</Link><Button type="button" onClick={() => window.print()}><Printer className="h-4 w-4" />Print / PDF</Button></div>
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm print:border-none print:p-0 print:shadow-none">
        <div className="border-b border-slate-100 pb-4 print:pb-2"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 print:text-[9px] print:leading-3">Frontier Commercial Vehicle Pvt. Ltd.</p><h1 className="mt-1 text-2xl font-black text-slate-950 print:text-lg print:leading-5">Credit Dispatch Slip</h1><p className="mt-1 text-sm font-bold text-slate-500 print:text-[10px] print:leading-4">{dispatch.dispatch_no ?? 'Pending No.'}</p></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3 print:mt-2 print:grid-cols-2 print:gap-1.5"><Box label="Branch" value={dispatch.branch} /><Box label="Customer" value={dispatch.customer_name} /><Box label="Mobile" value={dispatch.mobile_no} /><Box label="Customer Type" value={dispatch.customer_type} /><Box label="Document" value={`${dispatch.document_type} ${dispatch.document_no || ''}`} /><Box label="Document Date" value={dispatch.document_date} /><Box label="Closure" value={`Within ${dispatch.tentative_closure_days} Days`} /><Box label="Due Date" value={dispatch.due_date} /><Box label="Status" value={`${dispatch.approval_status} / ${dispatch.recovery_status}`} /><Box label="Created At" value={formatDateTime(dispatch.created_at)} /></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3 print:mt-2 print:grid-cols-3 print:gap-1.5"><Box label="Credit Amount" value={formatMoney(dispatch.credit_amount)} /><Box label="Received" value={formatMoney(dispatch.total_received_amount)} /><Box label="Balance" value={formatMoney(dispatch.balance_amount)} /></div>
        {dispatch.remarks ? <div className="mt-4 rounded-2xl bg-slate-50 p-3 print:mt-2 print:rounded-none print:border print:border-slate-200 print:bg-white print:p-1.5"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 print:text-[8px] print:leading-3">Remarks</p><p className="mt-1 text-sm font-bold text-slate-700 print:mt-0.5 print:text-[10px] print:leading-4">{dispatch.remarks}</p></div> : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2 print:mt-2 print:grid-cols-2 print:gap-1.5"><SignatureBox label="Customer Signature" url={customerSignatureUrl} /><SignatureBox label="Issuing Official Signature" url={issuerSignatureUrl} /></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 print:mt-2 print:grid-cols-2 print:gap-1.5"><Box label="Approved At" value={dispatch.approved_at ? formatDateTime(dispatch.approved_at) : '-'} /><Box label="Printed At" value={formatDateTime(new Date().toISOString())} /></div>
      </section>
      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm print:hidden"><h2 className="text-lg font-black text-slate-950">Payments</h2><div className="mt-3 space-y-2">{payments.length === 0 ? <p className="text-sm font-bold text-slate-500">No payments recorded.</p> : payments.map((payment) => <div key={payment.id} className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{payment.received_date} • {payment.payment_mode} • {formatMoney(payment.received_amount)} • {payment.reference_no || '-'}</div>)}</div></section>
      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm print:hidden"><h2 className="text-lg font-black text-slate-950">Timeline</h2><div className="mt-3 space-y-2">{events.length === 0 ? <p className="text-sm font-bold text-slate-500">No timeline yet.</p> : events.map((event) => <div key={event.id} className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{event.event_type} • {formatDateTime(event.created_at)}{event.event_note ? ` • ${event.event_note}` : ''}</div>)}</div></section>
    </div>
  );
}
