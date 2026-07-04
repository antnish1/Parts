import { Outlet, useNavigate } from 'react-router-dom';
import { Boxes, ClipboardCheck, FilePlus2, Home, LayoutDashboard, LogOut, PackageSearch, ScanLine, Settings, Upload, Users } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/useAuth';
import { RoleAwareNav } from './RoleAwareNav';
import { MobileRoleNav } from './MobileRoleNav';

const companyName = 'Sankalp Insurance Brokers Private Limited';
const formerName = 'formerly known as insureit';

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/orders/new', label: 'New Order', icon: FilePlus2 },
  { to: '/orders/track', label: 'Track Orders', icon: PackageSearch },
  { to: '/approvals/pending', label: 'Approvals', icon: ClipboardCheck },
  { to: '/admin/approved', label: 'Admin', icon: Boxes },
  { to: '/manager/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/inventory/upload', label: 'Inventory', icon: Upload },
  { to: '/reports', label: 'Reports', icon: Users },
  { to: '/docket-scanner', label: 'Docket', icon: ScanLine },
  { to: '/developer/workspace', label: 'Developer', icon: Settings },
];

export function AppLayout() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div data-theme="light-pro" className="min-h-screen bg-[#111827] text-pc-text">
      <div className="flex min-h-screen">
        <aside className="hidden w-56 shrink-0 border-r border-[#263244] bg-[#0b1020] p-2 xl:block">
          <div className="rounded-lg border border-[#263244] bg-[#111827] p-2.5">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#82C8E5]">{companyName}</p>
            <h1 className="mt-1 text-sm font-black text-white">Parts Connect Portal</h1>
            <p className="mt-1 text-[10px] text-[#c7d2df]">{formerName}</p>
          </div>
          <RoleAwareNav items={navItems} role={profile?.role} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-[#263244] bg-[#111827]/95 px-3 py-2 backdrop-blur lg:px-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#82C8E5]">{companyName}</p>
                <h2 className="text-sm font-black text-white">Parts Connect Portal</h2>
                <p className="text-[10px] text-[#c7d2df]">{formerName}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-lg border border-[#263244] bg-[#0b1020] px-2.5 py-1 text-xs">
                  <p className="leading-4 font-black text-white">{profile?.fullName ?? 'User'}</p>
                  <p className="text-[10px] text-[#c7d2df]">{profile?.role ?? 'role'} • {profile?.branch ?? 'branch'}</p>
                </div>
                <Button variant="secondary" className="rounded-md px-2.5 py-1.5 text-xs" onClick={handleSignOut}>
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </Button>
              </div>
            </div>
          </header>
          <MobileRoleNav items={navItems} role={profile?.role} />
          <div className="p-2.5 lg:p-3"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
