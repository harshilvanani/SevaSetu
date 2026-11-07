import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import i18n, { type Locale, SUPPORTED_LOCALES } from '@/lib/i18n';
import { supabase, type Tables } from '@/lib/supabase';

export type Profile = Tables<'profiles'>;
export type Membership = { org_id: string; role: 'owner' | 'organizer'; organizations: Tables<'organizations'> };

type AuthState = {
  session: Session | null;
  initializing: boolean;
  profile: Profile | null;
  memberships: Membership[];
  profileLoading: boolean;
  refreshProfile: () => Promise<unknown>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_OUT') queryClient.clear();
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: profile, error }, { data: memberships, error: mErr }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId!).single(),
        supabase.from('org_members').select('org_id, role, organizations(*)').eq('user_id', userId!),
      ]);
      if (error) throw error;
      if (mErr) throw mErr;
      return { profile, memberships: (memberships ?? []) as unknown as Membership[] };
    },
  });

  // Apply the profile's language preference.
  const locale = profileQuery.data?.profile.locale;
  useEffect(() => {
    if (locale && (SUPPORTED_LOCALES as readonly string[]).includes(locale) && i18n.language !== locale) {
      i18n.changeLanguage(locale as Locale);
    }
  }, [locale]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      initializing,
      profile: profileQuery.data?.profile ?? null,
      memberships: profileQuery.data?.memberships ?? [],
      profileLoading: !!userId && profileQuery.isPending,
      refreshProfile: () => profileQuery.refetch(),
    }),
    [session, initializing, profileQuery, userId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function useApprovedOrgs() {
  const { memberships } = useAuth();
  return memberships.filter((m) => m.organizations?.status === 'approved');
}
