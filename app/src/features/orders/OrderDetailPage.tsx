import { ChangeEvent, FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { useAuth } from '../../auth/useAuth';
import { setTestOrderApproved, setTestOrderRejected } from '../../services/testApproval.service';
import { setTestOrderProcessed } from '../../services/testAdmin.service';
import { addTestOrderComment, getTestOrderView } from '../../services/testOrderView.service';
import { getInventoryQtyByBranchParts } from '../../services/testInventoryLookup.service';
import { getCommentAttachmentSignedUrl, uploadCommentAttachment } from '../../services/commentAttachment.service';
import { getBilledQty, getEffectiveQty, getEffectiveValue, getPendingQty, getOrderStatusLabel, normalizePartNo } from '../../lib/orderLogic';
import type { TestOrder } from '../../services/testData.service';
import { OrderActivityPanel } from './OrderActivityPanel';

function formatMoney(value: number) {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatBytes(value: number) {
  if (!value) return '0 KB';
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function compactUniqueLabel(values: Array<string | null | undefined>, fallback?: string | null) {
  const unique = [...new Set(values.map((value) => (value || '').trim()).filter(Boolean))];
  if (fallback) return fallback;
  if (unique.length === 0) return '-';
  if (unique.length === 1) return unique[0];
  return `Multiple (${unique.length})`;
}

export function OrderDetailPage() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [commentMessage, setCommentMessage] = useState('');
  const [attachmentMessage, setAttachmentMessage] = useState('');
  const [attachmentBusy, setAttachmentBusy] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['test-order-view', orderId], queryFn: () => getTestOrderView(orderId), enabled: !!orderId });
  const inventoryQuery = useQuery({
    queryKey: ['test-order-inventory', data?.order.branch, data?.items.map((item) => item.part_no).join('|')],
    queryFn: () => getInventoryQtyByBranchParts(data!.order.branch, data!.items.map((item) => item.part_no)),
    enabled: !!data?.order.branch && data.items.length > 0,
  });
  const commentMutation = useMutation({
    mutationFn: () => addTestOrderComment(orderId, commentText),
    onSuccess: () => {
      setCommentText('');
      setCommentMessage('Comment added.');
      queryClient.invalidateQueries({ queryKey: ['test-order-view', orderId] });
    },
    onError: (commentError) => setCommentMessage(commentError instanceof Error ? commentError.message : 'Comment failed.'),
  });

  function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCommentMessage('');
    commentMutation.mutate();
  }

  async function handleAttachmentUpload(commentId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAttachmentMessage('');
    setAttachmentBusy(commentId);
    try {
      await uploadCommentAttachment(orderId, commentId, file);
      setAttachmentMessage('Attachment uploaded.');
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['test-order-view', orderId] });
    } catch (uploadError) {
      setAttachmentMessage(uploadError instanceof Error ? uploadError.message : 'Attachment upload failed.');
    } finally {
      setAttachmentBusy('');
    }
  }

  async function handleAttachmentDownload(attachmentId: string) {
    setAttachmentMessage('');
    setAttachmentBusy(attachmentId);
    try {
      const result = await getCommentAttachmentSignedUrl(attachmentId);
      window.open(result.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (downloadError) {
      setAttachmentMessage(downloadError instanceof Error ? downloadError.message : 'Attachment download failed.');
    } finally {
      setAttachmentBusy('');
    }
  }

  async function runApprovalAction(action: 'approve' | 'reject') {
    if (!data) return;
    setActionMessage('');
    setBusyAction(action);
    try {
      if (action === 'approve') await setTestOrderApproved(data.order as unknown as TestOrder);
      else await setTestOrderRejected(data.order as unknown as TestOrder);
      setActionMessage(`${data.order.order_no} ${action === 'approve' ? 'approved' : 'rejected'}.`);
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['test-orders'] });
    } catch (approvalError) {
      setActionMessage(approvalError instanceof Error ? approvalError.message : 'Approval action failed.');
    } finally {
      setBusyAction('');
    }
  }

  async function runProcessAction() {
    if (!data) return;
    setActionMessage('');
    setBusyAction('process');
    try {
      const finalNo = window.prompt('Enter final DBMS/SAP order number', data.order.final_order_no || data.order.processing_reference || '');
      if (!finalNo) throw new Error('Final order number is required.');
      await setTestOrderProcessed(data.order as unknown as TestOrder, finalNo);
      setActionMessage('Process completed.');
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['test-orders'] });
    } catch (adminError) {
      setActionMessage(adminError instanceof Error ? adminError.message : 'Admin action failed.');
    } finally {
      setBusyAction('');
    }
  }

  if (isLoading) return <PageCard eyebrow="Orders" title="Order Detail" description="Loading order detail..."><p className="text-xs text-[#c7d2df]">Loading...</p></PageCard>;
  if (error || !data) return <PageCard eyebrow="Orders" title="Order Detail" description="Unable to load order detail."><p className="text-xs text-[#ef6f7b]">Order detail not found.</p></PageCard>;

  const { order, items, events, comments } = data;
  const inventoryMap = inventoryQuery.data ?? {};
  const totalQty = items.reduce((sum, item) => sum + getEffectiveQty(item), 0);
  const totalBilled = items.reduce((sum, item) => sum + getBilledQty(item), 0);
  const totalPending = items.reduce((sum, item) => sum + getPendingQty(item), 0);
  const totalValue = items.reduce((sum, item) => sum + getEffectiveValue(item), 0);
  const status = getOrderStatusLabel({ ...order, items });
  const rawStatus = order.status.toLowerCase();
  const canApprove = (role === 'developer' || role === 'super' || role === 'manager') && rawStatus.includes('pending');
  const canAdmin = role === 'developer' || role === 'admin';
  const canProcess = canAdmin && rawStatus === 'approved';
  const canDispatchInAdmin = canAdmin && rawStatus === 'processed';

  const orderRegDateLabel = compactUniqueLabel(items.map((item) => item.order_reg_date), order.order_reg_date);
  const invoiceLabel = compactUniqueLabel(items.map((item) => item.dbms_invoice_no), order.dbms_invoice_no);
  const invoiceDateLabel = compactUniqueLabel(items.map((item) => item.dbms_invoice_date), order.dbms_invoice_date);
  const docketLabel = compactUniqueLabel(items.map((item) => item.docket_no), order.docket_no);
  const transportLabel = compactUniqueLabel(items.map((item) => item.transport_name), order.transport_name);
  const reportRows = [
    ['Order Reg. Dt', orderRegDateLabel],
    ['BillNo & Image', invoiceLabel],
    ['Billing Dt', invoiceDateLabel],
    ['Transport Name', transportLabel],
    ['Docket', docketLabel],
    ['Billed Qty', String(totalBilled)],
  ];

  const summaryRows = [
    ['Order No', order.order_no],
    ['Final Order No', order.final_order_no || order.processing_reference || '-'],
    ['Branch', order.branch],
    ['Order Type', order.order_type],
    ['Order For', order.order_for === 'Customer' ? order.customer_name || 'Customer' : 'Stock'],
    ['Machine No', order.machine_no || '-'],
    ['Machine Type', order.warranty_status || '-'],
    ['Call ID', order.call_id || '-'],
    ['Approver', order.approver?.full_name || '-'],
    ['Order Reg. Dt', orderRegDateLabel],
    ['BillNo & Image', invoiceLabel],
    ['Billing Dt', invoiceDateLabel],
    ['Transport Name', transportLabel],
    ['Docket', docketLabel],
    ['Notes', order.processed_notes || '-'],
  ];

  return (
    <PageCard eyebrow="Orders" title="Order Detail" description="Shared order review workspace.">
      <div className="no-print mb-3 flex items-center justify-between gap-3">
        <button type="button" className="text-xs font-black text-[#82C8E5] hover:underline" onClick={() => navigate(-1)}>Back</button>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {canApprove ? <button type="button" className="text-xs font-black text-[#82C8E5] hover:underline disabled:opacity-40" disabled={!!busyAction} onClick={() => void runApprovalAction('approve')}>{busyAction === 'approve' ? 'Approving' : 'Approve'}</button> : null}
          {canApprove ? <button type="button" className="text-xs font-black text-[#ef6f7b] hover:underline disabled:opacity-40" disabled={!!busyAction} onClick={() => void runApprovalAction('reject')}>{busyAction === 'reject' ? 'Rejecting' : 'Reject'}</button> : null}
          {canProcess ? <button type="button" className="text-xs font-black text-[#82C8E5] hover:underline disabled:opacity-40" disabled={!!busyAction} onClick={() => void runProcessAction()}>{busyAction === 'process' ? 'Processing' : 'Process'}</button> : null}
          {canDispatchInAdmin ? <button type="button" className="text-xs font-black text-[#82C8E5] hover:underline" onClick={() => navigate('/admin/approved')}>Dispatch Selected Rows</button> : null}
          <button type="button" className="text-xs font-black text-[#82C8E5] hover:underline" onClick={() => window.print()}>Print</button><StatusBadge status={status} />
        </div>
      </div>
      {actionMessage ? <p className="no-print mb-2 text-xs text-[#c7d2df]">{actionMessage}</p> : null}

      <div className="print-area">
      <div className="hidden border-b border-[#263244] pb-2 print:block"><p className="text-lg font-black">Parts Connect Portal - Order Detail</p><p className="text-xs">{order.final_order_no || order.order_no} • {order.branch} • {status}</p></div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {summaryRows.map(([label, value]) => (
          <div key={label} className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6D8196]">{label}</p>
            <p className="mt-1 text-xs font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Status Report Fields</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {reportRows.map(([label, value]) => (
            <div key={label} className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-2">
              <p className="text-[10px] uppercase text-[#6D8196]">{label}</p>
              <p className="mt-1 text-xs font-black text-white">{value}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[#6D8196]">If an order has multiple bill numbers, dockets, or transporters, the item table below shows exact row-wise values.</p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2"><p className="text-[10px] uppercase text-[#6D8196]">Qty</p><p className="text-sm font-black text-white">{totalQty}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2"><p className="text-[10px] uppercase text-[#6D8196]">Billed</p><p className="text-sm font-black text-white">{totalBilled}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2"><p className="text-[10px] uppercase text-[#6D8196]">Pending</p><p className="text-sm font-black text-white">{totalPending}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2"><p className="text-[10px] uppercase text-[#6D8196]">Value</p><p className="text-sm font-black text-white">{formatMoney(totalValue)}</p></div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-[#263244]">
        <table className="w-full min-w-[1360px] border-collapse text-left text-xs">
          <thead className="bg-[#0b1020] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]"><tr><th className="px-2.5 py-2">Part No</th><th className="px-2.5 py-2">Description</th><th className="px-2.5 py-2 text-right">Qty</th><th className="px-2.5 py-2 text-right">Billed</th><th className="px-2.5 py-2 text-right">Pending</th><th className="px-2.5 py-2 text-right">Inventory</th><th className="px-2.5 py-2">Order Reg. Dt</th><th className="px-2.5 py-2">BillNo & Image</th><th className="px-2.5 py-2">Billing Dt</th><th className="px-2.5 py-2">Docket</th><th className="px-2.5 py-2">Transport Name</th><th className="px-2.5 py-2">Received</th><th className="px-2.5 py-2 text-right">Value</th></tr></thead>
          <tbody className="divide-y divide-[#263244] bg-[#111827]">
            {items.map((item) => {
              const pendingQty = getPendingQty(item);
              const inventoryQty = inventoryMap[normalizePartNo(item.part_no)] ?? 0;
              return (
                <tr key={item.id} className="hover:bg-[#182235]"><td className="px-2.5 py-2 font-black text-white">{item.part_no}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{item.description || '-'}</td><td className="px-2.5 py-2 text-right text-[#d8e3ee]">{getEffectiveQty(item)}</td><td className="px-2.5 py-2 text-right text-[#d8e3ee]">{getBilledQty(item)}</td><td className="px-2.5 py-2 text-right text-[#d8e3ee]">{pendingQty}</td><td className="px-2.5 py-2 text-right font-black text-white">{inventoryQuery.isLoading ? '...' : inventoryQty}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{item.order_reg_date || '-'}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{item.dbms_invoice_no || '-'}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{item.dbms_invoice_date || '-'}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{item.docket_no || '-'}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{item.transport_name || '-'}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{formatDate(item.received_date)}</td><td className="px-2.5 py-2 text-right font-black text-white">{formatMoney(getEffectiveValue(item))}</td></tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Comments</p>
            {attachmentMessage ? <p className="text-xs text-[#c7d2df]">{attachmentMessage}</p> : null}
          </div>
          <form onSubmit={handleCommentSubmit} className="no-print mb-3 space-y-2">
            <textarea className="min-h-[72px] w-full rounded-md border border-[#263244] bg-[#111827] px-2.5 py-2 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="Add comment for this order" value={commentText} onChange={(event) => setCommentText(event.target.value)} />
            <div className="flex items-center justify-between gap-3"><p className="text-xs text-[#c7d2df]">{commentMessage}</p><button type="submit" disabled={commentMutation.isPending} className="text-xs font-black text-[#82C8E5] hover:underline disabled:opacity-50">{commentMutation.isPending ? 'Saving...' : 'Add Comment'}</button></div>
          </form>
          <div className="space-y-2">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-2 text-xs">
                <p className="text-white">{comment.body || '-'}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#6D8196]">{comment.comment_type} • {formatDate(comment.created_at)}</p>
                <div className="no-print mt-2 flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer text-[11px] font-black text-[#82C8E5] hover:underline">
                    {attachmentBusy === comment.id ? 'Uploading...' : 'Attach file'}
                    <input type="file" className="hidden" disabled={!!attachmentBusy} onChange={(event) => void handleAttachmentUpload(comment.id, event)} />
                  </label>
                  {comment.attachments.map((attachment) => (
                    <button key={attachment.id} type="button" className="text-[11px] font-black text-[#82C8E5] hover:underline disabled:opacity-50" disabled={!!attachmentBusy} onClick={() => void handleAttachmentDownload(attachment.id)}>
                      {attachmentBusy === attachment.id ? 'Opening...' : `Download ${attachment.original_file_name} (${formatBytes(attachment.file_size_bytes)})`}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {comments.length === 0 ? <p className="text-xs text-[#c7d2df]">No user comments yet.</p> : null}
          </div>
        </div>

        <OrderActivityPanel events={events} />
      </div>
      </div>
    </PageCard>
  );
}
