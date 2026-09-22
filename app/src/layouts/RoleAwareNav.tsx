import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { canAccessRoute, type UserRole } from '../auth/roleGuards';

export type NavChild = {
  to: string;
  label: string;
};

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  desktopLabel?: string;
  desktopIcon?: LucideIcon;
  desktopGroup?: string;
  desktopOrder?: number;
  children?: NavChild[];
};

type RoleAwareNavProps = {
  items: NavItem[];
  role?: UserRole;
  collapsed?: boolean;
};

function shouldShowRoute(role: UserRole | undefined, to: string) {
  if (role === 'admin' && to.startsWith('/admin')) return false;
  if (role === 'super' && to.startsWith('/approvals')) return false;
  return role ? canAccessRoute(role, to) : true;
}

function shouldShowNavItem(role: UserRole | undefined, item: NavItem) {
  if (item.children?.length) return item.children.some((child) => shouldShowRoute(role, child.to));
  return shouldShowRoute(role, item.to);
}

function isChildRouteActive(to: string, pathname: string) {
  if (to === '/installations') {
    return pathname === '/installations' || (pathname.startsWith('/installations/') && !pathname.startsWith('/installations/invoices'));
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

function SubmenuItem({ item, role, collapsed }: { item: NavItem; role?: UserRole; collapsed: boolean }) {
  const location = useLocation();
  const Icon = item.desktopIcon ?? item.icon;
  const label = item.desktopLabel ?? item.label;
  const children = (item.children ?? []).filter((child) => shouldShowRoute(role, child.to));
  const childActive = children.some((child) => isChildRouteActive(child.to, location.pathname));
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  if (collapsed) {
    const destination = children[0]?.to ?? item.to;
    return <NavLink
      to={destination}
      title={label}
      className={`pc-nav-link relative flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-extrabold transition ${childActive ? 'bg-[#82C8E5] text-[#000080]' : 'text-[#d8e3ee] hover:bg-[#263244] hover:text-white'}`}
    >
      <Icon className="pc-nav-icon h-3.5 w-3.5 shrink-0" />
      {typeof item.badge === 'number' ? <span className="pc-nav-badge absolute right-1 top-1 h-2 w-2 rounded-full bg-[#dc2626]" /> : null}
    </NavLink>;
  }

  return <div className="space-y-0.5">
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      className={`pc-nav-link relative flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-extrabold transition ${childActive ? 'bg-[#82C8E5] text-[#000080]' : 'text-[#d8e3ee] hover:bg-[#263244] hover:text-white'}`}
      aria-expanded={open}
    >
      <Icon className="pc-nav-icon h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof item.badge === 'number' ? <span className="pc-nav-badge rounded-full bg-[#dc2626] px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow-sm">{item.badge}</span> : null}
      {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
    </button>
    {open ? <div className="ml-5 space-y-0.5 border-l border-[#314158] pl-2">
      {children.map((child) => {
        const active = isChildRouteActive(child.to, location.pathname);
        return <NavLink
          key={child.to}
          to={child.to}
          style={{ color: active ? '#0b4d8a' : '#ffffff' }}
          className={`block rounded-md px-2 py-1.5 text-[11px] font-bold transition ${active ? 'bg-white' : 'hover:bg-[#263244]'}`}
        >{child.label}</NavLink>;
      })}
    </div> : null}
  </div>;
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
            {item.children?.length ? <SubmenuItem item={item} role={role} collapsed={collapsed} /> : <NavLink
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
            </NavLink>}
          </Fragment>
        );
      })}
    </nav>
  );
}
