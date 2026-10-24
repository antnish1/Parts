import { useAuth } from '@/auth/AuthProvider';
import { ManagerHomeDashboard } from '@/components/ManagerHomeDashboard';
import { RoleHomeDashboard } from '@/components/RoleHomeDashboard';
import { AccountsHomeDashboard } from '@/components/AccountsHomeDashboard';

export default function HomeScreen() {
  const { role } = useAuth();
  return role === 'manager' ? <ManagerHomeDashboard /> : role === 'accounts' ? <AccountsHomeDashboard /> : <RoleHomeDashboard />;
}
