import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Boxes, ClipboardCheck, FilePlus2, LayoutDashboard, LogOut, PackageSearch, ScanLine, Settings, Upload, Users } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/useAuth';

const navItems = [
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
    <div className="min-h-screen bg-[#111827] text-pc-text">
      <div className="flex min-h-screen">
        <aside className="hidden w-56 shrink-0 border-r border-[#263244] bg-[#0b1020] p-3 xl:block">
          <div className="rounded-xl border border-[#263244] bg-[#111827] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#82C8E5]">Parts Connect</p>
            <h1 className="mt-1 text-base font-black text-white">Production Portal</h1>
          </div>

          <nav className="mt-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-extrabold transition ${
                      isActive ? 'bg-[#82C8E5] text-[#000080]' : 'text-[#d8e3ee] hover:bg-[#263244] hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-[#263244] bg-[#111827]/95 px-4 py-2.5 backdrop-blur lg:px-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#82C8E5]">Secure Workspace</p>
                <h2 className="text-base font-black text-white">Parts Connect Portal</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-xl border border-[#263244] bg-[#0b1020] px-3 py-1.5 text-sm">
                  <p className="leading-4 font-black text-white">{profile?.fullName ?? 'User'}</p>
                  <p className="text-[11px] text-[#c7d2df]">{profile?.role ?? 'role'} • {profile?.branch ?? 'branch'}</p>
                </div>
                <Button variant="secondary" className="rounded-lg px-3 py-2 text-xs" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </div>
          </header>

          <div className="p-3 lg:p-4 xl:p-5">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
