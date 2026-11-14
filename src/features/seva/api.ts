import { useQuery } from '@tanstack/react-query';

import { distanceKm } from '@/domain/seva';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase, type Tables } from '@/lib/supabase';

export const EVENT_FIELDS =
  'id, org_id, title, description, starts_at, ends_at, mode, venue_name, address, city, latitude, longitude, visibility, status, created_by, organizations(id, name)';

export type EventLite = Pick<
  Tables<'events'>,
  'id' | 'org_id' | 'title' | 'description' | 'starts_at' | 'ends_at' | 'mode' | 'venue_name' | 'address' | 'city' | 'latitude' | 'longitude' | 'visibility' | 'status' | 'created_by'
> & { organizations: { id: string; name: string } | null };

export type TaskWithEvent = Tables<'seva_tasks'> & { events: EventLite };

export type AssignmentWithTask = Tables<'assignments'> & {
  seva_tasks: TaskWithEvent;
  progress_reports: Tables<'progress_reports'>[];
  /** Hours the organizer logged when completing the event (counts once the event is completed). */
  event_hours: { hours: number } | null;
};

/** Hours shown on a completed seva: what the organizer logged, if the event is completed. */
export function loggedHours(a: AssignmentWithTask): number | null {
  return a.seva_tasks.events.status === 'completed' && a.event_hours ? Number(a.event_hours.hours) : null;
}

/** The volunteer's totals. Always refetched when shown, so hours logged by an organizer appear straight away. */
export function useVolunteerStats() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['volunteer-stats', session?.user.id],
    enabled: !!session,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('volunteer_stats');
      if (error) throw error;
      return data?.[0] ?? { verified_hours: 0, completed_count: 0, active_count: 0 };
    },
  });
}

/** When the seva happens. Virtual quantity tasks without a fixed time return null ("any time before deadline"). */
export function taskStart(t: TaskWithEvent): string | null {
  if (t.starts_at) return t.starts_at;
  if (t.mode === 'virtual' && t.type === 'quantity') return null;
  return t.events.starts_at;
}

export function taskEnd(t: TaskWithEvent): string | null {
  if (t.ends_at) return t.ends_at;
  if (t.mode === 'virtual' && t.type === 'quantity') return t.signup_deadline ?? t.events.ends_at;
  return t.events.ends_at;
}

export function taskDistance(t: TaskWithEvent, from: { latitude: number | null; longitude: number | null } | null) {
  if (!from || from.latitude == null || from.longitude == null) return null;
  if (t.mode === 'virtual' || t.events.latitude == null || t.events.longitude == null) return null;
  return distanceKm({ lat: from.latitude, lng: from.longitude }, { lat: t.events.latitude, lng: t.events.longitude });
}

/** All seva the viewer can see that are still upcoming (RLS limits private tasks to invitees/org members). */
export function useDiscoverTasks() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['discover', session?.user.id ?? 'guest'],
    queryFn: async (): Promise<TaskWithEvent[]> => {
      const { data, error } = await supabase
        .from('seva_tasks')
        .select(`*, events!inner(${EVENT_FIELDS})`)
        .in('status', ['open', 'full'])
        .eq('events.status', 'published')
        .gte('events.ends_at', new Date().toISOString())
        .order('starts_at', { ascending: true, nullsFirst: false });
      if (error) throw error;
      const now = Date.now();
      return ((data ?? []) as unknown as TaskWithEvent[])
        .filter((t) => {
          const end = taskEnd(t);
          return !end || new Date(end).getTime() > now;
        })
        .sort((a, b) => {
          const sa = taskStart(a) ?? taskEnd(a) ?? '';
          const sb = taskStart(b) ?? taskEnd(b) ?? '';
          return sa.localeCompare(sb);
        });
    },
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['task', id],
    enabled: !!id,
    queryFn: async (): Promise<TaskWithEvent | null> => {
      const { data, error } = await supabase.from('seva_tasks').select(`*, events!inner(${EVENT_FIELDS})`).eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as unknown as TaskWithEvent | null;
    },
  });
}

export function useMyAssignments() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['my-assignments', session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<AssignmentWithTask[]> => {
      const { data, error } = await supabase
        .from('assignments')
        .select(`*, seva_tasks!inner(*, events!inner(${EVENT_FIELDS})), progress_reports(*), event_hours(hours)`)
        .eq('volunteer_id', session!.user.id)
        .order('joined_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AssignmentWithTask[];
    },
  });
}

export type InvitationWithTask = Tables<'task_invitations'> & { seva_tasks: TaskWithEvent };

export function useMyInvitations() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['my-invitations', session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<InvitationWithTask[]> => {
      const { data, error } = await supabase
        .from('task_invitations')
        .select(`*, seva_tasks!inner(*, events!inner(${EVENT_FIELDS}))`)
        .eq('invitee_id', session!.user.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());
      if (error) throw error;
      return (data ?? []) as unknown as InvitationWithTask[];
    },
  });
}

/** Sum of approved / pending report quantities for an assignment. */
export function assignmentProgress(a: AssignmentWithTask) {
  let verified = 0;
  let pending = 0;
  for (const r of a.progress_reports ?? []) {
    if (r.status === 'approved') verified += r.verified_qty ?? 0;
    if (r.status === 'pending') pending += r.reported_qty;
  }
  if (a.seva_tasks.type === 'role') verified = a.status === 'completed' ? 1 : 0;
  return { verified, pending };
}
