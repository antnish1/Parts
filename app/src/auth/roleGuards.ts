export type UserRole = 'branch' | 'admin' | 'super' | 'manager' | 'viewer' | 'developer' | 'hq';

export type UserProfile = { id: string; fullName: string; branch: string; role: UserRole; isActive: boolean; };

export const roleHomePath: Record<UserRole, string> = {
  branch: '/orders/new', admin: '/admin/approved', super: '/approvals/pending', manager: '/approvals/pending',
  viewer: '/orders/track', developer: '/developer/workspace', hq: '/',
};

function isOrderWorkspace(path: string) {
  if (path === '/orders/new') return false;
  return path.startsWith('/orders/track') || path.startsWith('/orders/pending-issue') || /^\/orders\/[^/]+$/.test(path);
}
function isInventoryWorkspace(path: string) { return path.startsWith('/inventory'); }
function isDocketWorkspace(path: string) { return path.startsWith('/docket-scanner'); }
function isUploadsWorkspace(path: string) { return path.startsWith('/uploads'); }
function isCreditDispatchWorkspace(path: string) { return path.startsWith('/credit-dispatch'); }
function isInstallationWorkspace(path: string) { return path.startsWith('/installations'); }

export function canAccessRoute(role: UserRole, path: string) {
  if (path === '/') return true;
  if (isInstallationWorkspace(path)) return true;
  if (path === '/orders/delayed-vor') return true;
  if (path === '/orders/pending-issue') return ['branch', 'admin', 'manager', 'developer', 'hq'].includes(role);
  if (role === 'hq') return false;
  if (/^\/orders\/[^/]+\/correct$/.test(path)) return ['manager', 'developer'].includes(role);
  if (path === '/orders/new') return role === 'branch';
  if (isUploadsWorkspace(path)) return ['admin', 'manager', 'developer'].includes(role);
  if (isInventoryWorkspace(path)) return role === 'developer';
  if (isCreditDispatchWorkspace(path)) return ['branch', 'manager', 'admin', 'developer', 'super'].includes(role);
  if (role === 'developer') return true;
  if (path.startsWith('/developer')) return false;
  if (role === 'viewer') return isOrderWorkspace(path) || path.startsWith('/reports');
  if (role === 'branch') return path.startsWith('/orders') || isDocketWorkspace(path);
  if (role === 'admin') return path.startsWith('/admin') || isOrderWorkspace(path) || isDocketWorkspace(path) || path.startsWith('/reports');
  if (role === 'super') return path.startsWith('/approvals') || isOrderWorkspace(path) || isDocketWorkspace(path) || path.startsWith('/reports');
  if (role === 'manager') return path.startsWith('/manager') || path.startsWith('/approvals') || isOrderWorkspace(path) || isDocketWorkspace(path) || path.startsWith('/reports');
  return false;
}
