import type { UserRole } from '@/types/auth';

const approvalEvents = [
  'ORDER_CREATED',
  'SUPER_APPROVED_PENDING_MANAGER',
  'SUPER_FORWARDED_MANAGER',
  'ORDER_REJECTED',
  'MANAGER_APPROVED',
  'MANAGER_DIRECT_APPROVED',
  'MANAGER_REJECTED',
  'REVIEW_QTY_ZEROED',
  'REVIEW_EDITS_MANAGER_APPROVED',
  'REVIEW_EDITS_PENDING_MANAGER',
  'REVIEW_ORIGINAL_MANAGER_APPROVED',
  'REVIEW_ORIGINAL_PENDING_MANAGER',
];

const adminEvents = [
  'MANAGER_APPROVED',
  'MANAGER_DIRECT_APPROVED',
  'REVIEW_EDITS_MANAGER_APPROVED',
  'REVIEW_ORIGINAL_MANAGER_APPROVED',
  'ADMIN_PROCESSED',
  'ADMIN_REJECTED',
  'ORDER_ISSUED',
  'STATUS_REPORT_UPDATED',
  'ORDER_STATUS_RECALCULATED',
  'STATUS_UPDATED',
];

export function isOrderActivityRelevant(role: UserRole | null | undefined, eventType: string) {
  const event = String(eventType || '').toUpperCase();
  if (!role) return false;
  if (role === 'developer') return true;
  if (role === 'branch') return true;
  if (role === 'super' || role === 'manager') return approvalEvents.includes(event);
  if (role === 'admin') return adminEvents.includes(event);
  if (role === 'viewer' || role === 'hq' || role === 'accounts') return false;
  return false;
}

const roleNotificationCategories: Record<UserRole, ReadonlySet<string>> = {
  branch: new Set(['approval', 'comment', 'dispatch', 'delayed_vor', 'credit_dispatch', 'tada', 'installation']),
  super: new Set(['order', 'approval', 'comment', 'installation']),
  manager: new Set(['order', 'approval', 'comment', 'tada', 'credit_dispatch', 'installation']),
  admin: new Set(['approval', 'comment', 'dispatch']),
  viewer: new Set(),
  developer: new Set(['order', 'approval', 'comment', 'dispatch', 'delayed_vor', 'tada', 'credit_dispatch', 'credit', 'installation', 'engine_breaker']),
  hq: new Set(['tada']),
  accounts: new Set(['tada', 'credit_dispatch', 'credit']),
};

export function isNotificationCategoryRelevant(role: UserRole | null | undefined, category: string) {
  if (!role) return false;
  if (role === 'developer') return true;
  return roleNotificationCategories[role].has(String(category || '').toLowerCase());
}
