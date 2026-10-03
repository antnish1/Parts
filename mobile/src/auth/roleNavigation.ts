import type { UserRole } from '@/types/auth';

export type WorkAction = {
  key: string;
  label: string;
  description: string;
  href?: string;
  badgeKey?: 'orders' | 'pendingApproval';
};

const trackOrders: WorkAction = { key: 'track-orders', label: 'Track Orders', description: 'Search and follow order status, parts and activity.', href: '/orders', badgeKey: 'orders' };
const docket: WorkAction = { key: 'docket', label: 'Docket Scanner', description: 'Scan/search a docket and receive billed rows.', href: '/docket' };
const credit: WorkAction = { key: 'credit', label: 'Credit Dispatch', description: 'Credit approvals, recovery status and customer requests.', href: '/credit-dispatch' };
const tada: WorkAction = { key: 'tada', label: 'TA/DA Tracking', description: 'Track physical SVR custody through HQ and Accounts.', href: '/ta-da' };

export const roleWorkActions: Record<UserRole, WorkAction[]> = {
  branch: [
    { key: 'new-order', label: 'New Order', description: 'Create a parts order with machine and part master lookup.', href: '/orders/new' },
    trackOrders,
    { key: 'pending-issue', label: 'Pending Issue', description: 'Review remaining issue quantities and inventory.' },
    docket,
    credit,
    tada,
  ],
  admin: [trackOrders, { key: 'admin-queue', label: 'Approved Orders', description: 'Process approved orders and dispatch work.' }, docket, credit],
  super: [
    { key: 'approval-queue', label: 'Approval Queue', description: 'Review orders assigned for approval.', href: '/approvals', badgeKey: 'pendingApproval' },
    trackOrders,
    docket,
    credit,
  ],
  manager: [
    { key: 'approval-queue', label: 'Manager Approvals', description: 'Review escalated approvals.', href: '/approvals', badgeKey: 'pendingApproval' },
    trackOrders,
    { key: 'manager-dashboard', label: 'Manager Dashboard', description: 'Branch and operational performance.' },
    docket,
    credit,
    tada,
  ],
  viewer: [trackOrders, { key: 'reports', label: 'Reports', description: 'Read-only operational reporting.' }],
  developer: [
    { key: 'approval-queue', label: 'Approval Queue', description: 'Privileged review access using audited backend functions.', href: '/approvals', badgeKey: 'pendingApproval' },
    trackOrders,
    docket,
    credit,
    tada,
    { key: 'developer', label: 'Developer Workspace', description: 'Privileged tools and audited overrides.' },
  ],
  hq: [trackOrders, tada],
  accounts: [
    { ...tada, label: 'TA/DA Receipts', description: 'Receive eligible SVRs at Accounts.' },
    { ...credit, description: 'Review Accounts-stage credit requests and recovery status.' },
  ],
};
