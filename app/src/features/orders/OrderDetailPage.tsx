import { ChangeEvent, Fragment, FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Paperclip, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { PageCard } from '../../components/ui/PageCard';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { ApprovalOverrideConfirm } from '../../components/ui/ApprovalOverrideConfirm';
import { BlockingActionOverlay } from '../../components/ui/FeedbackModal';
import { useAuth } from '../../auth/useAuth';
import { setTestOrderApproved, setTestOrderManagerApproved, setTestOrderManagerRejected, setTestOrderRejected } from '../../services/testApproval.service';
import { setTestOrderProcessed } from '../../services/testAdmin.service';
import { addTestOrderComment, getTestOrderView } from '../../services/testOrderView.service';
import { getInventoryQtyByBranchParts } from '../../services/testInventoryLookup.service';
import { getCommentAttachmentSignedUrl, uploadCommentAttachment } from '../../services/commentAttachment.service';
import { getBilledQty, getEffectiveQty, getEffectiveValue, getPendingQty, getOrderStatusLabel, getResolvedRowStatus, normalizePartNo } from '../../lib/orderLogic';
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

function normalizeWorkflowStatus(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, '');
}

export function OrderDetailPage() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role, profile } = useAuth();

  const [commentText, setCommentText] = useState('');
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [commentFileInputKey, setCommentFileInputKey] = useState(0);
  const [commentMessage, setCommentMessage] = useState('');
  const [attachmentMessage, setAttachmentMessage] = useState('');
  const [attachmentBusy, setAttachmentBusy] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [processReference, setProcessReference] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [showManagerOverride, setShowManagerOverride] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['test-order-view', orderId], queryFn: () => getTestOrderView(orderId), enabled: !!orderId });
  const inventoryQuery = useQuery({
    queryKey: ['test-order-inventory', data?.order.branch, data?.items.map((item) => item.part_no).join('|')],
    queryFn: () => getInventoryQtyByBranchParts(data!.order.branch, data!.items.map((item) => item.part_no)),
    enabled: !!data?.order.branch && data.items.length > 0,
  });
  const commentMutation = useMutation({
    mutationFn: async () => {
      const comment = await addTestOrderComment(orderId, commentText);
      if (commentFile) await uploadCommentAttachment(orderId, comment.id, commentFile);
      return comment;
    },
    onSuccess: () => {
      setCommentText('');
      setCommentFile(null);
      setCommentFileInputKey((current) => current + 1);
      setCommentMessage('Comment posted.');
      setAttachmentMessage('');
      queryClient.invalidateQueries({ queryKey: ['test-order-view', orderId] });
    },
    onError: (commentError) => setCommentMessage(commentError instanceof Error ? commentError.message : 'Comment failed.'),
  });

  if (isLoading) return <PageCard eyebrow="Orders" title="Order Detail" description="Loading order detail..."><p className="text-xs text-[#667085]">Loading...</p></PageCard>;
  if (error || !data) return <PageCard eyebrow="Orders" title="Order Detail" description="Unable to load order detail."><p className="text-xs text-[#ef6f7b]">Order detail not found.</p></PageCard>;

  const { order, items, events, comments } = data;
  const inventoryMap = inventoryQuery.data ?? {};
  const status = getOrderStatusLabel({ ...order, items });
  const rawStatus = (order.status || '').toLowerCase();
  const workflowStatusKey = normalizeWorkflowStatus(`${order.status ?? ''} ${order.approval_status ?? ''} ${status ?? ''} ${items.map((item) => getResolvedRowStatus(item)).join(' ')}`);
  const isManagerApprovalWorkflow = workflowStatusKey.includes('pendingmanagerapproval');
  const displayStatus = isManagerApprovalWorkflow ? 'PENDING MANAGER APPROVAL' : status;
  const isPendingWorkflow = workflowStatusKey.includes('pending');
  const isSelectedSuperApprover = role === 'super' && order.approver_id === profile?.id;
  const canApprove = (role === 'developer' || isSelectedSuperApprover || role === 'manager') && isPendingWorkflow;
  const canAdmin = role === 'developer' || role === 'admin';
  const canProcess = canAdmin && rawStatus === 'approved';
  const isBlockingAction = !!busyAction || commentMutation.isPending || !!attachmentBusy;
  const blockingLabel = busyAction === 'approve' ? 'Approving order' : busyAction === 'reject' ? 'Rejecting order' : busyAction === 'process' ? 'Processing order' : commentMutation.isPending ? 'Posting comment' : attachmentBusy ? 'Opening attachment' : 'Working';

  const totalQty = items.reduce((sum, item) => sum + getEffectiveQty(item), 0);
  const totalBilled = items.reduce((sum, item) => sum + getBilledQty(item), 0);
  const totalPending = items.reduce((sum, item) => sum + getPendingQty(item), 0);
  const totalValue = items.reduce((sum, item) => sum + getEffectiveValue(item), 0);
  const orderRegDateLabel = compactUniqueLabel(items.map((item) => item.order_reg_date), order.order_reg_date);

  const summaryRows = [
    { label: 'Order Type', value: order.order_type },
    { label: 'Order For', value: order.order_for === 'Customer' ? order.customer_name || 'Customer' : 'Stock' },
    { label: 'Branch', value: order.branch },
    { label: 'Employee Name', value: order.employee?.full_name || '-' },
    { label: 'Status', value: displayStatus, type: 'status' },
    { label: 'Machine No', value: order.machine_no || '-' },
    { label: 'Customer', value: order.customer_name || '-' },
    { label: 'Machine Type', value: order.warranty_status || '-' },
    { label: 'Approved By', value: order.approver?.full_name || '-' },
    { label: 'Call ID', value: order.call_id || '-' },
  ];

  function toggleItem(itemId: string) {
    setExpandedItems((current) => ({ ...current, [itemId]: !current[itemId] }));
  }

  function needsManagerOverride() {
    if (role !== 'manager') return false;
    if (isManagerApprovalWorkflow) return false;
    if (order.approver?.role === 'manager' || order.approver_id === profile?.id) return false;
    return true;
  }

  async function runApprovalAction(action: 'approve' | 'reject', confirmedOverride = false) {
    setActionMessage('');
    if (action === 'approve' && !confirmedOverride && needsManagerOverride()) {
      setShowManagerOverride(true);
      return;
    }
    setBusyAction(action);
    try {
      if (action === 'approve') {
        if (role === 'manager') await setTestOrderManagerApproved(order as unknown as TestOrder);
        else await setTestOrderApproved(order as unknown as TestOrder);
      } else {
        if (role === 'manager') await setTestOrderManagerRejected(order as unknown as TestOrder);
        else await setTestOrderRejected(order as unknown as TestOrder);
      }
      setActionMessage(`${order.order_no} ${action === 'approve' ? (role === 'manager' ? 'approved by manager' : 'sent to manager approval') : 'rejected'}.`);
      setShowManagerOverride(false);
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
    setAttachmentMessage('');
    commentMutation.mutate();
  }

  function handleCommentFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setCommentFile(file);
    setAttachmentMessage(file ? `Selected attachment: ${file.name}` : '');
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

  function downloadOrderWorkbook() {
    const orderNo = order.final_order_no || order.order_no;
    const summaryRowsForExcel: Array<[string, string | number]> = [
      ['Parts Connect Portal', 'Internal Parts Order & Approval Document'],
      ['Order ID', orderNo],
      ['Order Date & Time', formatDate(order.created_at)],
      ['Current Status', displayStatus],
      ['Branch', summaryValue(order.branch)],
      ['Number of Line Items', items.length],
      ['Order Type', summaryValue(order.order_type)],
      ['Order For', String(order.order_for ?? '').toLowerCase() === 'stock' ? 'Stock' : 'Customer'],
      ['Employee Name', summaryValue(order.employee?.full_name || order.employee_name_legacy)],
      ['Call ID', summaryValue(order.call_id)],
      ['Machine No', summaryValue(order.machine_no)],
      ['Machine Type', summaryValue(order.warranty_status)],
      ['Customer', summaryValue(order.customer_name)],
      ['Approved By', summaryValue(order.approved_by_name || order.approved_by_super_name || order.approver?.full_name)],
      ['DBMS Order No', summaryValue(order.final_order_no || order.processing_reference)],
      ['Order Registration Date', orderRegDateLabel],
      ['Processed Date', formatDate(order.processed_date)],
      ['Total Qty', totalQty],
      ['Total Billed Qty', totalBilled],
      ['Total Pending Qty', totalPending],
      ['Total Value', totalValue],
    ];

    const partsRows = items.map((item) => ({
      Part: item.part_no,
      Description: item.description || '-',
      Qty: getEffectiveQty(item),
      Billed: getBilledQty(item),
      Pending: getPendingQty(item),
      Value: getEffectiveValue(item),
      Status: getResolvedRowStatus(item),
      Processed: formatDate(order.processed_date),
      'Registration Date': item.order_reg_date || orderRegDateLabel,
      'Bill No': item.dbms_invoice_no || (item.billing_chunks.length > 1 ? 'Multiple' : '-'),
      'Billing Date': item.dbms_invoice_date || (item.billing_chunks.length > 1 ? 'Multiple' : '-'),
      Transport: item.transport_name || (item.billing_chunks.length > 1 ? 'Multiple' : '-'),
      Docket: item.docket_no || (item.billing_chunks.length > 1 ? 'Multiple' : '-'),
      Inventory: inventoryMap[normalizePartNo(item.part_no)] ?? 0,
      'In Transit': item.in_transit_qty ?? item.previous_30d_qty ?? 0,
    }));

    const billingRows = items.flatMap((item) => item.billing_chunks.map((chunk) => ({
      Part: item.part_no,
      Description: item.description || '-',
      Invoice: chunk.invoice_no || '-',
      'Billing Date': chunk.billing_date || '-',
      Docket: chunk.docket_no || '-',
      Transport: chunk.transport_name || '-',
      'Delivery No': chunk.delivery_no || '-',
      'Billed Qty': Number(chunk.billed_qty ?? 0),
      'Received Qty': Number(chunk.received_qty ?? 0),
      'Received At': formatDate(chunk.received_at),
      Status: chunk.raw_status || '-',
      Uploaded: formatDate(chunk.created_at),
    })));

    const commentRows = comments.map((comment) => ({
      Type: 'Comment',
      User: comment.author?.full_name || 'Unknown User',
      Details: comment.body || '-',
      Attachments: comment.attachments.map((attachment) => attachment.original_file_name).join(', ') || '-',
      Date: formatDate(comment.created_at),
    }));
    const activityRows = events.map((event) => ({
      Type: 'Activity',
      User: '-',
      Details: event.notes || [event.old_status, event.new_status].filter(Boolean).join(' → ') || event.event_type.replace(/_/g, ' '),
      Attachments: '-',
      Date: formatDate(event.created_at),
    }));

    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRowsForExcel);
    const partsSheet = XLSX.utils.json_to_sheet(partsRows);
    const billingSheet = XLSX.utils.json_to_sheet(billingRows.length ? billingRows : [{ Part: '-', Description: 'No billing chunks recorded' }]);
    const historySheet = XLSX.utils.json_to_sheet([...commentRows, ...activityRows].length ? [...commentRows, ...activityRows] : [{ Type: '-', User: '-', Details: 'No comments or activity recorded', Attachments: '-', Date: '-' }]);

    summarySheet['!cols'] = [{ wch: 28 }, { wch: 48 }];
    partsSheet['!cols'] = [{ wch: 16 }, { wch: 32 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 10 }, { wch: 12 }];
    billingSheet['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    historySheet['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 70 }, { wch: 40 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Order Summary');
    XLSX.utils.book_append_sheet(workbook, partsSheet, 'Parts');
    XLSX.utils.book_append_sheet(workbook, billingSheet, 'Billing Details');
    XLSX.utils.book_append_sheet(workbook, historySheet, 'Comments & Activity');
    XLSX.writeFile(workbook, `${orderNo}-order-details.xlsx`);
  }

  return (
    <PageCard eyebrow="Orders" title="Order Detail" description="Shared order review workspace.">
      <BlockingActionOverlay show={isBlockingAction} label={blockingLabel} />

      <div className="no-print mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-[#d9dee7] bg-white px-2.5 py-2">
        {canProcess ? <input className="h-8 w-48 rounded-md border border-[#cfd8e3] bg-white px-2.5 text-xs font-medium uppercase text-[#0f172a] outline-none focus:border-[#0f4c81]" placeholder="DBMS Order No." value={processReference} onChange={(event) => setProcessReference(event.target.value)} disabled={isBlockingAction} /> : null}
        {canProcess ? <button type="button" className="h-8 rounded-md border border-[#cfd8e3] bg-white px-3 text-xs font-medium text-[#0f172a] hover:bg-[#f3f8ff] disabled:opacity-50" disabled={isBlockingAction} onClick={() => void runProcessAction()}>{busyAction === 'process' ? 'Processing' : 'Process'}</button> : null}
        {canApprove ? <button type="button" className="h-8 rounded-md border border-[#b7d7c3] bg-white px-3 text-xs font-medium text-[#14532d] hover:bg-[#f0fdf4] disabled:opacity-50" disabled={isBlockingAction} onClick={() => void runApprovalAction('approve')}>Approve</button> : null}
        {canApprove ? <button type="button" className="h-8 rounded-md border border-[#f2c8c8] bg-white px-3 text-xs font-medium text-[#b42318] hover:bg-[#fff1f3] disabled:opacity-50" disabled={isBlockingAction} onClick={() => void runApprovalAction('reject')}>Reject</button> : null}
        <button type="button" className="h-8 rounded-md border border-[#cfd8e3] bg-white px-3 text-xs font-medium text-[#0f172a] hover:bg-[#f3f8ff]" disabled={isBlockingAction} onClick={downloadOrderWorkbook}>Download</button>
        <button type="button" className="h-8 rounded-md border border-[#cfd8e3] bg-white px-3 text-xs font-medium text-[#0f172a] hover:bg-[#f3f8ff]" disabled={isBlockingAction} onClick={() => window.print()}>Print</button>
        <button type="button" className="h-8 rounded-md border border-[#cfd8e3] bg-white px-3 text-xs font-medium text-[#0f172a] hover:bg-[#f3f8ff]" disabled={isBlockingAction} onClick={() => document.getElementById('order-comments')?.scrollIntoView({ behavior: 'smooth' })}>Comment</button>
        <button type="button" className="h-8 rounded-md border border-[#cfd8e3] bg-white px-3 text-xs font-medium text-[#0f172a] hover:bg-[#f3f8ff]" disabled={isBlockingAction} onClick={() => navigate(-1)}>Back</button>
      </div>

      {actionMessage ? <p className="no-print mb-2 rounded-md border border-[#d9dee7] bg-[#f8fbff] px-3 py-2 text-xs font-medium text-[#344054]">{actionMessage}</p> : null}

      <article id="order-print-document" className="order-print-document" aria-label="Printable order document">
        <header className="print-doc-header">
          <div className="print-brand-block">
            <div className="print-logo-mark">PC</div>
            <div><div className="print-brand">Parts Connect Portal</div><div className="print-subtitle">Internal Parts Order &amp; Approval Document</div></div>
          </div>
          <div><div className="print-title">Parts Order Details</div><div className="print-order-id">Order ID: {order.final_order_no || order.order_no}</div></div>
        </header>

        <div className="print-top-facts">
          <div className="print-fact"><strong>Order Date &amp; Time</strong><span>{formatDate(order.created_at)}</span></div>
          <div className="print-fact"><strong>Branch</strong><span>{summaryValue(order.branch)}</span></div>
          <div className="print-fact"><strong>Current Status</strong><span>{displayStatus}</span></div>
          <div className="print-fact"><strong>Line Items</strong><span>{items.length}</span></div>
        </div>

        <h2 className="print-section-title">Order Summary</h2>
        <div className="print-summary-grid">
          <div className="print-summary-row"><strong>Order Type:</strong><span>{summaryValue(order.order_type)}</span></div>
          <div className="print-summary-row"><strong>Order For:</strong><span>{order.order_for === 'Customer' ? 'Customer' : summaryValue(order.order_for)}</span></div>
          <div className="print-summary-row"><strong>Branch:</strong><span>{summaryValue(order.branch)}</span></div>
          <div className="print-summary-row"><strong>Employee Name:</strong><span>{summaryValue(order.employee?.full_name)}</span></div>
          <div className="print-summary-row"><strong>Call ID:</strong><span>{summaryValue(order.call_id)}</span></div>
          <div className="print-summary-row"><strong>Status:</strong><span>{displayStatus}</span></div>
          <div className="print-summary-row"><strong>Machine No:</strong><span>{summaryValue(order.machine_no)}</span></div>
          <div className="print-summary-row"><strong>Customer:</strong><span>{summaryValue(order.customer_name)}</span></div>
          <div className="print-summary-row"><strong>Machine Type:</strong><span>{summaryValue(order.warranty_status)}</span></div>
          <div className="print-summary-row"><strong>Approved By:</strong><span>{summaryValue(order.approver?.full_name)}</span></div>
          <div className="print-summary-row"><strong>DBMS Order No:</strong><span>{summaryValue(order.final_order_no || order.processing_reference)}</span></div>
          <div className="print-summary-row"><strong>Processed Date:</strong><span>{formatDate(order.processed_date)}</span></div>
        </div>

        <h2 className="print-section-title">Parts Details</h2>
        <table className="print-table">
          <thead><tr><th>Part</th><th>Description</th><th>Qty</th><th>Billed</th><th>Pending</th><th>Value</th><th>Status</th><th>Processed</th><th>Reg Dt</th><th>Bill No</th><th>Billing Dt</th><th>Transport</th><th>Docket</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <Fragment key={`print-item-${item.id}`}>
                <tr>
                  <td>{item.part_no}</td><td>{item.description || '-'}</td>
                  <td className="print-num">{getEffectiveQty(item)}</td><td className="print-num">{getBilledQty(item)}</td><td className="print-num">{getPendingQty(item)}</td>
                  <td className="print-num">{formatMoney(getEffectiveValue(item))}</td><td>{getResolvedRowStatus(item)}</td><td>{formatDate(order.processed_date)}</td>
                  <td>{item.order_reg_date || orderRegDateLabel}</td><td>{item.dbms_invoice_no || (item.billing_chunks.length > 1 ? 'Multiple' : '-')}</td>
                  <td>{item.dbms_invoice_date || (item.billing_chunks.length > 1 ? 'Multiple' : '-')}</td><td>{item.transport_name || (item.billing_chunks.length > 1 ? 'Multiple' : '-')}</td>
                  <td>{item.docket_no || (item.billing_chunks.length > 1 ? 'Multiple' : '-')}</td>
                </tr>
                {item.billing_chunks.length > 1 ? item.billing_chunks.map((chunk) => (
                  <tr className="print-chunk-row" key={`print-chunk-${chunk.id}`}>
                    <td>↳ {item.part_no}</td><td>Billing chunk</td><td>-</td><td className="print-num">{Number(chunk.billed_qty ?? 0)}</td><td>-</td><td>-</td>
                    <td>{chunk.raw_status || '-'}</td><td>{formatDate(chunk.created_at)}</td><td>{chunk.order_reg_date || '-'}</td><td>{chunk.invoice_no || '-'}</td>
                    <td>{chunk.billing_date || '-'}</td><td>{chunk.transport_name || '-'}</td><td>{chunk.docket_no || '-'}</td>
                  </tr>
                )) : null}
              </Fragment>
            ))}
          </tbody>
        </table>

        <div className="print-totals">
          <div className="print-total"><span>Total Qty</span><strong>{totalQty}</strong></div>
          <div className="print-total"><span>Total Billed Qty</span><strong>{totalBilled}</strong></div>
          <div className="print-total"><span>Total Pending Qty</span><strong>{totalPending}</strong></div>
          <div className="print-total"><span>Total Value</span><strong>{formatMoney(totalValue)}</strong></div>
          <div className="print-total"><span>Number of line items</span><strong>{items.length}</strong></div>
        </div>

        <h2 className="print-section-title">Comments &amp; Order Activity</h2>
        <div className="print-history-list">
          {comments.map((comment) => (
            <div className="print-history-row" key={`print-comment-${comment.id}`}>
              <strong>{comment.author?.full_name || 'Unknown User'}</strong><span> — {comment.body || '-'}</span>
              <small>{formatDate(comment.created_at)}{comment.attachments.length ? ` • Attachments: ${comment.attachments.map((attachment) => attachment.original_file_name).join(', ')}` : ''}</small>
            </div>
          ))}
          {events.map((event) => (
            <div className="print-history-row" key={`print-event-${event.id}`}>
              <strong>{event.event_type.replace(/_/g, ' ')}</strong><span> — {event.notes || [event.old_status, event.new_status].filter(Boolean).join(' → ') || '-'}</span>
              <small>{formatDate(event.created_at)}</small>
            </div>
          ))}
          {!comments.length && !events.length ? <div className="print-history-row">No comments or activity recorded.</div> : null}
        </div>
      </article>

      <section className="rounded-lg border border-[#d9dee7] bg-white px-4 py-3">
        <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-[#eef2f6] pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0f4c81]">Order Summary</p>
          <p className="break-all text-sm font-semibold tracking-tight text-[#0f172a]">{order.final_order_no || order.order_no}</p>
          <span className="text-xs font-normal text-[#667085]">{formatDate(order.created_at)}</span>
        </div>

        <div className="grid gap-x-8 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {summaryRows.map((row) => (
            <div key={row.label} className="min-w-0 border-b border-[#f1f5f9] pb-1.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.11em] text-[#64748b]">{row.label}</p>
              {row.type === 'status' ? (
                <div className="mt-1"><StatusBadge status={displayStatus} /></div>
              ) : (
                <p className="mt-0.5 truncate text-sm font-normal text-[#0f172a]" title={summaryValue(row.value)}>{summaryValue(row.value)}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section id="order-comments" className="mt-3 rounded-xl border border-[#d9dee7] bg-white p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0f4c81]">Comments ({comments.length})</p>
          <button type="button" disabled={isBlockingAction} className="rounded-md border border-[#d9dee7] px-2 py-1 text-[10px] font-black text-[#0f172a]" onClick={() => setShowLogs((current) => !current)}>{showLogs ? 'Hide Logs' : 'Show Logs'}</button>
          {attachmentMessage ? <p className="text-xs text-[#667085]">{attachmentMessage}</p> : null}
        </div>

        <form onSubmit={handleCommentSubmit} className="no-print mb-2 flex flex-col gap-2 md:flex-row md:items-center">
          <input className="h-9 flex-1 rounded-md border border-[#d9dee7] bg-white px-3 text-xs text-[#0f172a] outline-none focus:border-[#82C8E5]" placeholder="Add comment for this order" value={commentText} onChange={(event) => setCommentText(event.target.value)} disabled={isBlockingAction} />
          <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#d9dee7] bg-white px-3 text-xs font-black text-[#0f4c81] hover:bg-[#f8fbff]">
            <Paperclip className="h-3.5 w-3.5" />
            Attach
            <input key={commentFileInputKey} type="file" className="hidden" disabled={isBlockingAction} onChange={handleCommentFileChange} />
          </label>
          {commentFile ? (
            <button type="button" className="inline-flex h-9 items-center gap-1 rounded-md border border-[#d9dee7] bg-[#f8fbff] px-2 text-[11px] font-semibold text-[#344054]" onClick={() => { setCommentFile(null); setCommentFileInputKey((current) => current + 1); setAttachmentMessage(''); }} disabled={isBlockingAction}>
              <span className="max-w-[180px] truncate">{commentFile.name}</span><X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button type="submit" disabled={isBlockingAction} className="h-9 rounded-md border border-[#d9dee7] px-4 text-xs font-black text-[#0f172a] disabled:opacity-50">{commentMutation.isPending ? 'Posting' : 'Post'}</button>
        </form>

        {commentMessage ? <p className="mb-2 text-xs text-[#667085]">{commentMessage}</p> : null}

        <div className="space-y-2">
          {comments.map((comment) => {
            const authorName = comment.author?.full_name || 'Unknown User';
            return (
              <div key={comment.id} className="rounded-md border border-[#e4e7ec] bg-[#f8fbff] px-3 py-2 text-xs">
                <p className="font-semibold text-[#0f172a]">{comment.body || '-'}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#667085]">Comment by {authorName} • {formatDate(comment.created_at)}</p>
                {comment.attachments.length ? (
                  <div className="no-print mt-2 flex flex-wrap items-center gap-3">
                    {comment.attachments.map((attachment) => (
                      <button key={attachment.id} type="button" className="inline-flex items-center gap-1.5 rounded-md border border-[#d9dee7] bg-white px-2 py-1 text-[11px] font-black text-[#0f4c81] hover:bg-[#eef8ff] disabled:opacity-50" disabled={isBlockingAction} onClick={() => void handleAttachmentDownload(attachment.id)}>
                        <Paperclip className="h-3.5 w-3.5" />
                        {attachmentBusy === attachment.id ? 'Opening...' : `${attachment.original_file_name} (${formatBytes(attachment.file_size_bytes)})`}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          {comments.length === 0 ? <p className="text-xs text-[#667085]">No user comments yet.</p> : null}
        </div>

        {showLogs ? <div className="mt-3"><OrderActivityPanel events={events} /></div> : null}
      </section>

      <section className="mt-3 rounded-xl border border-[#d9dee7] bg-white p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#0f4c81]">Part Details</p>
        <div className="overflow-hidden rounded-lg border border-[#d9dee7]">
          <table className="w-full min-w-[1540px] border-collapse text-left text-xs">
            <thead className="bg-[#f3f6fb] text-[10px] uppercase tracking-[0.12em] text-[#344054]">
              <tr><th className="px-2 py-2">Chunks</th><th className="px-2 py-2">Part</th><th className="px-2 py-2">Description</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Billed</th><th className="px-2 py-2 text-right">Pending</th><th className="px-2 py-2 text-right">Value</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Processed</th><th className="px-2 py-2">Reg Dt</th><th className="px-2 py-2">Bill No</th><th className="px-2 py-2">Billing Dt</th><th className="px-2 py-2">Transport</th><th className="px-2 py-2">Docket</th><th className="px-2 py-2 text-right">Inv</th><th className="px-2 py-2 text-right">PrevQty 30d</th></tr>
            </thead>
            <tbody className="divide-y divide-[#e4e7ec] bg-white">
              {items.map((item) => {
                const inventoryQty = inventoryMap[normalizePartNo(item.part_no)] ?? 0;
                const isExpanded = !!expandedItems[item.id];
                const chunkCount = item.billing_chunks.length;
                const rowDisplayStatus = getResolvedRowStatus(item);
                return (
                  <Fragment key={item.id}>
                    <tr className="hover:bg-[#f8fbff]">
                      <td className="px-2 py-2">
                        {chunkCount ? (
                          <button type="button" className="inline-flex items-center gap-1 rounded-md border border-[#d9dee7] px-2 py-1 text-[11px] font-semibold text-[#0f4c81] hover:bg-[#eef8ff]" onClick={() => toggleItem(item.id)}>
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            {chunkCount}
                          </button>
                        ) : <span className="text-[#94a3b8]">-</span>}
                      </td>
                      <td className="px-2 py-2 font-black text-[#0f4c81]">{item.part_no}</td><td className="px-2 py-2 text-[#0f172a]">{item.description || '-'}</td><td className="px-2 py-2 text-right font-semibold text-[#0f172a]">{getEffectiveQty(item)}</td><td className="px-2 py-2 text-right text-[#0f172a]">{getBilledQty(item)}</td><td className="px-2 py-2 text-right font-black text-[#0f4c81]">{getPendingQty(item)}</td><td className="px-2 py-2 text-right font-black text-[#0f172a]">{formatMoney(getEffectiveValue(item))}</td><td className="px-2 py-2"><StatusBadge status={rowDisplayStatus} /></td><td className="px-2 py-2 text-[#344054]">{order.processed_date || '-'}</td><td className="px-2 py-2 text-[#344054]">{item.order_reg_date || orderRegDateLabel}</td><td className="px-2 py-2 text-[#344054]">{item.dbms_invoice_no || (chunkCount > 1 ? 'Multiple' : '-')}</td><td className="px-2 py-2 text-[#344054]">{item.dbms_invoice_date || (chunkCount > 1 ? 'Multiple' : '-')}</td><td className="px-2 py-2 text-[#344054]">{item.transport_name || (chunkCount > 1 ? 'Multiple' : '-')}</td><td className="px-2 py-2 text-[#344054]">{item.docket_no || (chunkCount > 1 ? 'Multiple' : '-')}</td><td className="px-2 py-2 text-right font-semibold text-[#0f172a]">{inventoryQuery.isLoading ? '...' : inventoryQty}</td><td className="px-2 py-2 text-right text-[#0f172a]">{item.previous_30d_qty ?? 0}</td>
                    </tr>
                    {isExpanded ? (
                      <tr>
                        <td colSpan={16} className="bg-[#f8fbff] px-4 py-3">
                          <div className="rounded-lg border border-[#d9dee7] bg-white">
                            <div className="border-b border-[#eef2f6] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f4c81]">Billing / Docket Chunks</div>
                            <table className="w-full min-w-[980px] border-collapse text-left text-[11px]">
                              <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-[0.1em] text-[#64748b]"><tr><th className="px-2 py-2">Invoice</th><th className="px-2 py-2">Billing Date</th><th className="px-2 py-2">Docket</th><th className="px-2 py-2">Transport</th><th className="px-2 py-2">Delivery</th><th className="px-2 py-2 text-right">Billed Qty</th><th className="px-2 py-2">Raw Status</th><th className="px-2 py-2">Uploaded</th></tr></thead>
                              <tbody className="divide-y divide-[#eef2f6]">
                                {item.billing_chunks.map((chunk) => (
                                  <tr key={chunk.id}>
                                    <td className="px-2 py-2 text-[#0f172a]">{chunk.invoice_no || '-'}</td>
                                    <td className="px-2 py-2 text-[#475569]">{chunk.billing_date || '-'}</td>
                                    <td className="px-2 py-2 font-semibold text-[#0f4c81]">{chunk.docket_no || '-'}</td>
                                    <td className="px-2 py-2 text-[#475569]">{chunk.transport_name || '-'}</td>
                                    <td className="px-2 py-2 text-[#475569]">{chunk.delivery_no || '-'}</td>
                                    <td className="px-2 py-2 text-right font-semibold text-[#0f172a]">{Number(chunk.billed_qty ?? 0)}</td>
                                    <td className="px-2 py-2 text-[#475569]">{chunk.raw_status || '-'}</td>
                                    <td className="px-2 py-2 text-[#475569]">{formatDate(chunk.created_at)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-xl border border-[#c7d7e5] bg-gradient-to-br from-[#f8fbff] via-white to-[#eef8ff] p-3 shadow-[0_10px_26px_rgba(15,76,129,0.08)]">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#d9e7f2] pb-2"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0f4c81]">Order Totals</p><p className="text-[11px] font-semibold text-[#667085]">Separate summary calculated from all part rows</p></div><div className="rounded-full border border-[#82C8E5] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#0f4c81]">Summary</div></div>
          <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-[#d9dee7] bg-white px-3 py-2 shadow-sm"><span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">Total Qty</span><p className="mt-1 text-lg font-black text-[#0f172a]">{totalQty}</p></div>
            <div className="rounded-lg border border-[#d9dee7] bg-white px-3 py-2 shadow-sm"><span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">Billed Qty</span><p className="mt-1 text-lg font-black text-[#0f172a]">{totalBilled}</p></div>
            <div className="rounded-lg border border-[#d9dee7] bg-white px-3 py-2 shadow-sm"><span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">Pending Qty</span><p className="mt-1 text-lg font-black text-[#0f4c81]">{totalPending}</p></div>
            <div className="rounded-lg border border-[#d9dee7] bg-white px-3 py-2 shadow-sm"><span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">Total Value</span><p className="mt-1 text-lg font-black text-[#0f172a]">{formatMoney(totalValue)}</p></div>
          </div>
        </div>
      </section>

      <ApprovalOverrideConfirm open={showManagerOverride} approverName={order.approver?.full_name || 'The selected super approver'} orderNo={order.order_no} busy={busyAction === 'approve'} onCancel={() => setShowManagerOverride(false)} onConfirm={() => void runApprovalAction('approve', true)} />
    </PageCard>
  );
}
