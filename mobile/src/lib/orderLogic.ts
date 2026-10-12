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

export function normalizePartNo(partNo: string | null | undefined) { return (partNo || '').toString().replace(/\s/g, '').toUpperCase(); }
export function getPendingQty(row: LegacyLikeOrderItem) { return Math.max(0, getEffectiveQty(row) - getBilledQty(row)); }

function hasValue(value: unknown) { return value !== null && value !== undefined && value !== ''; }
function toNumber(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
export function getEffectiveQty(row: LegacyLikeOrderItem) { const edited = row.edited_qty ?? row.editedqty; return Math.max(0, hasValue(edited) ? toNumber(edited) : toNumber(row.qty ?? row.Qty)); }
export function getEffectiveValue(row: LegacyLikeOrderItem) { const edited = row.edited_value ?? row.editedvalue; return Math.max(0, hasValue(edited) ? toNumber(edited) : toNumber(row.value ?? row.Value)); }
export function getBilledQty(row: LegacyLikeOrderItem) { if (row.billing_chunks?.length) return row.billing_chunks.reduce((sum, chunk) => sum + Math.max(0, toNumber(chunk.billed_qty)), 0); return Math.max(0, toNumber(row.billed_qty ?? row.BilledQty)); }
export function getReceivedQty(row: LegacyLikeOrderItem) { if (!row.billing_chunks?.length) return 0; return row.billing_chunks.reduce((sum, chunk) => sum + Math.max(0, toNumber(chunk.received_qty)), 0); }
export function normalizeStatus(status: string | null | undefined) {
  const value = String(status ?? '').trim().replace(/_/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').toUpperCase();
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
  const billed = getBilledQty(row), received = getReceivedQty(row), qty = getEffectiveQty(row);
  if (received > 0) return qty <= 0 || received >= qty ? 'RECEIVED' : 'PARTIALLY RECEIVED';
  if (billed <= 0) return 'PROCESSED';
  if (qty <= 0 || billed >= qty) return 'DISPATCHED';
  return 'PARTIALLY DISPATCHED';
}
export function getResolvedRowStatus(row: LegacyLikeOrderItem) {
  const rowStatus = normalizeStatus(row.row_status ?? '');
  const approval = normalizeStatus(row.approval_status ?? row.ApprovalStatus ?? '');
  const status = normalizeStatus(row.status ?? row.Status ?? '');
  if (rowStatus === 'REJECTED' || approval === 'REJECTED' || status === 'REJECTED') return 'REJECTED';
  const billingDriven = getBillingDrivenStatus(row);
  if (billingDriven && ['PROCESSED','ISSUED','DISPATCHED','PARTIALLY DISPATCHED','PARTIALLY RECEIVED','RECEIVED'].includes(rowStatus || status)) return billingDriven;
  if (billingDriven && rowStatus === 'NA' && ['PROCESSED','ISSUED','DISPATCHED','PARTIALLY DISPATCHED','PARTIALLY RECEIVED','RECEIVED','NA'].includes(status)) return billingDriven;
  if (rowStatus === 'RECEIVED' || status === 'RECEIVED') return 'RECEIVED';
  if (rowStatus !== 'NA') return rowStatus;
  if (approval === 'PENDING MANAGER APPROVAL') return 'PENDING MANAGER APPROVAL';
  if (approval === 'PENDING APPROVAL') return 'PENDING APPROVAL';
  if (approval === 'APPROVED' && (status === 'NA' || status === 'PENDING APPROVAL')) return 'APPROVED';
  return status === 'NA' ? approval : status;
}
export function getOrderStatusLabel(items: LegacyLikeOrderItem[]) {
  if (!items.length) return 'NA';
  const statuses = items.map(getResolvedRowStatus).filter((status) => status !== 'NA');
  if (!statuses.length) return 'NA';
  const hasFulfillment = statuses.some((status) => ['PROCESSED','PARTIALLY DISPATCHED','DISPATCHED','ISSUED','PARTIALLY RECEIVED','RECEIVED'].includes(status));
  if (hasFulfillment) {
    if (statuses.every((status) => status === 'RECEIVED')) return 'RECEIVED';
    if (statuses.some((status) => status === 'RECEIVED' || status === 'PARTIALLY RECEIVED')) return 'PARTIALLY RECEIVED';
    if (statuses.every((status) => status === 'DISPATCHED')) return 'DISPATCHED';
    if (statuses.some((status) => status === 'DISPATCHED' || status === 'PARTIALLY DISPATCHED')) return 'PARTIALLY DISPATCHED';
    if (statuses.some((status) => status === 'ISSUED')) return 'ISSUED';
    return 'PROCESSED';
  }
  if (statuses.every((status) => status === 'REJECTED')) return 'REJECTED';
  if (statuses.some((status) => status === 'REJECTED')) return 'PARTIALLY REJECTED';
  if (statuses.some((status) => status === 'PENDING MANAGER APPROVAL')) return 'PENDING MANAGER APPROVAL';
  if (statuses.some((status) => status === 'PENDING APPROVAL')) return 'PENDING APPROVAL';
  if (statuses.some((status) => status === 'APPROVED')) return 'APPROVED';
  return statuses[0] || 'NA';
}
