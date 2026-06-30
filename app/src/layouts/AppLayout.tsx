import { NavLink, Outlet } from 'react-router-dom';
import { Boxes, ClipboardCheck, FilePlus2, LayoutDashboard, PackageSearch, ScanLine, Settings, Upload, Users } from 'lucide-react';
import { Button } from '../components/ui/Button';

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
  return (
    <div className="min-h-screen bg-pc-bg text-pc-text">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-slate-800 bg-slate-950/70 p-4 lg:block">
          <div className="rounded-2xl border border-pc-gold/20 bg-slate-900/80 p-4 shadow-panel">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-pc-gold">Parts Connect</p>
            <h1 className="mt-2 text-xl font-black text-white">Production Rebuild</h1>
            <p className="mt-2 text-xs leading-relaxed text-pc-muted">New React foundation. Legacy index.html remains untouched during migration.</p>
          </div>

          <nav className="mt-5 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold transition ${
                      isActive ? 'bg-pc-gold text-slate-950' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
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
          <header className="sticky top-0 z-20 border-b border-slate-800 bg-pc-bg/90 px-4 py-3 backdrop-blur lg:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-pc-gold">Migration Workspace</p>
                <h2 className="text-lg font-black text-white">Parts Connect Portal</h2>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary">Legacy Reference Intact</Button>
                <Button>Next: Auth Foundation</Button>
              </div>
            </div>
          </header>

          <div className="p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
