import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { canAccessRoute, type UserRole } from '../auth/roleGuards';

type RoleAwareNavProps = {
  items: Array<{ to: string; label: string; icon: LucideIcon }>;
  role?: UserRole;
};

function shouldShowNavItem(role: UserRole | undefined, item: { to: string; label: string }) {
  if (role === 'admin' && item.to.startsWith('/admin')) return false;
  return role ? canAccessRoute(role, item.to) : true;
}

export function RoleAwareNav({ items, role }: RoleAwareNavProps) {
  const visibleItems = items.filter((item) => shouldShowNavItem(role, item));

  return (
    <nav className="mt-3 space-y-0.5">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-extrabold transition ${
                isActive ? 'bg-[#82C8E5] text-[#000080]' : 'text-[#d8e3ee] hover:bg-[#263244] hover:text-white'
              }`
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
