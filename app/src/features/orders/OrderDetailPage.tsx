import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
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
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
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

function summaryValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '-' : String(value);
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
  const [processReference, setProcessReference] = useState('');
  const [showLogs, setShowLogs] = useState(false);
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

  const order = data?.order;
  const items = data?.items ?? [];
  const comments = data?.comments ?? [];
  const events = data?.events ?? [];
  const inventoryMap = inventoryQuery.data ?? {};
  const status = data ? getOrderStatusLabel({ ...data.order, items }) : '';
  const rawStatus = order?.status.toLowerCase() ?? '';
  const canApprove = (role === 'developer' || role === 'super' || role === 'manager') && rawStatus.includes('pending');
  const canAdmin = role === 'developer' || role === 'admin';
  const canProcess = canAdmin && rawStatus === 'approved';
  const totalQty = items.reduce((sum, item) => sum + getEffectiveQty(item), 0);
  const totalBilled = items.reduce((sum, item) => sum + getBilledQty(item), 0);
  const totalPending = items.reduce((sum, item) => sum + getPendingQty(item), 0);
  const totalValue = items.reduce((sum, item) => sum + getEffectiveValue(item), 0);

  const orderRegDateLabel = useMemo(() => compactUniqueLabel(items.map((item) => item.order_reg_date), order?.order_reg_date), [items, order?.order_reg_date]);
  const invoiceLabel = useMemo(() => compactUniqueLabel(items.map((item) => item.dbms_invoice_no), order?.dbms_invoice_no), [items, order?.dbms_invoice_no]);
  const invoiceDateLabel = useMemo(() => compactUniqueLabel(items.map((item) => item.dbms_invoice_date), order?.dbms_invoice_date), [items, order?.dbms_invoice_date]);
  const docketLabel = useMemo(() => compactUniqueLabel(items.map((item) => item.docket_no), order?.docket_no), [items, order?.docket_no]);
  const transportLabel = useMemo(() => compactUniqueLabel(items.map((item) => item.transport_name), order?.transport_name), [items, order?.transport_name]);

  if (isLoading) return <PageCard eyebrow="Orders" title="Order Detail" description="Loading order detail..."><p className="text-xs text-[#667085]">Loading...</p></PageCard>;
  if (error || !data || !order) return <PageCard eyebrow="Orders" title="Order Detail" description="Unable to load order detail."><p className="text-xs text-[#ef6f7b]">Order detail not found.</p></PageCard>;

  const summaryRows = [
    ['Order Type', order.order_type, false],
    ['Order For', order.order_for === 'Customer' ? order.customer_name || 'Customer' : 'Stock', true],
    ['Branch', order.branch, true],
    ['Employee Name', order.created_by?.full_name || '-', false],
    ['Call ID', order.call_id || '-', false],
    ['Status', status, true],
    ['Machine No', order.machine_no || '-', true],
    ['Customer', order.customer_name || '-', true],
    ['Machine Type', order.warranty_status || '-', true],
    ['Approved By', order.approver?.full_name || '-', true],
  ] as const;

  async function runApprovalAction(action: 'approve' | 'reject') {
    setActionMessage('');
    setBusyAction(action);
    try {
      if (action === 'approve') await setTestOrderApproved(order as unknown as TestOrder);
      else await setTestOrderRejected(order as unknown as TestOrder);
      setActionMessage(`${order.order_no} ${action === 'approve' ? 'approved' : 'rejected'}.`);
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['test-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['order-list-paged'] });
    } catch (approvalError) {
      setActionMessage(approvalError instanceof Error ? approvalError.message : 'Approval action failed.');
    } finally {
      setBusyAction('');
    }
  }

  async function runProcessAction() {
    const finalNo = processReference.trim().toUpperCase();
    if (!finalNo) return setActionMessage('DBMS order number is required.');
    setActionMessage('');
    setBusyAction('process');
    try {
      await setTestOrderProcessed(order as unknown as TestOrder, finalNo);
      setProcessReference('');
      setActionMessage(`Order processed with DBMS Order No. ${finalNo}.`);
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['test-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['order-list-paged'] });
    } catch (adminError) {
      setActionMessage(adminError instanceof Error ? adminError.message : 'Admin action failed.');
    } finally {
      setBusyAction('');
    }
  }

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

  function downloadCsv() {
    const rows = [
      ['Part', 'Description', 'Qty', 'Billed', 'Pending', 'Value', 'Status', 'Processed', 'Reg Dt', 'Bill No', 'Billing Dt', 'Transport', 'Docket', 'Inventory', 'Prev 30d'],
      ...items.map((item) => [
        item.part_no,
        item.description || '',
        getEffectiveQty(item),
        getBilledQty(item),
        getPendingQty(item),
        getEffectiveValue(item),
        item.row_status || status,
        item.processed_date || order.processed_date || '',
        item.order_reg_date || orderRegDateLabel,
        item.dbms_invoice_no || '',
        item.dbms_invoice_date || '',
        item.transport_name || '',
        item.docket_no || '',
        inventoryMap[normalizePartNo(item.part_no)] ?? 0,
        item.previous_30d_qty ?? 0,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${order.final_order_no || order.order_no}-parts.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageCard eyebrow="Orders" title="Order Detail" description="Shared order review workspace.">
      <div className="no-print mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#d9dee7] bg-[#f8fbff] p-2">
        {canProcess ? <input className="h-10 w-56 rounded-lg border border-[#82C8E5] bg-white px-3 text-sm font-black uppercase text-[#0f172a] outline-none focus:border-[#0f4c81]" placeholder="DBMS Order No." value={processReference} onChange={(event) => setProcessReference(event.target.value)} disabled={busyAction === 'process'} /> : null}
        {canProcess ? <button type="button" className="h-10 rounded-lg border border-[#d9dee7] bg-white px-4 text-xs font-black text-[#0f172a] hover:bg-[#e6f4ff] disabled:opacity-50" disabled={busyAction === 'process'} onClick={() => void runProcessAction()}>{busyAction === 'process' ? 'Processing' : 'Process'}</button> : null}
        {canApprove ? <button type="button" className="h-10 rounded-lg border border-[#d9dee7] bg-white px-4 text-xs font-black text-[#0f172a] hover:bg-[#ecfdf3] disabled:opacity-50" disabled={!!busyAction} onClick={() => void runApprovalAction('approve')}>Approve</button> : null}
        {canApprove ? <button type="button" className="h-10 rounded-lg border border-[#d9dee7] bg-white px-4 text-xs font-black text-[#b42318] hover:bg-[#fff1f3] disabled:opacity-50" disabled={!!busyAction} onClick={() => void runApprovalAction('reject')}>Reject</button> : null}
        <button type="button" className="h-10 rounded-lg border border-[#d9dee7] bg-white px-4 text-xs font-black text-[#0f172a] hover:bg-[#e6f4ff]" onClick={downloadCsv}>Download</button>
        <button type="button" className="h-10 rounded-lg border border-[#d9dee7] bg-white px-4 text-xs font-black text-[#0f172a] hover:bg-[#e6f4ff]" onClick={() => window.print()}>Print</button>
        <button type="button" className="h-10 rounded-lg border border-[#d9dee7] bg-white px-4 text-xs font-black text-[#0f172a] hover:bg-[#e6f4ff]" onClick={() => document.getElementById('order-comments')?.scrollIntoView({ behavior: 'smooth' })}>Comment</button>
        <button type="button" className="h-10 rounded-lg border border-[#d9dee7] bg-white px-4 text-xs font-black text-[#0f172a] hover:bg-[#e6f4ff]" onClick={() => navigate(-1)}>Back</button>
      </div>

      {actionMessage ? <p className="no-print mb-2 rounded-md border border-[#d9dee7] bg-[#f8fbff] px-3 py-2 text-xs font-semibold text-[#344054]">{actionMessage}</p> : null}

      <section className="rounded-xl border border-[#d9dee7] bg-white p-3">
        <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-[#e4e7ec] pb-2">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0f4c81]">Order Summary</p>
          <p className="text-lg font-black text-[#0f172a]">{order.final_order_no || order.order_no}</p>
          <p className="text-xs font-semibold text-[#667085]">{formatDate(order.created_at)}</p>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {summaryRows.map(([label, value, highlight]) => (
            <div key={label} className={`rounded-lg border px-3 py-2 ${highlight ? 'border-[#82C8E5] bg-[#f0f9ff]' : 'border-[#d9dee7] bg-[#f8fbff]'}`}>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#0f4c81]">{label}</p>
              {label === 'Status' ? <div className="mt-1"><StatusBadge status={status} /></div> : <p className="mt-1 text-sm font-black text-[#0f172a]">{summaryValue(value)}</p>}
            </div>
          ))}
        </div>
      </section>

      <section id="order-comments" className="mt-3 rounded-xl border border-[#d9dee7] bg-white p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0f4c81]">Comments ({comments.length})</p>
          <button type="button" className="rounded-md border border-[#d9dee7] px-2 py-1 text-[10px] font-black text-[#0f172a]" onClick={() => setShowLogs((current) => !current)}>{showLogs ? 'Hide Logs' : 'Show Logs'}</button>
          {attachmentMessage ? <p className="text-xs text-[#667085]">{attachmentMessage}</p> : null}
        </div>
        <form onSubmit={handleCommentSubmit} className="no-print mb-2 flex gap-2">
          <input className="h-9 flex-1 rounded-md border border-[#d9dee7] bg-white px-3 text-xs text-[#0f172a] outline-none focus:border-[#82C8E5]" placeholder="Add comment for this order" value={commentText} onChange={(event) => setCommentText(event.target.value)} />
          <button type="submit" disabled={commentMutation.isPending} className="rounded-md border border-[#d9dee7] px-3 text-xs font-black text-[#0f172a] disabled:opacity-50">{commentMutation.isPending ? 'Saving' : 'Add'}</button>
        </form>
        {commentMessage ? <p className="mb-2 text-xs text-[#667085]">{commentMessage}</p> : null}
        <div className="space-y-2">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-md border border-[#e4e7ec] bg-[#f8fbff] px-3 py-2 text-xs">
              <p className="font-semibold text-[#0f172a]">{comment.body || '-'}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#667085]">{comment.comment_type} • {formatDate(comment.created_at)}</p>
              <div className="no-print mt-2 flex flex-wrap items-center gap-3">
                <label className="cursor-pointer text-[11px] font-black text-[#0f4c81] hover:underline">
                  {attachmentBusy === comment.id ? 'Uploading...' : 'Attach file'}
                  <input type="file" className="hidden" disabled={!!attachmentBusy} onChange={(event) => void handleAttachmentUpload(comment.id, event)} />
                </label>
                {comment.attachments.map((attachment) => (
                  <button key={attachment.id} type="button" className="text-[11px] font-black text-[#0f4c81] hover:underline disabled:opacity-50" disabled={!!attachmentBusy} onClick={() => void handleAttachmentDownload(attachment.id)}>
                    {attachmentBusy === attachment.id ? 'Opening...' : `Download ${attachment.original_file_name} (${formatBytes(attachment.file_size_bytes)})`}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {comments.length === 0 ? <p className="text-xs text-[#667085]">No user comments yet.</p> : null}
        </div>
        {showLogs ? <div className="mt-3"><OrderActivityPanel events={events} /></div> : null}
      </section>

      <section className="mt-3 rounded-xl border border-[#d9dee7] bg-white p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#0f4c81]">Part Details</p>
        <div className="overflow-hidden rounded-lg border border-[#d9dee7]">
          <table className="w-full min-w-[1450px] border-collapse text-left text-xs">
            <thead className="bg-[#f3f6fb] text-[10px] uppercase tracking-[0.12em] text-[#344054]">
              <tr><th className="px-2 py-2">Part</th><th className="px-2 py-2">Description</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Billed</th><th className="px-2 py-2 text-right">Pending</th><th className="px-2 py-2 text-right">Value</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Processed</th><th className="px-2 py-2">Reg Dt</th><th className="px-2 py-2">Bill No</th><th className="px-2 py-2">Billing Dt</th><th className="px-2 py-2">Transport</th><th className="px-2 py-2">Docket</th><th className="px-2 py-2 text-right">Inv</th><th className="px-2 py-2 text-right">PrevQty 30d</th></tr>
            </thead>
            <tbody className="divide-y divide-[#e4e7ec] bg-white">
              {items.map((item) => {
                const inventoryQty = inventoryMap[normalizePartNo(item.part_no)] ?? 0;
                return (
                  <tr key={item.id} className="hover:bg-[#f8fbff]">
                    <td className="px-2 py-2 font-black text-[#0f4c81]">{item.part_no}</td>
                    <td className="px-2 py-2 text-[#0f172a]">{item.description || '-'}</td>
                    <td className="px-2 py-2 text-right font-semibold text-[#0f172a]">{getEffectiveQty(item)}</td>
                    <td className="px-2 py-2 text-right text-[#0f172a]">{getBilledQty(item)}</td>
                    <td className="px-2 py-2 text-right font-black text-[#0f4c81]">{getPendingQty(item)}</td>
                    <td className="px-2 py-2 text-right font-black text-[#0f172a]">{formatMoney(getEffectiveValue(item))}</td>
                    <td className="px-2 py-2"><StatusBadge status={item.row_status || status} /></td>
                    <td className="px-2 py-2 text-[#344054]">{item.processed_date || order.processed_date || '-'}</td>
                    <td className="px-2 py-2 text-[#344054]">{item.order_reg_date || orderRegDateLabel}</td>
                    <td className="px-2 py-2 text-[#344054]">{item.dbms_invoice_no || '-'}</td>
                    <td className="px-2 py-2 text-[#344054]">{item.dbms_invoice_date || '-'}</td>
                    <td className="px-2 py-2 text-[#344054]">{item.transport_name || '-'}</td>
                    <td className="px-2 py-2 text-[#344054]">{item.docket_no || '-'}</td>
                    <td className="px-2 py-2 text-right font-semibold text-[#0f172a]">{inventoryQuery.isLoading ? '...' : inventoryQty}</td>
                    <td className="px-2 py-2 text-right text-[#0f172a]">{item.previous_30d_qty ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-md border border-[#d9dee7] bg-[#f8fbff] px-3 py-2"><span className="text-[#667085]">Qty</span><p className="font-black text-[#0f172a]">{totalQty}</p></div>
          <div className="rounded-md border border-[#d9dee7] bg-[#f8fbff] px-3 py-2"><span className="text-[#667085]">Billed</span><p className="font-black text-[#0f172a]">{totalBilled}</p></div>
          <div className="rounded-md border border-[#d9dee7] bg-[#f8fbff] px-3 py-2"><span className="text-[#667085]">Pending</span><p className="font-black text-[#0f172a]">{totalPending}</p></div>
          <div className="rounded-md border border-[#d9dee7] bg-[#f8fbff] px-3 py-2"><span className="text-[#667085]">Value</span><p className="font-black text-[#0f172a]">{formatMoney(totalValue)}</p></div>
        </div>
      </section>
    </PageCard>
  );
}
