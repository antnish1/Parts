import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { canAccessRoute, roleHomePath } from './roleGuards';

export function RequireAuth() {
  const location = useLocation();
  const { isAuthenticated, isLoading, role, profile } = useAuth();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-pc-bg p-4 text-pc-text">
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-8 text-center shadow-panel">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-pc-gold">Sankalp Insurance Brokers Private Limited</p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-pc-muted">formerly known as insureit</p>
          <p className="mt-3 text-sm text-pc-muted">Checking secure Parts Connect Portal session...</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !role || !profile?.isActive) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canAccessRoute(role, location.pathname)) {
    return <Navigate to={roleHomePath[role]} replace />;
  }

  return <Outlet />;
}
