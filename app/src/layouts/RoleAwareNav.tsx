import { Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { canAccessRoute, type UserRole } from '../auth/roleGuards';

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  desktopLabel?: string;
  desktopIcon?: LucideIcon;
  desktopGroup?: string;
  desktopOrder?: number;
};

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
  const visibleItems = items
    .filter((item) => shouldShowNavItem(role, item))
    .sort((left, right) => (left.desktopOrder ?? 999) - (right.desktopOrder ?? 999));
  let previousGroup = '';

  return (
    <nav className="pc-nav mt-3 space-y-0.5">
      {visibleItems.map((item) => {
        const Icon = item.desktopIcon ?? item.icon;
        const label = item.desktopLabel ?? item.label;
        const group = item.desktopGroup ?? '';
        const showGroup = !collapsed && !!group && group !== previousGroup;
        if (group) previousGroup = group;

        return (
          <Fragment key={item.to}>
            {showGroup ? <p className="pc-nav-group">{group}</p> : null}
            <NavLink
              to={item.to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `pc-nav-link relative flex items-center rounded-md px-2.5 py-1.5 text-xs font-extrabold transition ${collapsed ? 'justify-center gap-0' : 'gap-2'} ${
                  isActive ? 'bg-[#82C8E5] text-[#000080]' : 'text-[#d8e3ee] hover:bg-[#263244] hover:text-white'
                }`
              }
            >
              <Icon className="pc-nav-icon h-3.5 w-3.5 shrink-0" />
              {!collapsed ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
              {typeof item.badge === 'number' && !collapsed ? <span className="pc-nav-badge rounded-full bg-[#dc2626] px-1.5 py-0.5 text-[10px] font-black leading-none text-[#ffffff] shadow-sm">{item.badge}</span> : null}
              {typeof item.badge === 'number' && collapsed ? <span className="pc-nav-badge absolute right-1 top-1 h-2 w-2 rounded-full bg-[#dc2626]" /> : null}
            </NavLink>
          </Fragment>
        );
      })}
    </nav>
  );
}
