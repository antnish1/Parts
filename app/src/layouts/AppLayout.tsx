import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, Boxes, ChevronLeft, ChevronRight, ClipboardCheck, FilePlus2, Home, LogOut, Menu, PackageSearch, ScanLine, Search, Settings, ShieldCheck, Upload, Users, Zap } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/useAuth';
import { getOrderList } from '../services/orderList.service';
import { brandLogoSrc } from '../assets/brandLogo';
import { RoleAwareNav, type NavItem } from './RoleAwareNav';
import { MobileRoleNav } from './MobileRoleNav';

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/orders/new', label: 'New Order', icon: FilePlus2 },
  { to: '/orders/track', label: 'Track Orders', icon: PackageSearch },
  { to: '/approvals/pending', label: 'Approvals', icon: ClipboardCheck },
  { to: '/admin/approved', label: 'Admin Processing', icon: Boxes },
  { to: '/manager/dashboard', label: 'Inventory', icon: PackageSearch },
  { to: '/uploads', label: 'Uploads', icon: Upload },
  { to: '/inventory/upload', label: 'Inventory Upload', icon: Boxes },
  { to: '/reports', label: 'Reports', icon: Users },
  { to: '/docket-scanner', label: 'Docket Scanner', icon: ScanLine },
  { to: '/developer/workspace', label: 'Developer', icon: Settings },
];

function pageName(pathname: string) {
  const match = navItems
    .filter((item) => item.to !== '/')
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => pathname.startsWith(item.to));
  if (match) return match.label;
  return 'Dashboard';
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const adminCounterQuery = useQuery({
    queryKey: ['admin-approved-orders-nav-counter'],
    queryFn: getOrderList,
    enabled: isAdmin,
    refetchInterval: 15000,
  });

  const approvedOrdersCount = (adminCounterQuery.data ?? []).filter((order) => order.status === 'approved').length;

  const roleNavItems = useMemo(
    () => navItems.map((item) => (isAdmin && item.to === '/' ? { ...item, label: 'Approved Orders', badge: approvedOrdersCount } : item)),
    [approvedOrdersCount, isAdmin],
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div data-theme="premium-ops" className="portal-shell min-h-screen text-[#111827]">
      <div className="flex min-h-screen">
        <aside className={`portal-sidebar ${isSidebarCollapsed ? 'w-20' : 'w-[272px]'} hidden shrink-0 p-4 transition-all duration-300 xl:block`}>
          <div className="flex h-full flex-col">
            <div className={`portal-brand-card rounded-[22px] p-4 text-white ${isSidebarCollapsed ? 'px-2' : ''}`}>
              <div className={`relative z-10 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                <img src={brandLogoSrc} alt="Parts Connect Portal logo" className="h-10 w-10 rounded-2xl bg-white object-contain p-1 shadow-lg" />
                {!isSidebarCollapsed ? (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black tracking-[-0.02em]">Parts Connect</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200">Operations Portal</p>
                  </div>
                ) : null}
              </div>
              {!isSidebarCollapsed ? (
                <div className="relative z-10 mt-4 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
                  <p className="truncate text-xs font-black">{profile?.fullName ?? 'Portal User'}</p>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-300">{profile?.role ?? 'role'} • {profile?.branch ?? 'branch'}</p>
                </div>
              ) : null}
            </div>

            <button type="button" className="portal-glow-button mt-3 flex h-10 w-full items-center justify-center rounded-2xl text-[#334155]" onClick={() => setIsSidebarCollapsed((current) => !current)} title={isSidebarCollapsed ? 'Expand menu' : 'Collapse menu'}>
              {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span className="ml-2 text-xs font-black">Collapse</span></>}
            </button>

            <RoleAwareNav items={roleNavItems} role={profile?.role} collapsed={isSidebarCollapsed} />

            <div className="mt-auto space-y-3 pt-4">
              {!isSidebarCollapsed ? (
                <div className="rounded-2xl border border-blue-200/70 bg-blue-50/80 p-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="portal-pulse inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 text-emerald-500" />
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">Live Portal</p>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-slate-600">Branch operations synced with Supabase.</p>
                </div>
              ) : null}
              <Button variant="ghost" className="w-full rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-black !text-slate-700 hover:bg-white" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                {!isSidebarCollapsed ? 'Sign Out' : null}
              </Button>
            </div>
          </div>
        </aside>

        <main className="portal-main-surface flex min-w-0 flex-1 flex-col">
          <header className="portal-topbar sticky top-0 z-20 px-4 py-3 lg:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <button className="portal-glow-button inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-700 xl:hidden" type="button">
                  <Menu className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#1677ff]" />
                    <p className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-[#1677ff]">Frontier Commercial Vehicle</p>
                  </div>
                  <h1 className="truncate text-xl font-black tracking-[-0.035em] text-slate-950">{pageName(location.pathname)}</h1>
                </div>
              </div>

              <div className="hidden min-w-[320px] max-w-xl flex-1 items-center gap-2 rounded-2xl px-3 py-2 lg:flex portal-search">
                <Search className="h-4 w-4 text-slate-400" />
                <input className="h-7 flex-1 text-sm font-semibold text-slate-700 placeholder:text-slate-400" placeholder="Search orders, parts, machines, dockets..." />
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black text-slate-400">Ctrl K</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 shadow-sm md:flex">
                  <Zap className="h-4 w-4" />
                  <span className="text-xs font-black">Live</span>
                </div>
                <button className="portal-glow-button relative inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-700" type="button">
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                </button>
                <button className="portal-glow-button hidden h-10 items-center gap-2 rounded-2xl px-3 text-left md:flex" type="button">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-xs font-black text-white">{(profile?.fullName ?? 'U').slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0">
                    <span className="block max-w-[130px] truncate text-xs font-black text-slate-800">{profile?.fullName ?? 'User'}</span>
                    <span className="block max-w-[130px] truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{profile?.role ?? 'role'}</span>
                  </span>
                </button>
              </div>
            </div>
          </header>
          <MobileRoleNav items={roleNavItems} role={profile?.role} />
          <div className="mx-auto w-full max-w-[1680px] flex-1 p-3 lg:p-5"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
