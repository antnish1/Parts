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

async function loadProfile(session: Session | null): Promise<UserProfile | null> {
  if (!session?.user?.id) return null;

  const { data, error } = await supabase
    .from('test_profiles')
    .select('id, full_name, branch, role, is_active')
    .eq('id', session.user.id)
    .maybeSingle<ProfileRow>();

  if (error) {
    console.error('Failed to load auth profile', error);
  }

  if (!data) {
    return {
      id: session.user.id,
      fullName: session.user.email ?? 'Authenticated User',
      branch: 'Unassigned',
      role: 'viewer',
      isActive: true,
    };
  }

  return {
    id: data.id,
    fullName: data.full_name ?? session.user.email ?? 'Authenticated User',
    branch: data.branch ?? 'Unassigned',
    role: data.role ?? 'viewer',
    isActive: data.is_active ?? false,
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
