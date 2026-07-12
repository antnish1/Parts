import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  ClockAlert,
  Database,
  FilePlus2,
  FileSignature,
  Home,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Menu,
  PackageSearch,
  ScanLine,
  Settings,
  ShieldCheck,
  Truck,
  Upload,
  Users,
  Warehouse,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/useAuth';
import { getOrderList } from '../services/orderList.service';
import { brandLogoSrc } from '../assets/brandLogo';
import { RoleAwareNav, type NavItem } from './RoleAwareNav';
import { MobileRoleNav } from './MobileRoleNav';

const navItems: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, desktopIcon: LayoutDashboard, desktopGroup: 'Overview', desktopOrder: 0 },
  { to: '/orders/new', label: 'New Order', icon: FilePlus2, desktopGroup: 'Orders', desktopOrder: 10 },
  { to: '/orders/track', label: 'Track Orders', icon: PackageSearch, desktopIcon: ListOrdered, desktopGroup: 'Orders', desktopOrder: 11 },
  { to: '/credit-dispatch', label: 'Credit Dispatch', icon: FileSignature, desktopIcon: Truck, desktopGroup: 'Operations', desktopOrder: 30 },
  { to: '/orders/delayed-vor', label: 'Delayed VOR', icon: ClockAlert, desktopGroup: 'Orders', desktopOrder: 12 },
  { to: '/approvals/pending', label: 'Approvals', icon: ClipboardCheck, desktopGroup: 'Approvals', desktopOrder: 20 },
  { to: '/admin/approved', label: 'Admin', icon: Boxes, desktopLabel: 'Approved Orders', desktopIcon: ShieldCheck, desktopGroup: 'Approvals', desktopOrder: 21 },
  { to: '/manager/dashboard', label: 'Inventory', icon: PackageSearch, desktopIcon: Warehouse, desktopGroup: 'Inventory', desktopOrder: 40 },
  { to: '/uploads', label: 'Uploads', icon: Upload, desktopGroup: 'Inventory', desktopOrder: 41 },
  { to: '/inventory/upload', label: 'Inventory Upload', icon: Boxes, desktopIcon: Database, desktopGroup: 'Inventory', desktopOrder: 42 },
  { to: '/reports', label: 'Reports', icon: Users, desktopIcon: BarChart3, desktopGroup: 'Insights', desktopOrder: 50 },
  { to: '/docket-scanner', label: 'Docket', icon: ScanLine, desktopLabel: 'Docket Scanner', desktopGroup: 'Operations', desktopOrder: 31 },
  { to: '/developer/workspace', label: 'Developer', icon: Settings, desktopGroup: 'Administration', desktopOrder: 60 },
];

function getDesktopPageTitle(pathname: string, items: NavItem[]) {
  if (pathname.startsWith('/approvals/review/')) return 'Approval Review';
  if (/^\/orders\/[^/]+$/.test(pathname)) return 'Order Details';
  if (pathname.startsWith('/credit-dispatch/reports')) return 'Credit Dispatch Reports';
  if (pathname.startsWith('/credit-dispatch/aging')) return 'Credit Aging';
  if (pathname.startsWith('/credit-dispatch/customers')) return 'Credit Customers';

  const match = [...items]
    .filter((item) => item.to === pathname || (item.to !== '/' && pathname.startsWith(`${item.to}/`)))
    .sort((left, right) => right.to.length - left.to.length)[0];

  return match?.desktopLabel ?? match?.label ?? 'Parts Connect Portal';
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isManager = profile?.role === 'manager';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const adminCounterQuery = useQuery({
    queryKey: ['admin-approved-orders-nav-counter'],
    queryFn: getOrderList,
    enabled: isAdmin || isManager,
    refetchInterval: 15000,
  });

  const approvedOrdersCount = (adminCounterQuery.data ?? []).filter((order) => order.status === 'approved').length;
  const managerApprovalCount = (adminCounterQuery.data ?? []).filter((order) => `${order.status} ${order.approval_status}`.toLowerCase().replace(/[^a-z]/g, '').includes('pendingmanagerapproval')).length;

  const roleNavItems = useMemo(
    () => navItems.map((item) => {
      if (isAdmin && item.to === '/') return { ...item, label: 'Approved Orders', desktopLabel: 'Approved Orders', badge: approvedOrdersCount };
      if (isManager && item.to === '/approvals/pending') return { ...item, badge: managerApprovalCount };
      return item;
    }),
    [approvedOrdersCount, isAdmin, isManager, managerApprovalCount],
  );

  const desktopPageTitle = useMemo(
    () => getDesktopPageTitle(location.pathname, roleNavItems),
    [location.pathname, roleNavItems],
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div data-theme="light-pro" className="pc-app min-h-screen bg-[#111827] text-pc-text">
      <div className="flex min-h-screen items-start">
        <aside
          data-collapsed={isSidebarCollapsed ? 'true' : 'false'}
          className={`${isSidebarCollapsed ? 'w-16' : 'w-56'} pc-sidebar hidden shrink-0 border-r border-[#263244] bg-[#0b1020] p-2 transition-all duration-200 lg:flex lg:flex-col`}
        >
          <div className="pc-sidebar-brand flex items-center gap-2">
            <img src={brandLogoSrc} alt="Parts Connect Portal logo" className="h-7 w-7 shrink-0 object-contain p-0.5" />
            {!isSidebarCollapsed ? (
              <div className="min-w-0">
                <p className="pc-sidebar-brand-title truncate">Parts Connect</p>
                <p className="pc-sidebar-brand-subtitle truncate">Operations Portal</p>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="pc-sidebar-toggle mt-2 flex h-7 w-full items-center justify-center rounded-md border border-[#263244] text-[#d8e3ee] hover:bg-[#263244] hover:text-white"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            title={isSidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
            aria-label={isSidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="pc-sidebar-nav-scroll min-h-0 flex-1 overflow-y-auto">
            <RoleAwareNav items={roleNavItems} role={profile?.role} collapsed={isSidebarCollapsed} />
          </div>

          <div className="pc-sidebar-footer mt-2 space-y-1.5">
            {!isSidebarCollapsed ? (
              <div className="pc-sidebar-profile rounded-lg border border-[#263244] px-2.5 py-2 text-xs">
                <p className="pc-sidebar-profile-name truncate font-black">{profile?.fullName ?? 'User'}</p>
                <p className="pc-sidebar-profile-meta truncate text-[10px] font-semibold">{profile?.role ?? 'role'} • {profile?.branch ?? 'branch'}</p>
              </div>
            ) : null}
            <button
              type="button"
              className={`pc-sidebar-signout flex h-8 w-full items-center rounded-md border border-[#263244] px-2 text-xs font-bold ${isSidebarCollapsed ? 'justify-center' : 'gap-2'}`}
              onClick={handleSignOut}
              title={isSidebarCollapsed ? 'Sign Out' : undefined}
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              {!isSidebarCollapsed ? <span>Sign Out</span> : null}
            </button>
          </div>
        </aside>

        <main className="pc-main flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="pc-mobile-header sticky top-0 z-20 border-b border-[#263244] bg-[#111827]/95 px-3 py-2 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <img src={brandLogoSrc} alt="Parts Connect Portal logo" className="h-8 w-8 shrink-0 rounded-md bg-white object-contain p-0.5" />
                <div className="min-w-0">
                  <p className="truncate text-[9px] font-black uppercase tracking-[0.18em] text-[#82C8E5]">Parts Connect Portal</p>
                  <p className="truncate text-[10px] font-bold text-[#667085]">{profile?.fullName ?? 'User'} • {profile?.role ?? 'role'} • {profile?.branch ?? 'branch'}</p>
                </div>
              </div>
              <Button variant="secondary" className="rounded-md border-[#314158] bg-[#1e293b] px-3 py-1.5 text-xs font-black !text-[#f8fafc] shadow-sm hover:border-[#64748b] hover:bg-[#0f172a] [&_svg]:!text-[#f8fafc]" onClick={handleSignOut}>
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </Button>
            </div>
          </header>

          <header className="pc-desktop-header sticky top-0 z-20 hidden items-center justify-between border-b lg:flex">
            <div className="min-w-0">
              <p className="pc-desktop-kicker">Parts Connect Portal</p>
              <p className="pc-desktop-title truncate">{desktopPageTitle}</p>
            </div>
            <div className="pc-desktop-user flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-1">
              <span className="truncate text-[11px] font-bold">{profile?.fullName ?? 'User'}</span>
              <span className="text-[10px] text-[#64748b]">{profile?.role ?? 'role'} • {profile?.branch ?? 'branch'}</span>
            </div>
          </header>

          <MobileRoleNav items={roleNavItems} role={profile?.role} />
          <div className="pc-content p-2.5 pb-24 lg:p-3 lg:pb-3"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
