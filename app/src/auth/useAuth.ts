import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserProfile, UserRole } from './roleGuards';

type ProfileRow = {
  id: string;
  full_name: string | null;
  branch: string | null;
  role: UserRole | null;
  is_active: boolean | null;
};

function loginIdFromSession(session: Session | null) {
  const email = session?.user?.email ?? '';
  return email.includes('@portal.local') ? email.split('@')[0].trim().toUpperCase() : '';
}

async function loadProfile(session: Session | null): Promise<UserProfile | null> {
  if (!session?.user?.id) return null;

  const { data, error } = await supabase
    .from('portal_profiles')
    .select('id, full_name, branch, role, is_active')
    .eq('auth_user_id', session.user.id)
    .maybeSingle<ProfileRow>();

  if (error) console.error('Failed to load auth profile', error);

  let profile = data;
  const loginId = loginIdFromSession(session);

  if (!profile && loginId) {
    const { data: loginProfile, error: loginProfileError } = await supabase
      .from('portal_profiles')
      .select('id, full_name, branch, role, is_active')
      .ilike('legacy_user_id', loginId)
      .maybeSingle<ProfileRow>();

    if (loginProfileError) console.error('Failed to load auth profile by login id', loginProfileError);
    profile = loginProfile ?? null;
  }

  if (!profile) {
    return {
      id: session.user.id,
      fullName: session.user.email ?? 'Authenticated User',
      branch: 'Unassigned',
      role: 'viewer',
      isActive: true,
    };
  }

  return {
    id: profile.id,
    fullName: profile.full_name ?? session.user.email ?? 'Authenticated User',
    branch: profile.branch ?? 'Unassigned',
    role: profile.role ?? 'viewer',
    isActive: profile.is_active ?? false,
  };
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function refresh(nextSession: Session | null) {
      const nextProfile = await loadProfile(nextSession);
      if (!isMounted) return;
      setSession(nextSession);
      setProfile(nextProfile);
      setIsLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => refresh(data.session ?? null));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      refresh(nextSession);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const role = useMemo<UserRole | null>(() => profile?.role ?? null, [profile]);

  return {
    session,
    profile,
    role,
    isAuthenticated: Boolean(session && profile?.isActive),
    isLoading,
  };
}
