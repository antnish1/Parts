import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserProfile, UserRole } from './roleGuards';

const fallbackProfile: UserProfile = {
  id: 'scaffold-user',
  fullName: 'Migration User',
  branch: 'HQ',
  role: 'developer',
  isActive: true,
};

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session ?? null);
      setProfile(data.session ? fallbackProfile : null);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setProfile(nextSession ? fallbackProfile : null);
      setIsLoading(false);
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
    isAuthenticated: Boolean(session),
    isLoading,
  };
}
