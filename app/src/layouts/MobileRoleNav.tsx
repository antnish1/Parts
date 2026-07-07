import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Grid3X3, X } from 'lucide-react';
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

function primaryItems(items: NavItem[], role?: UserRole) {
  const visible = items.filter((item) => shouldShowNavItem(role, item));
  const preferred = role === 'branch'
    ? ['/orders/new', '/orders/track', '/docket-scanner']
    : role === 'admin'
      ? ['/', '/admin/approved', '/orders/track', '/docket-scanner']
      : role === 'manager'
        ? ['/', '/approvals/pending', '/manager/dashboard', '/reports']
        : role === 'developer'
          ? ['/', '/orders/track', '/developer/workspace', '/docket-scanner']
          : ['/', '/orders/track', '/docket-scanner'];
  const selected = preferred.map((to) => visible.find((item) => item.to === to)).filter(Boolean) as NavItem[];
  const unique = [...new Map(selected.map((item) => [item.to, item])).values()];
  return { primary: unique.slice(0, 4), all: visible };
}

export function MobileRoleNav({ items, role }: MobileRoleNavProps) {
  const [open, setOpen] = useState(false);
  const { primary, all } = primaryItems(items, role);
  const moreItems = all.filter((item) => !primary.some((primaryItem) => primaryItem.to === item.to));

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#d9dee7] bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.14)] backdrop-blur xl:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {primary.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-black transition ${
                    isActive ? 'bg-[#e6f4ff] text-[#0f4c81]' : 'text-[#64748b] hover:bg-[#f8fbff] hover:text-[#0f172a]'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span className="max-w-full truncate">{item.label.replace(' Orders', '').replace(' Scanner', '')}</span>
                {typeof item.badge === 'number' && item.badge > 0 ? <span className="absolute right-1.5 top-1.5 rounded-full bg-[#dc2626] px-1 text-[9px] leading-4 text-white">{item.badge}</span> : null}
              </NavLink>
            );
          })}
          <button type="button" className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-black text-[#64748b] hover:bg-[#f8fbff] hover:text-[#0f172a]" onClick={() => setOpen(true)}>
            <Grid3X3 className="h-4 w-4" />
            More
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[60] bg-[#020617]/50 px-3 pb-[calc(88px+env(safe-area-inset-bottom))] pt-16 backdrop-blur-sm xl:hidden" onClick={() => setOpen(false)}>
          <div className="mx-auto max-w-md rounded-3xl border border-[#d9dee7] bg-white p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-black text-[#0f172a]">More Options</p>
              <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d9dee7] text-[#64748b]" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)} className="rounded-2xl border border-[#d9dee7] bg-[#f8fbff] p-3 text-xs font-black text-[#0f172a]">
                    <Icon className="mb-2 h-5 w-5 text-[#0f4c81]" />
                    {item.label}
                  </NavLink>
                );
              })}
              {moreItems.length === 0 ? <p className="col-span-2 text-xs text-[#64748b]">No more options for this role.</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
