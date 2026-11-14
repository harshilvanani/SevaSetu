import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export type DemoPersona = 'volunteer' | 'volunteer2' | 'organizer';
export type DemoAccount = { persona: DemoPersona; user_id: string; email: string; password: string; full_name: string };

/** While an admin is viewing the app as a demo person, their own session is parked here (this tab only). */
type Stash = { admin: { access_token: string; refresh_token: string }; accounts: DemoAccount[] };
const KEY = 'sevasetu.demo';
let memory: Stash | null = null;

export function getDemoStash(): Stash | null {
  if (memory) return memory;
  if (Platform.OS === 'web') {
    try {
      const raw = window.sessionStorage.getItem(KEY);
      if (raw) memory = JSON.parse(raw) as Stash;
    } catch {
      /* storage unavailable */
    }
  }
  return memory;
}

function setDemoStash(s: Stash | null) {
  memory = s;
  if (Platform.OS !== 'web') return;
  try {
    if (s) window.sessionStorage.setItem(KEY, JSON.stringify(s));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export function useDemoAccounts() {
  return useQuery({
    queryKey: ['admin', 'demo-accounts'],
    queryFn: async (): Promise<DemoAccount[]> => {
      const { data, error } = await supabase.rpc('admin_demo_accounts');
      if (error) throw error;
      return (data ?? []) as DemoAccount[];
    },
  });
}

export function useResetDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_reset_demo');
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

/** Sign in as a demo person. The admin's own session is kept so "Back to admin" restores it. */
export async function enterDemo(accounts: DemoAccount[], persona: DemoPersona, qc: QueryClient) {
  const account = accounts.find((a) => a.persona === persona);
  if (!account) throw new Error('demo_not_set_up');
  const existing = getDemoStash();
  let admin = existing?.admin;
  if (!admin) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error('not_authenticated');
    admin = { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
  }
  const { error } = await supabase.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw error;
  setDemoStash({ admin, accounts });
  qc.clear();
  router.replace(persona === 'organizer' ? '/events' : '/discover');
}

/** Back to the admin's own session. If it can no longer be restored, the admin signs in again. */
export async function exitDemo(qc: QueryClient) {
  const stash = getDemoStash();
  setDemoStash(null);
  if (stash) {
    const { error } = await supabase.auth.setSession(stash.admin);
    if (!error) {
      qc.clear();
      router.replace('/admin/demo');
      return;
    }
  }
  await supabase.auth.signOut();
  router.replace('/sign-in');
}
