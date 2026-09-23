import type { CreditDispatchRecord } from './creditDispatch.service';

export type CreditDispatchProgressStatus =
  | 'Pending Accounts Approval'
  | 'Pending Manager Approval'
  | 'Correction Requested by Accounts'
  | 'Correction Requested by Manager'
  | 'Rejected by Accounts'
  | 'Rejected by Manager'
  | 'Payment Pending'
  | 'Partial Payment'
  | 'Payment Overdue'
  | 'Partial Payment - Overdue'
  | 'Closed';

export const creditDispatchProgressStatuses: CreditDispatchProgressStatus[] = [
  'Pending Accounts Approval',
  'Pending Manager Approval',
  'Correction Requested by Accounts',
  'Correction Requested by Manager',
  'Rejected by Accounts',
  'Rejected by Manager',
  'Payment Pending',
  'Partial Payment',
  'Payment Overdue',
  'Partial Payment - Overdue',
  'Closed',
];

export function getCreditDispatchProgressStatus(
  row: Pick<CreditDispatchRecord, 'approval_status' | 'recovery_status' | 'credit_amount' | 'total_received_amount' | 'balance_amount' | 'due_date'>,
): CreditDispatchProgressStatus {
  if (row.approval_status === 'Pending Accounts Approval') return 'Pending Accounts Approval';
  if (row.approval_status === 'Pending Manager Approval') return 'Pending Manager Approval';
  if (row.approval_status === 'Correction Requested by Accounts') return 'Correction Requested by Accounts';
  if (row.approval_status === 'Correction Requested by Manager') return 'Correction Requested by Manager';
  if (row.approval_status === 'Rejected by Accounts') return 'Rejected by Accounts';
  if (row.approval_status === 'Rejected by Manager') return 'Rejected by Manager';

  const credit = Number(row.credit_amount ?? 0);
  const received = Number(row.total_received_amount ?? 0);
  const balance = Number(row.balance_amount ?? 0);
  if (balance <= 0 || (credit > 0 && received >= credit)) return 'Closed';

  const today = new Date().toISOString().slice(0, 10);
  const overdue = Boolean(row.due_date) && row.due_date < today;
  if (received > 0 && overdue) return 'Partial Payment - Overdue';
  if (received > 0) return 'Partial Payment';
  if (overdue) return 'Payment Overdue';
  return 'Payment Pending';
}

export function isCreditDispatchPaymentStage(status: CreditDispatchProgressStatus) {
  return ['Payment Pending', 'Partial Payment', 'Payment Overdue', 'Partial Payment - Overdue'].includes(status);
}

export function isCreditDispatchOverdue(status: CreditDispatchProgressStatus) {
  return status === 'Payment Overdue' || status === 'Partial Payment - Overdue';
}
