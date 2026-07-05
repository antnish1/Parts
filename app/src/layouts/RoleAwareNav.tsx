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
    <nav className="mt-3 space-y-0.5">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `relative flex items-center rounded-md px-2.5 py-1.5 text-xs font-extrabold transition ${collapsed ? 'justify-center gap-0' : 'gap-2'} ${
                isActive ? 'bg-[#82C8E5] text-[#000080]' : 'text-[#d8e3ee] hover:bg-[#263244] hover:text-white'
              }`
            }
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {!collapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
            {typeof item.badge === 'number' && !collapsed ? <span className="rounded-full bg-[#dc2626] px-1.5 py-0.5 text-[10px] font-black leading-none text-[#ffffff] shadow-sm">{item.badge}</span> : null}
            {typeof item.badge === 'number' && collapsed ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#dc2626]" /> : null}
          </NavLink>
        );
      })}
    </nav>
  );
}
