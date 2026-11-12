import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

// Counts shown on navigation: active seva, unread notifications, pending reviews (organizers).
export function useNavBadges() {
  const { session, memberships, profile } = useAuth();
  const isAdmin = !!profile?.is_platform_admin;
  const uid = session?.user.id;
  const orgIds = memberships.filter((m) => m.organizations?.status === 'approved').map((m) => m.org_id);

  const { data } = useQuery({
    queryKey: ['nav-badges', uid, orgIds.join(','), isAdmin],
    enabled: !!uid,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [active, unread, pending, orgs] = await Promise.all([
        supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('volunteer_id', uid!).eq('status', 'active'),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', uid!).is('read_at', null),
        orgIds.length
          ? supabase
              .from('progress_reports')
              .select('id, assignments!inner(volunteer_id)', { count: 'exact', head: true })
              .eq('status', 'pending')
              .neq('assignments.volunteer_id', uid!)
          : Promise.resolve({ count: 0 }),
        isAdmin
          ? supabase.from('organizations').select('id', { count: 'exact', head: true }).eq('status', 'pending')
          : Promise.resolve({ count: 0 }),
      ]);
      return { activeSeva: active.count ?? 0, unread: unread.count ?? 0, pendingReviews: pending.count ?? 0, pendingOrgs: orgs.count ?? 0 };
    },
  });
  return data ?? { activeSeva: 0, unread: 0, pendingReviews: 0, pendingOrgs: 0 };
}
