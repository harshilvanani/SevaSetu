import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { useAppStore } from '@/lib/store';

// Entry point: route to the right place for the current session.
export default function Index() {
  const { session, profile } = useAuth();
  const mode = useAppStore((s) => s.mode);
  if (!session) return <Redirect href="/sign-in" />;
  if (!profile?.onboarded_at) return <Redirect href="/location" />;
  return <Redirect href={mode === 'organizer' ? '/dashboard' : '/discover'} />;
}
