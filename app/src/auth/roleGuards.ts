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

export function canAccessRoute(role: UserRole, path: string) {
  if (role === 'developer') return true;
  if (path.startsWith('/developer')) return false;
  if (role === 'viewer') return path.startsWith('/orders/track') || path.startsWith('/reports');
  if (role === 'branch') return path.startsWith('/orders');
  if (role === 'admin') return path.startsWith('/admin') || path.startsWith('/orders/track') || path.startsWith('/reports');
  if (role === 'super') return path.startsWith('/approvals') || path.startsWith('/orders/track') || path.startsWith('/reports');
  if (role === 'manager') return path.startsWith('/manager') || path.startsWith('/approvals') || path.startsWith('/orders/track') || path.startsWith('/reports');
  return false;
}
