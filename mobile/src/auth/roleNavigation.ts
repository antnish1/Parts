import type { UserRole } from '@/types/auth';

export type WorkAction = {
  key: string;
  label: string;
  description: string;
  href?: string;
  badgeKey?: 'orders' | 'pendingApproval';
};

const trackOrders: WorkAction = {
  key: 'track-orders',
  label: 'Track Orders',
  description: 'Search and follow order status, parts and activity.',
  href: '/orders',
  badgeKey: 'orders',
};

export const roleWorkActions: Record<UserRole, WorkAction[]> = {
  branch: [
    { key: 'new-order', label: 'New Order', description: 'Create a parts order. Native form is next in this migration.' },
    trackOrders,
    { key: 'pending-issue', label: 'Pending Issue', description: 'Review remaining issue quantities and inventory.' },
    { key: 'docket', label: 'Docket Scanner', description: 'Native camera scanning will be added in the next milestone.' },
  ],
  admin: [trackOrders, { key: 'admin-queue', label: 'Approved Orders', description: 'Process approved orders and dispatch work.' }],
  super: [
    { key: 'approval-queue', label: 'Approval Queue', description: 'Review orders assigned for approval.', badgeKey: 'pendingApproval' },
    trackOrders,
  ],
  manager: [
    { key: 'approval-queue', label: 'Manager Approvals', description: 'Review escalated approvals.', badgeKey: 'pendingApproval' },
    trackOrders,
    { key: 'manager-dashboard', label: 'Manager Dashboard', description: 'Branch and operational performance.' },
  ],
  viewer: [trackOrders, { key: 'reports', label: 'Reports', description: 'Read-only operational reporting.' }],
  developer: [trackOrders, { key: 'developer', label: 'Developer Workspace', description: 'Privileged tools and audited overrides.' }],
  hq: [trackOrders, { key: 'tada', label: 'TA/DA Tracking', description: 'Track bill and SVR movement.' }],
  accounts: [
    { key: 'tada', label: 'TA/DA Receipts', description: 'Receive eligible SVRs at Accounts.' },
    { key: 'credit', label: 'Credit Dispatch', description: 'Review Accounts-stage credit requests.' },
  ],
};
