import { useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Boxes, ClipboardCheck, FilePlus2, Home, LogOut, PackageSearch, ScanLine, Settings, Upload, Users } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/useAuth';
import { getOrderList } from '../services/orderList.service';
import { brandLogoSrc } from '../assets/brandLogo';
import { RoleAwareNav, type NavItem } from './RoleAwareNav';
import { MobileRoleNav } from './MobileRoleNav';

const navItems: NavItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/orders/new', label: 'New Order', icon: FilePlus2 },
  { to: '/orders/track', label: 'Track Orders', icon: PackageSearch },
  { to: '/approvals/pending', label: 'Approvals', icon: ClipboardCheck },
  { to: '/admin/approved', label: 'Admin', icon: Boxes },
  { to: '/manager/dashboard', label: 'Inventory', icon: PackageSearch },
  { to: '/uploads', label: 'Uploads', icon: Upload },
  { to: '/inventory/upload', label: 'Inventory Upload', icon: Boxes },
  { to: '/reports', label: 'Reports', icon: Users },
  { to: '/docket-scanner', label: 'Docket', icon: ScanLine },
  { to: '/developer/workspace', label: 'Developer', icon: Settings },
];

export function AppLayout() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

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
    <div data-theme="light-pro" className="min-h-screen bg-[#111827] text-pc-text">
      <div className="flex min-h-screen">
        <aside className="hidden w-48 shrink-0 border-r border-[#263244] bg-[#0b1020] p-2 xl:block">
          <div className="rounded-lg border border-[#263244] bg-[#f8fafc] px-2.5 py-2 text-xs shadow-sm">
            <p className="leading-4 font-black text-[#020617]">{profile?.fullName ?? 'User'}</p>
            <p className="text-[11px] leading-4 text-[#475569]">{profile?.role ?? 'role'} • {profile?.branch ?? 'branch'}</p>
          </div>
          <RoleAwareNav items={roleNavItems} role={profile?.role} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-[#263244] bg-[#111827]/95 px-3 py-2 backdrop-blur lg:px-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-fit items-center gap-2">
                <img src={brandLogoSrc} alt="Parts Connect Portal logo" className="h-8 w-8 rounded-md bg-white object-contain p-0.5" />
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#82C8E5]">Parts Connect Portal</p>
              </div>
              <Button variant="secondary" className="rounded-md border-[#b42318] bg-[#d92d20] px-3 py-1.5 text-xs font-black text-white shadow-sm hover:border-[#912018] hover:bg-[#b42318]" onClick={handleSignOut}>
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </Button>
            </div>
          </header>
          <MobileRoleNav items={roleNavItems} role={profile?.role} />
          <div className="p-2.5 lg:p-3"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
