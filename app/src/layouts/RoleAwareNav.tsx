import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { canAccessRoute, type UserRole } from '../auth/roleGuards';

export type NavItem = { to: string; label: string; icon: LucideIcon; badge?: number };

type RoleAwareNavProps = {
  items: NavItem[];
  role?: UserRole;
  collapsed?: boolean;
};

function shouldShowNavItem(role: UserRole | undefined, item: { to: string; label: string }) {
  if (role === 'admin' && item.to.startsWith('/admin')) return false;
  if (role === 'super' && item.to.startsWith('/approvals')) return false;
  return role ? canAccessRoute(role, item.to) : true;
}

export function RoleAwareNav({ items, role, collapsed = false }: RoleAwareNavProps) {
  const visibleItems = items.filter((item) => shouldShowNavItem(role, item));

  return (
    <nav className="mt-4 space-y-1.5">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `portal-nav-link relative flex items-center rounded-2xl px-3 py-2.5 text-[12px] font-extrabold tracking-[-0.01em] ${collapsed ? 'justify-center gap-0' : 'gap-3'} ${
                isActive ? 'portal-nav-active text-[#0f172a]' : 'text-[#475569] hover:text-[#0f172a]'
              }`
            }
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/70 text-[#1677ff] shadow-sm ring-1 ring-slate-200/70">
              <Icon className="h-4 w-4 shrink-0" />
            </span>
            {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
            {typeof item.badge === 'number' && item.badge > 0 && !collapsed ? <span className="rounded-full bg-[#e11d48] px-2 py-1 text-[10px] font-black leading-none text-white shadow-sm">{item.badge}</span> : null}
            {typeof item.badge === 'number' && item.badge > 0 && collapsed ? <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#e11d48] ring-2 ring-white" /> : null}
          </NavLink>
        );
      })}
    </nav>
  );
}
