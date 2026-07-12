import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { LoginPage } from '../auth/LoginPage';
import { RequireAuth } from '../auth/RequireAuth';
import { useAuth } from '../auth/useAuth';
import { roleHomePath } from '../auth/roleGuards';
import { GlobalStatusEffects } from '../components/ui/GlobalStatusEffects';
import { ResponsiveTableEffects } from '../components/tables/ResponsiveTableEffects';

function lazyNamed<T extends ComponentType<object>>(
  loader: () => Promise<Record<string, T>>,
  exportName: string,
): LazyExoticComponent<T> {
  return lazy(async () => {
    const module = await loader();
    return { default: module[exportName] };
  });
}

const NewOrderPage = lazyNamed(() => import('../features/orders/NewOrderPage'), 'NewOrderPage');
const OrderDetailPage = lazyNamed(() => import('../features/orders/OrderDetailPage'), 'OrderDetailPage');
const TrackOrdersPage = lazyNamed(() => import('../features/tracking/TrackOrdersPage'), 'TrackOrdersPage');
const DelayedVorPage = lazyNamed(() => import('../features/tracking/DelayedVorPage'), 'DelayedVorPage');
const ApprovalsPage = lazyNamed(() => import('../features/approvals/ApprovalsPage'), 'ApprovalsPage');
const AdminPage = lazyNamed(() => import('../features/admin/AdminPage'), 'AdminPage');
const ManagerDashboardPage = lazyNamed(() => import('../features/manager/ManagerDashboardPage'), 'ManagerDashboardPage');
const DeveloperWorkspacePage = lazyNamed(() => import('../features/developer/DeveloperWorkspacePage'), 'DeveloperWorkspacePage');
const InventoryUploadPage = lazyNamed(() => import('../features/inventory/InventoryUploadPage'), 'InventoryUploadPage');
const ReportsPage = lazyNamed(() => import('../features/reports/ReportsPage'), 'ReportsPage');
const UploadsPage = lazyNamed(() => import('../features/uploads/UploadsPage'), 'UploadsPage');
const DocketScannerPage = lazyNamed(() => import('../features/docket/DocketScannerPage'), 'DocketScannerPage');
const CreditDispatchListPage = lazyNamed(() => import('../features/credit-dispatch/CreditDispatchListPage'), 'CreditDispatchListPage');
const CreditDispatchDetailPage = lazyNamed(() => import('../features/credit-dispatch/CreditDispatchDetailPage'), 'CreditDispatchDetailPage');
const RequestReportsPage = lazyNamed(() => import('../features/credit-dispatch/RequestReportsPage'), 'RequestReportsPage');
const CreditCustomersPage = lazyNamed(() => import('../features/credit-dispatch/CreditCustomersPage'), 'CreditCustomersPage');
const CreditCustomerLedgerPage = lazyNamed(() => import('../features/credit-dispatch/CreditCustomerLedgerPage'), 'CreditCustomerLedgerPage');
const CreditCustomerProfilePage = lazyNamed(() => import('../features/credit-dispatch/CreditCustomerProfilePage'), 'CreditCustomerProfilePage');
const CreditAgingPage = lazyNamed(() => import('../features/credit-dispatch/CreditAgingPage'), 'CreditAgingPage');
const NewCreditDispatchPage = lazyNamed(() => import('../features/credit-dispatch/NewCreditDispatchPage'), 'NewCreditDispatchPage');

function RouteFallback() {
  return (
    <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-[#d8e0ea] bg-white text-xs font-semibold text-[#64748b]">
      Loading page…
    </div>
  );
}

function RoleLanding() {
  const { role, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated || !role) return <Navigate to="/login" replace />;
  return <Navigate to={roleHomePath[role]} replace />;
}

export function AppRouter() {
  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<RoleLanding />} />
              <Route path="/orders/new" element={<NewOrderPage />} />
              <Route path="/orders/track" element={<TrackOrdersPage />} />
              <Route path="/orders/delayed-vor" element={<DelayedVorPage />} />
              <Route path="/orders/:orderId" element={<OrderDetailPage />} />
              <Route path="/approvals/review/:reviewOrderId" element={<ApprovalsPage />} />
              <Route path="/approvals/:queue" element={<ApprovalsPage />} />
              <Route path="/admin/:queue" element={<AdminPage />} />
              <Route path="/manager/dashboard" element={<ManagerDashboardPage />} />
              <Route path="/developer/workspace" element={<DeveloperWorkspacePage />} />
              <Route path="/uploads" element={<UploadsPage />} />
              <Route path="/inventory/upload" element={<InventoryUploadPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/docket-scanner" element={<DocketScannerPage />} />
              <Route path="/credit-dispatch" element={<CreditDispatchListPage />} />
              <Route path="/credit-dispatch/customers" element={<CreditCustomersPage />} />
              <Route path="/credit-dispatch/customers/aging" element={<CreditAgingPage />} />
              <Route path="/credit-dispatch/customers/profile" element={<CreditCustomerProfilePage />} />
              <Route path="/credit-dispatch/customers/ledger" element={<CreditCustomerLedgerPage />} />
              <Route path="/credit-dispatch/reports" element={<RequestReportsPage />} />
              <Route path="/credit-dispatch/view" element={<CreditDispatchDetailPage />} />
              <Route path="/credit-dispatch/new" element={<NewCreditDispatchPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <GlobalStatusEffects />
      <ResponsiveTableEffects />
    </>
  );
}
