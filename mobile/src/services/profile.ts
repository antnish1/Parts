import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types/auth';

type PortalProfileRow = {
  id: string;
  role: UserRole | null;
  branch: string | null;
  is_active: boolean | null;
};

function loginIdFromEmail(email: string | null | undefined) {
  const value = email ?? '';
  return value.includes('@portal.local') ? value.split('@')[0].trim().toUpperCase() : '';
}

export async function getCurrentPortalProfile(): Promise<PortalProfileRow | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return null;

  const primary = await supabase
    .from('portal_profiles')
    .select('id, role, branch, is_active')
    .eq('auth_user_id', userId)
    .maybeSingle<PortalProfileRow>();

  if (primary.data) return primary.data;

  const loginId = loginIdFromEmail(sessionData.session?.user?.email);
  if (!loginId) return null;

  const fallback = await supabase
    .from('portal_profiles')
    .select('id, role, branch, is_active')
    .ilike('legacy_user_id', loginId)
    .maybeSingle<PortalProfileRow>();

  return fallback.data ?? null;
}
