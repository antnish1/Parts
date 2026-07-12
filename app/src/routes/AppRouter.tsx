import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { LoginPage } from '../auth/LoginPage';
import { RequireAuth } from '../auth/RequireAuth';
import { useAuth } from '../auth/useAuth';
import { roleHomePath } from '../auth/roleGuards';
import { GlobalStatusEffects } from '../components/ui/GlobalStatusEffects';
import { NewOrderPage } from '../features/orders/NewOrderPage';
import { OrderDetailPage } from '../features/orders/OrderDetailPage';
import { TrackOrdersPage } from '../features/tracking/TrackOrdersPage';
import { DelayedVorPage } from '../features/tracking/DelayedVorPage';
import { ApprovalsPage } from '../features/approvals/ApprovalsPage';
import { AdminPage } from '../features/admin/AdminPage';
import { ManagerDashboardPage } from '../features/manager/ManagerDashboardPage';
import { DeveloperWorkspacePage } from '../features/developer/DeveloperWorkspacePage';
import { InventoryUploadPage } from '../features/inventory/InventoryUploadPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { UploadsPage } from '../features/uploads/UploadsPage';
import { DocketScannerPage } from '../features/docket/DocketScannerPage';
import { CreditDispatchListPage } from '../features/credit-dispatch/CreditDispatchListPage';
import { CreditDispatchDetailPage } from '../features/credit-dispatch/CreditDispatchDetailPage';
import { RequestReportsPage } from '../features/credit-dispatch/RequestReportsPage';
import { CreditCustomersPage } from '../features/credit-dispatch/CreditCustomersPage';
import { CreditCustomerLedgerPage } from '../features/credit-dispatch/CreditCustomerLedgerPage';
import { CreditCustomerProfilePage } from '../features/credit-dispatch/CreditCustomerProfilePage';
import { CreditAgingPage } from '../features/credit-dispatch/CreditAgingPage';
import { NewCreditDispatchPage } from '../features/credit-dispatch/NewCreditDispatchPage';

function RoleLanding() {
  const { role, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated || !role) return <Navigate to="/login" replace />;
  return <Navigate to={roleHomePath[role]} replace />;
}

export function AppRouter() {
  return (
    <>
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
      <GlobalStatusEffects />
    </>
  );
}
