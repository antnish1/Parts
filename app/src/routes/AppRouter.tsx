import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { LoginPage } from '../auth/LoginPage';
import { RequireAuth } from '../auth/RequireAuth';
import { NewOrderPage } from '../features/orders/NewOrderPage';
import { TrackOrdersPage } from '../features/tracking/TrackOrdersPage';
import { ApprovalsPage } from '../features/approvals/ApprovalsPage';
import { AdminPage } from '../features/admin/AdminPage';
import { ManagerDashboardPage } from '../features/manager/ManagerDashboardPage';
import { DeveloperWorkspacePage } from '../features/developer/DeveloperWorkspacePage';
import { InventoryUploadPage } from '../features/inventory/InventoryUploadPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { DocketScannerPage } from '../features/docket/DocketScannerPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/orders/new" replace />} />
          <Route path="/orders/new" element={<NewOrderPage />} />
          <Route path="/orders/track" element={<TrackOrdersPage />} />
          <Route path="/approvals/:queue" element={<ApprovalsPage />} />
          <Route path="/admin/:queue" element={<AdminPage />} />
          <Route path="/manager/dashboard" element={<ManagerDashboardPage />} />
          <Route path="/developer/workspace" element={<DeveloperWorkspacePage />} />
          <Route path="/inventory/upload" element={<InventoryUploadPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/docket-scanner" element={<DocketScannerPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/orders/new" replace />} />
    </Routes>
  );
}
