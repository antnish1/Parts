export type UserRole = 'branch' | 'admin' | 'super' | 'manager' | 'viewer' | 'developer';

export type UserProfile = {
  id: string;
  fullName: string;
  branch: string;
  role: UserRole;
  isActive: boolean;
};

export const roleHomePath: Record<UserRole, string> = {
  branch: '/orders/new',
  admin: '/admin/approved',
  super: '/approvals/pending',
  manager: '/manager/dashboard',
  viewer: '/orders/track',
  developer: '/developer/workspace',
};

function isOrderWorkspace(path: string) {
  return path.startsWith('/orders/track') || /^\/orders\/[^/]+$/.test(path);
}

export function canAccessRoute(role: UserRole, path: string) {
  if (role === 'developer') return true;
  if (path.startsWith('/developer')) return false;
  if (role === 'viewer') return isOrderWorkspace(path) || path.startsWith('/reports');
  if (role === 'branch') return path.startsWith('/orders');
  if (role === 'admin') return path.startsWith('/admin') || isOrderWorkspace(path) || path.startsWith('/reports');
  if (role === 'super') return path.startsWith('/approvals') || isOrderWorkspace(path) || path.startsWith('/reports');
  if (role === 'manager') return path.startsWith('/manager') || path.startsWith('/approvals') || isOrderWorkspace(path) || path.startsWith('/reports');
  return false;
}
