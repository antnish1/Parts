import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { canAccessRoute, type UserRole } from '../auth/roleGuards';

type MobileRoleNavProps = {
  items: Array<{ to: string; label: string; icon: LucideIcon }>;
  role?: UserRole;
};

export function MobileRoleNav({ items, role }: MobileRoleNavProps) {
  const visibleItems = role ? items.filter((item) => canAccessRoute(role, item.to)) : items;

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
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
