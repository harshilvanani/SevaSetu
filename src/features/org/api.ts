import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApprovedOrgs, useAuth } from '@/features/auth/AuthProvider';
import { useAppStore } from '@/lib/store';
import { supabase, type Tables, type Enums } from '@/lib/supabase';

export type OrgEvent = Tables<'events'> & { seva_tasks: Tables<'seva_tasks'>[] };
export type ReviewItem = Tables<'progress_reports'> & {
  assignments: Pick<Tables<'assignments'>, 'id' | 'volunteer_id' | 'claimed_qty'> & {
    seva_tasks: Pick<Tables<'seva_tasks'>, 'id' | 'title' | 'unit'> & { events: Pick<Tables<'events'>, 'id' | 'title' | 'org_id'> };
  };
};
export type TaskAssignment = Tables<'assignments'> & { progress_reports: Tables<'progress_reports'>[] };

/** The organization the organizer is currently working in (first approved one by default). */
export function useActiveOrg() {
  const orgs = useApprovedOrgs();
  const activeOrgId = useAppStore((s) => s.activeOrgId);
  const setActiveOrgId = useAppStore((s) => s.setActiveOrgId);
  const active = orgs.find((m) => m.org_id === activeOrgId) ?? orgs[0] ?? null;
  return { org: active?.organizations ?? null, role: active?.role ?? null, orgs, setActiveOrgId };
}

export function useOrgEvents(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-events', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<OrgEvent[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*, seva_tasks(*)')
        .eq('org_id', orgId!)
        .order('starts_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as OrgEvent[];
    },
  });
}

export function useOrgEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ['org-event', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const [{ data: event, error }, { data: details }] = await Promise.all([
        supabase.from('events').select('*, seva_tasks(*)').eq('id', eventId!).single(),
        supabase.from('event_private_details').select('*').eq('event_id', eventId!).maybeSingle(),
      ]);
      if (error) throw error;
      const e = event as OrgEvent;
      e.seva_tasks.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return { event: e, details };
    },
  });
}

export function useReviewQueue(orgId: string | undefined) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['review-queue', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<ReviewItem[]> => {
      const { data, error } = await supabase
        .from('progress_reports')
        .select('*, assignments!inner(id, volunteer_id, claimed_qty, seva_tasks!inner(id, title, unit, events!inner(id, title, org_id)))')
        .eq('status', 'pending')
        .eq('assignments.seva_tasks.events.org_id', orgId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      // Organizers don't review their own reports.
      return ((data ?? []) as unknown as ReviewItem[]).filter((r) => r.assignments.volunteer_id !== session?.user.id);
    },
  });
}

export function useTaskAssignments(taskIds: string[]) {
  return useQuery({
    queryKey: ['task-assignments', taskIds.join(',')],
    enabled: taskIds.length > 0,
    queryFn: async (): Promise<TaskAssignment[]> => {
      const { data, error } = await supabase.from('assignments').select('*, progress_reports(*)').in('task_id', taskIds).neq('status', 'cancelled');
      if (error) throw error;
      return (data ?? []) as TaskAssignment[];
    },
  });
}

export function useTaskInvitations(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-invitations', taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase.from('task_invitations').select('*').eq('task_id', taskId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Volunteer display names visible to organizers (RLS: participants/invitees of their org). */
export function useProfileNames(ids: string[]) {
  const unique = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ['profile-names', unique.join(',')],
    enabled: unique.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, email').in('id', unique);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name || p.email || '—'])) as Record<string, string>;
    },
  });
}

function useInvalidateOrg() {
  const qc = useQueryClient();
  return () => {
    for (const k of ['org-events', 'org-event', 'review-queue', 'task-assignments', 'task-invitations', 'discover', 'nav-badges', 'my-assignments']) {
      qc.invalidateQueries({ queryKey: [k] });
    }
  };
}

export function useCreateOrganization() {
  const { refreshProfile } = useAuth();
  return useMutation({
    mutationFn: async (v: { name: string; city: string; description: string }) => {
      const { data, error } = await supabase.rpc('create_organization', { p_name: v.name, p_city: v.city, p_description: v.description });
      if (error) throw error;
      return data;
    },
    onSuccess: () => refreshProfile(),
  });
}

export type EventInput = {
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  mode: Enums<'participation_mode'>;
  venue_name: string | null;
  address: string | null;
  city: string | null;
  latitude?: number | null;
  longitude?: number | null;
  visibility: Enums<'visibility'>;
  online_details: string | null;
  contact_info: string | null;
};

export function useSaveEvent() {
  const invalidate = useInvalidateOrg();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async ({ id, orgId, input }: { id?: string; orgId: string; input: EventInput }) => {
      const { online_details, contact_info, ...fields } = input;
      let eventId = id;
      if (id) {
        const { error } = await supabase.from('events').update(fields).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('events')
          .insert({ ...fields, org_id: orgId, created_by: session!.user.id, status: 'draft' })
          .select('id')
          .single();
        if (error) throw error;
        eventId = data.id;
      }
      const { error: dErr } = await supabase.from('event_private_details').upsert({ event_id: eventId!, online_details, contact_info });
      if (dErr) throw dErr;
      return eventId!;
    },
    onSuccess: invalidate,
  });
}

export function usePublishEvent() {
  const invalidate = useInvalidateOrg();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.rpc('publish_event', { p_event: eventId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSetEventStatus() {
  const invalidate = useInvalidateOrg();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'cancelled' | 'completed' }) => {
      const { error } = await supabase.from('events').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteEvent() {
  const invalidate = useInvalidateOrg();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export type TaskInput = {
  title: string;
  description: string;
  instructions: string;
  steps: string[];
  category: string | null;
  type: Enums<'task_type'>;
  target_qty: number | null;
  unit: string | null;
  max_per_volunteer: number | null;
  max_volunteers: number | null;
  minutes_per_unit: number | null;
  positions: number | null;
  starts_at: string | null;
  ends_at: string | null;
  signup_deadline: string | null;
  mode: Enums<'participation_mode'>;
  visibility: Enums<'visibility'>;
};

export function useSaveTask() {
  const invalidate = useInvalidateOrg();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async ({
      id,
      eventId,
      eventStatus,
      input,
      invitees,
      inviteDays,
    }: {
      id?: string;
      eventId: string;
      eventStatus: Enums<'event_status'>;
      input: TaskInput;
      invitees: string[];
      inviteDays: number;
    }) => {
      let taskId = id;
      if (id) {
        const { type: _type, ...editable } = input;
        const { error } = await supabase.from('seva_tasks').update(editable).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('seva_tasks')
          .insert({ ...input, event_id: eventId, created_by: session!.user.id, status: eventStatus === 'published' ? 'open' : 'draft' })
          .select('id')
          .single();
        if (error) throw error;
        taskId = data.id;
      }
      if (invitees.length) {
        const { error } = await supabase.rpc('invite_to_task', { p_task: taskId!, p_users: invitees, p_days: inviteDays });
        if (error) throw error;
      }
      return taskId!;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateOrg();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('seva_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSetTaskStatus() {
  const invalidate = useInvalidateOrg();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Enums<'task_status'> }) => {
      const { error } = await supabase.from('seva_tasks').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useReviewProgress() {
  const invalidate = useInvalidateOrg();
  return useMutation({
    mutationFn: async (v: { reportId: string; decision: 'approve' | 'adjust' | 'reject'; verifiedQty?: number; reason?: string }) => {
      const { error } = await supabase.rpc('review_progress', {
        p_report: v.reportId,
        p_decision: v.decision,
        p_verified_qty: v.verifiedQty,
        p_reason: v.reason,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useCompleteAssignment() {
  const invalidate = useInvalidateOrg();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.rpc('complete_assignment', { p_assignment: assignmentId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSearchVolunteers(orgId: string | undefined, q: string) {
  return useQuery({
    queryKey: ['search-volunteers', orgId, q],
    enabled: !!orgId && q.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_volunteers', { p_org: orgId!, p_query: q });
      if (error) throw error;
      return data ?? [];
    },
  });
}
