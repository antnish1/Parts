import { useAuth } from '@/auth/AuthProvider';
import { ManagerHomeDashboard } from '@/components/ManagerHomeDashboard';
import { RoleHomeDashboard } from '@/components/RoleHomeDashboard';

export default function HomeScreen() {
  const { role } = useAuth();
  return role === 'manager' ? <ManagerHomeDashboard /> : <RoleHomeDashboard />;
}
