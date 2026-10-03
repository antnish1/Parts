import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserProfile, UserRole } from '@/types/auth';

type ProfileRow = {
  id: string;
  full_name: string | null;
  branch: string | null;
  role: UserRole | null;
  is_active: boolean | null;
};

type AuthContextValue = {
  session: Session | null;
  profile: UserProfile | null;
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (loginId: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function loginIdFromSession(session: Session | null) {
  const email = session?.user?.email ?? '';
  return email.includes('@portal.local') ? email.split('@')[0].trim().toUpperCase() : '';
}

async function loadProfile(session: Session | null): Promise<UserProfile | null> {
  if (!session?.user?.id) return null;

  const primary = await supabase
    .from('portal_profiles')
    .select('id, full_name, branch, role, is_active')
    .eq('auth_user_id', session.user.id)
    .maybeSingle<ProfileRow>();

  let profile = primary.data;
  const loginId = loginIdFromSession(session);

  if (!profile && loginId) {
    const fallback = await supabase
      .from('portal_profiles')
      .select('id, full_name, branch, role, is_active')
      .ilike('legacy_user_id', loginId)
      .maybeSingle<ProfileRow>();
    profile = fallback.data ?? null;
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

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function refresh(nextSession: Session | null) {
      const nextProfile = await loadProfile(nextSession);
      if (!active) return;
      setSession(nextSession);
      setProfile(nextProfile);
      setIsLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => refresh(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void refresh(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    profile,
    role: profile?.role ?? null,
    isLoading,
    isAuthenticated: Boolean(session && profile?.isActive),
    signIn: async (loginId, password) => {
      const trimmed = loginId.trim();
      const email = trimmed.includes('@') ? trimmed.toLowerCase() : `${trimmed.toLowerCase()}@portal.local`;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  }), [isLoading, profile, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
