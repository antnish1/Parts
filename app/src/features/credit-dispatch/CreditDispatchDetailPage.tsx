import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageSquarePlus, Printer, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { formatMoney } from '../../services/creditDispatch.service';
import { addCreditDispatchComment, formatDateTime, getCreditDispatchDetail } from '../../services/creditDispatchDetail.service';

function Box({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-3 print:rounded-none print:border print:border-slate-200 print:bg-white print:p-1.5"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 print:text-[8px] print:leading-3">{label}</p><p className="mt-1 text-sm font-black text-slate-900 print:mt-0.5 print:text-[10px] print:leading-4">{value || '-'}</p></div>;
}

function SignatureBox({ label, url }: { label: string; url: string | null }) {
  return <div className="rounded-2xl border border-slate-200 p-3 print:rounded-none print:p-1.5"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 print:text-[8px] print:leading-3">{label}</p>{url ? <img src={url} alt={label} className="mt-2 h-24 w-full object-contain print:mt-1 print:h-14" /> : <div className="mt-2 grid h-24 place-items-center rounded-xl bg-slate-50 text-xs font-bold text-slate-400 print:mt-1 print:h-14 print:rounded-none print:text-[9px]">Signature not available</div>}</div>;
}

export function CreditDispatchDetailPage() {
  const recordId = new URLSearchParams(window.location.search).get('id') ?? '';
  const queryClient = useQueryClient();
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState('');
  const query = useQuery({ queryKey: ['credit-dispatch-detail', recordId], queryFn: () => getCreditDispatchDetail(recordId), enabled: Boolean(recordId) });
  const commentMutation = useMutation({
    mutationFn: () => addCreditDispatchComment(recordId, commentText),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credit-dispatch-detail', recordId] });
      setCommentText('');
      setCommentError('');
      setCommentOpen(false);
    },
    onError: (error) => setCommentError(error instanceof Error ? error.message : 'Unable to add comment.'),
  });

  function openComment() {
    setCommentError('');
    setCommentOpen(true);
  }

  function closeComment() {
    if (commentMutation.isPending) return;
    setCommentError('');
    setCommentOpen(false);
  }

  function submitComment() {
    if (!commentText.trim()) {
      setCommentError('Enter a comment before saving.');
      return;
    }
    setCommentError('');
    commentMutation.mutate();
  }

  if (!recordId) return <div className="rounded-3xl bg-red-50 p-6 font-bold text-red-700">Missing record id.</div>;
  if (query.isLoading) return <div className="rounded-3xl bg-white p-6 font-bold text-slate-600">Loading...</div>;
  if (query.error || !query.data) return <div className="rounded-3xl bg-red-50 p-6 font-bold text-red-700">Unable to load record.</div>;

  const { dispatch, payments, events, customerSignatureUrl, issuerSignatureUrl } = query.data;

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-20 print:max-w-none print:space-y-0 print:pb-0">
      <style>{'@media print { @page { size: A4; margin: 10mm; } html, body { background: white !important; } }'}</style>
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link to="/credit-dispatch" className="inline-flex items-center gap-2 text-sm font-black text-slate-600"><ArrowLeft className="h-4 w-4" />Back</Link>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={openComment}><MessageSquarePlus className="h-4 w-4" />Add Comment</Button>
          <Button type="button" onClick={() => window.print()}><Printer className="h-4 w-4" />Print / PDF</Button>
        </div>
      </div>
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm print:border-none print:p-0 print:shadow-none">
        <div className="border-b border-slate-100 pb-4 print:pb-2"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 print:text-[9px] print:leading-3">Frontier Commercial Vehicle Pvt. Ltd.</p><h1 className="mt-1 text-2xl font-black text-slate-950 print:text-lg print:leading-5">Credit Dispatch Slip</h1><p className="mt-1 text-sm font-bold text-slate-500 print:text-[10px] print:leading-4">{dispatch.dispatch_no ?? 'Pending No.'}</p></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3 print:mt-2 print:grid-cols-2 print:gap-1.5"><Box label="Branch" value={dispatch.branch} /><Box label="Customer" value={dispatch.customer_name} /><Box label="Mobile" value={dispatch.mobile_no} /><Box label="Customer Type" value={dispatch.customer_type} /><Box label="Document" value={`${dispatch.document_type} ${dispatch.document_no || ''}`} /><Box label="Document Date" value={dispatch.document_date} /><Box label="Closure" value={`Within ${dispatch.tentative_closure_days} Days`} /><Box label="Due Date" value={dispatch.due_date} /><Box label="Status" value={`${dispatch.approval_status} / ${dispatch.recovery_status}`} /><Box label="Created At" value={formatDateTime(dispatch.created_at)} /></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3 print:mt-2 print:grid-cols-3 print:gap-1.5"><Box label="Credit Amount" value={formatMoney(dispatch.credit_amount)} /><Box label="Received" value={formatMoney(dispatch.total_received_amount)} /><Box label="Balance" value={formatMoney(dispatch.balance_amount)} /></div>
        {dispatch.remarks ? <div className="mt-4 rounded-2xl bg-slate-50 p-3 print:mt-2 print:rounded-none print:border print:border-slate-200 print:bg-white print:p-1.5"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 print:text-[8px] print:leading-3">Remarks</p><p className="mt-1 text-sm font-bold text-slate-700 print:mt-0.5 print:text-[10px] print:leading-4">{dispatch.remarks}</p></div> : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2 print:mt-2 print:grid-cols-2 print:gap-1.5"><SignatureBox label="Customer Signature" url={customerSignatureUrl} /><SignatureBox label="Issuing Official Signature" url={issuerSignatureUrl} /></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 print:mt-2 print:grid-cols-2 print:gap-1.5"><Box label="Approved At" value={dispatch.approved_at ? formatDateTime(dispatch.approved_at) : '-'} /><Box label="Printed At" value={formatDateTime(new Date().toISOString())} /></div>
      </section>
      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm print:hidden"><h2 className="text-lg font-black text-slate-950">Payments</h2><div className="mt-3 space-y-2">{payments.length === 0 ? <p className="text-sm font-bold text-slate-500">No payments recorded.</p> : payments.map((payment) => <div key={payment.id} className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{payment.received_date} • {payment.payment_mode} • {formatMoney(payment.received_amount)} • {payment.reference_no || '-'}</div>)}</div></section>
      <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <h2 className="text-lg font-black text-slate-950">Timeline</h2>
        <div className="mt-3 space-y-2">
          {events.length === 0 ? <p className="text-sm font-bold text-slate-500">No timeline yet.</p> : events.map((event) => event.event_type === 'Comment' ? (
            <div key={event.id} className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-700"><MessageSquarePlus className="h-3.5 w-3.5" /><span>Comment</span><span className="text-slate-400">•</span><span className="text-slate-500">{formatDateTime(event.created_at)}</span></div>
              <p className="mt-1 text-xs font-bold text-slate-500">{event.actor_name || 'Portal User'}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-800">{event.event_note || '-'}</p>
            </div>
          ) : <div key={event.id} className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{event.event_type} • {formatDateTime(event.created_at)}{event.event_note ? ` • ${event.event_note}` : ''}</div>)}
        </div>
      </section>

      {commentOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 print:hidden" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeComment(); }}>
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="credit-dispatch-comment-title">
            <div className="flex items-start justify-between gap-3">
              <div><h2 id="credit-dispatch-comment-title" className="text-base font-bold text-slate-950">Add Comment</h2><p className="mt-1 text-xs text-slate-500">The comment will be saved permanently in this Credit Dispatch timeline.</p></div>
              <button type="button" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50" onClick={closeComment} disabled={commentMutation.isPending} aria-label="Close comment dialog"><X className="h-4 w-4" /></button>
            </div>
            <textarea autoFocus value={commentText} onChange={(event) => { setCommentText(event.target.value); if (commentError) setCommentError(''); }} maxLength={2000} rows={5} placeholder="Enter comment..." className="mt-4 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            <div className="mt-1 flex items-center justify-between gap-3"><p className="text-xs font-semibold text-red-600">{commentError}</p><p className="text-[11px] text-slate-400">{commentText.length}/2000</p></div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closeComment} disabled={commentMutation.isPending}>Cancel</Button>
              <Button type="button" onClick={submitComment} disabled={commentMutation.isPending || !commentText.trim()}>{commentMutation.isPending ? 'Saving...' : 'Add Comment'}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
