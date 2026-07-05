import { NavLink } from 'react-router-dom';
import { canAccessRoute, type UserRole } from '../auth/roleGuards';
import type { NavItem } from './RoleAwareNav';

type MobileRoleNavProps = {
  items: NavItem[];
  role?: UserRole;
};

function shouldShowNavItem(role: UserRole | undefined, item: { to: string; label: string }) {
  if (role === 'admin' && item.to.startsWith('/admin')) return false;
  if (role === 'super' && item.to.startsWith('/approvals')) return false;
  return role ? canAccessRoute(role, item.to) : true;
}

export function MobileRoleNav({ items, role }: MobileRoleNavProps) {
  const visibleItems = items.filter((item) => shouldShowNavItem(role, item));

  return (
    <div className="border-b border-[#263244] bg-[#0b1020] px-2 py-2 xl:hidden">
      <div className="flex gap-2 overflow-x-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-black ${
                  isActive ? 'bg-[#82C8E5] text-[#000080]' : 'bg-[#111827] text-[#d8e3ee]'
                }`
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
              {typeof item.badge === 'number' ? <span className="rounded-full bg-[#ef4444] px-1.5 py-0.5 text-[10px] font-black leading-none text-white">{item.badge}</span> : null}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
