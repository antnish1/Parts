export type LegacyLikeOrderItem = {
  id?: string;
  part_no?: string | null;
  PartNo?: string | null;
  qty?: number | string | null;
  Qty?: number | string | null;
  edited_qty?: number | string | null;
  editedqty?: number | string | null;
  value?: number | string | null;
  Value?: number | string | null;
  edited_value?: number | string | null;
  editedvalue?: number | string | null;
  billed_qty?: number | string | null;
  BilledQty?: number | string | null;
  row_status?: string | null;
  status?: string | null;
  Status?: string | null;
  approval_status?: string | null;
  ApprovalStatus?: string | null;
  billing_chunks?: Array<{ billed_qty?: number | string | null; received_qty?: number | string | null; received_at?: string | null }>;
};

export type LegacyLikeOrder = LegacyLikeOrderItem & {
  order_no?: string | null;
  OrderNo?: string | null;
  items?: LegacyLikeOrderItem[];
};

export function normalizePartNo(partNo: string | null | undefined) {
  return (partNo || '').toString().replace(/\s/g, '').toUpperCase();
}

export function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== '';
}

export function getEffectiveQty(row: LegacyLikeOrderItem) {
  const edited = row.edited_qty ?? row.editedqty;
  if (hasValue(edited)) return Math.max(0, toNumber(edited));
  return Math.max(0, toNumber(row.qty ?? row.Qty));
}

export function getEffectiveValue(row: LegacyLikeOrderItem) {
  const edited = row.edited_value ?? row.editedvalue;
  if (hasValue(edited)) return Math.max(0, toNumber(edited));
  return Math.max(0, toNumber(row.value ?? row.Value));
}

export function getBilledQty(row: LegacyLikeOrderItem) {
  if (row.billing_chunks?.length) return row.billing_chunks.reduce((sum, chunk) => sum + Math.max(0, toNumber(chunk.billed_qty)), 0);
  return Math.max(0, toNumber(row.billed_qty ?? row.BilledQty));
}

export function getReceivedQty(row: LegacyLikeOrderItem) {
  if (!row.billing_chunks?.length) return 0;
  return row.billing_chunks.reduce((sum, chunk) => sum + Math.max(0, toNumber(chunk.received_qty)), 0);
}

export function getPendingQty(row: LegacyLikeOrderItem) {
  return Math.max(0, getEffectiveQty(row) - getBilledQty(row));
}

export function getPendingReceiveQty(row: LegacyLikeOrderItem) {
  return Math.max(0, getBilledQty(row) - getReceivedQty(row));
}

export function normalizeStatus(status: string | null | undefined) {
  const value = (status || '').toString().trim().replace(/_/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').toUpperCase();
  if (!value) return 'NA';
  if (value === 'PENDINGAPPROVAL' || value === 'APPROVAL PENDING') return 'PENDING APPROVAL';
  if (value === 'PENDINGMANAGERAPPROVAL') return 'PENDING MANAGER APPROVAL';
  if (value === 'PARTIAL DISPATCHED' || value === 'PARTIAL DESPATCHED') return 'PARTIALLY DISPATCHED';
  if (value === 'DESPATCHED') return 'DISPATCHED';
  if (value === 'NOT DESPATCHED') return 'NOT DISPATCHED';
  return value;
}

function getBillingDrivenStatus(row: LegacyLikeOrderItem) {
  const rawBilled = row.billed_qty ?? row.BilledQty;
  if (!hasValue(rawBilled) && !row.billing_chunks?.length) return '';

  const billed = getBilledQty(row);
  const received = getReceivedQty(row);
  const qty = getEffectiveQty(row);
  if (received > 0) {
    if (qty <= 0 || received >= qty) return 'RECEIVED';
    return 'PARTIALLY RECEIVED';
  }
  if (billed <= 0) return 'PROCESSED';
  if (qty <= 0) return 'DISPATCHED';
  if (billed >= qty) return 'DISPATCHED';
  return 'PARTIALLY DISPATCHED';
}

export function isPendingApprovalStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  return normalized === 'PENDING APPROVAL' || normalized === 'PENDING MANAGER APPROVAL';
}

export function getResolvedRowStatus(row: LegacyLikeOrderItem) {
  const rowStatus = normalizeStatus(row.row_status ?? '');
  const approval = normalizeStatus(row.approval_status ?? row.ApprovalStatus ?? '');
  const status = normalizeStatus(row.status ?? row.Status ?? '');

  if (rowStatus === 'REJECTED' || approval === 'REJECTED' || status === 'REJECTED') return 'REJECTED';

  const billingDriven = getBillingDrivenStatus(row);
  if (billingDriven && ['PROCESSED', 'ISSUED', 'DISPATCHED', 'PARTIALLY DISPATCHED', 'PARTIALLY RECEIVED', 'RECEIVED'].includes(rowStatus || status)) return billingDriven;
  if (billingDriven && rowStatus === 'NA' && ['PROCESSED', 'ISSUED', 'DISPATCHED', 'PARTIALLY DISPATCHED', 'PARTIALLY RECEIVED', 'RECEIVED', 'NA'].includes(status)) return billingDriven;

  if (rowStatus === 'RECEIVED' || status === 'RECEIVED') return 'RECEIVED';
  if (rowStatus !== 'NA') return rowStatus;
  if (approval === 'PENDING MANAGER APPROVAL') return 'PENDING MANAGER APPROVAL';
  if (approval === 'PENDING APPROVAL') return 'PENDING APPROVAL';
  if (approval === 'APPROVED' && (status === 'NA' || status === 'PENDING APPROVAL')) return 'APPROVED';
  return status === 'NA' ? approval : status;
}

export function getOrderStatusLabel(order: LegacyLikeOrder | LegacyLikeOrderItem[]) {
  const items = Array.isArray(order) ? order : order.items || [order];
  if (!items.length) return 'NA';
  const statuses = items.map(getResolvedRowStatus).filter((status) => status !== 'NA');
  if (!statuses.length) return 'NA';

  const hasFulfillment = statuses.some((status) => ['PROCESSED', 'PARTIALLY DISPATCHED', 'DISPATCHED', 'ISSUED', 'PARTIALLY RECEIVED', 'RECEIVED'].includes(status));
  if (hasFulfillment) {
    if (statuses.every((status) => status === 'RECEIVED')) return 'RECEIVED';
    if (statuses.some((status) => status === 'RECEIVED' || status === 'PARTIALLY RECEIVED')) return 'PARTIALLY RECEIVED';
    if (statuses.every((status) => status === 'DISPATCHED')) return 'DISPATCHED';
    if (statuses.some((status) => status === 'DISPATCHED' || status === 'PARTIALLY DISPATCHED')) return 'PARTIALLY DISPATCHED';
    if (statuses.every((status) => status === 'ISSUED')) return 'ISSUED';
    if (statuses.some((status) => status === 'ISSUED')) return 'ISSUED';
    if (statuses.every((status) => status === 'PROCESSED')) return 'PROCESSED';
    return 'PROCESSED';
  }

  if (statuses.every((status) => status === 'REJECTED')) return 'REJECTED';
  if (statuses.some((status) => status === 'REJECTED')) return 'PARTIALLY REJECTED';
  if (statuses.some((status) => status === 'PENDING MANAGER APPROVAL')) return 'PENDING MANAGER APPROVAL';
  if (statuses.some((status) => status === 'PENDING APPROVAL')) return 'PENDING APPROVAL';
  if (statuses.some((status) => status === 'APPROVED')) return 'APPROVED';
  return statuses[0] || 'NA';
}

export function getPrintableStatusLabel(statusOrRow: string | LegacyLikeOrderItem | null | undefined) {
  const normalized = typeof statusOrRow === 'object' && statusOrRow
    ? getResolvedRowStatus(statusOrRow)
    : normalizeStatus(statusOrRow || '');
  const labels: Record<string, string> = {
    'PENDING APPROVAL': 'Pending Approval',
    'PENDING MANAGER APPROVAL': 'Pending Manager Approval',
    APPROVED: 'Approved',
    PROCESSED: 'Processed',
    DISPATCHED: 'Dispatched',
    ISSUED: 'Issued',
    'PARTIALLY DISPATCHED': 'Partially Dispatched',
    RECEIVED: 'Received',
    'PARTIALLY RECEIVED': 'Partially Received',
    'PARTIALLY REJECTED': 'Partially Rejected',
    'NOT DISPATCHED': 'Not Dispatched',
    REJECTED: 'Rejected',
  };
  return labels[normalized] || normalized;
}

export function shouldShowOrder(order: LegacyLikeOrder, includeZero = false) {
  if (includeZero) return true;
  const items = order.items || [order];
  const totalQty = items.reduce((sum, item) => sum + getEffectiveQty(item), 0);
  const totalValue = items.reduce((sum, item) => sum + getEffectiveValue(item), 0);
  return !(totalQty === 0 && totalValue === 0);
}

export function groupRowsByOrder<T extends LegacyLikeOrderItem & { order_no?: string | null; OrderNo?: string | null; created_at?: string | null }>(rows: T[]) {
  const grouped = new Map<string, T & { items: T[] }>();
  rows.forEach((row) => {
    const orderNo = (row.order_no ?? row.OrderNo ?? '').toString();
    if (!orderNo) return;
    const existing = grouped.get(orderNo);
    if (!existing) {
      grouped.set(orderNo, { ...row, items: [row] });
      return;
    }
    existing.items.push(row);
    const existingTime = new Date(existing.created_at || 0).getTime();
    const rowTime = new Date(row.created_at || 0).getTime();
    if (rowTime && (!existingTime || rowTime < existingTime)) existing.created_at = row.created_at;
  });
  return [...grouped.values()];
}
