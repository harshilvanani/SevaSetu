import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase, type Tables } from '@/lib/supabase';

/** The browser's / device's time zone (match scores look at the weekday and time of day). */
export const deviceTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export type Alert = {
  kind: 'understaffed' | 'almost_full' | 'log_hours' | 'missing_availability' | 'pending_reviews';
  severity: 'high' | 'medium' | 'low';
  at: string;
  title?: string;
  event_id?: string;
  missing?: number;
  percent?: number;
  count?: number;
};

export type RegionRow = {
  region: string;
  volunteers: number;
  active: number;
  teachers: number;
  teacher_names: string[];
  centres: string[];
  upcoming_events: number;
  positions: number;
  filled: number;
  hours: number;
};

export type UpcomingRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  mode: 'onsite' | 'virtual' | 'hybrid';
  city: string | null;
  centre: string | null;
  region: string | null;
  visibility: 'public' | 'private';
  positions: number;
  filled: number;
  volunteers: number;
};

export type Insights = {
  kpis: {
    volunteers: number;
    active_volunteers: number;
    active_prev: number;
    teachers: number;
    upcoming_events: number;
    new_events_month: number;
    hours_total: number;
    hours_month: number;
    hours_prev_month: number;
    people_reached: number;
    completed_events: number;
    active_regions: number;
    retention: number | null;
    teacher_coverage: number | null;
  };
  monthly_hours: { month: string; hours: number }[];
  hours_by_area: { area: string; hours: number }[];
  regions: RegionRow[];
  upcoming: UpcomingRow[];
  data_health: {
    total: number;
    profiles: number;
    skills: number;
    languages: number;
    availability: number;
    location: number;
    courses: number;
    hours_logged: number;
    hours_expected: number;
  };
  alerts: Alert[];
};

/** Dashboard, impact, regions and data health for one organization (or the whole platform for admins). */
export function useOrgInsights(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ['org-insights', orgId ?? 'platform'],
    enabled: orgId !== undefined,
    queryFn: async (): Promise<Insights> => {
      const { data, error } = await supabase.rpc('org_insights', orgId ? { p_org: orgId } : {});
      if (error) throw error;
      return data as unknown as Insights;
    },
  });
}

export type Slot = { weekday: number; period: 'morning' | 'afternoon' | 'evening' };
export type HistoryRow = { task: string; event: string; event_id: string; starts_at: string; status: string; hours: number };
export type DirectoryPerson = {
  id: string;
  full_name: string;
  email: string | null;
  code: string;
  person_type: PersonType;
  city: string | null;
  province: string | null;
  country: string;
  region: string | null;
  interests: string[];
  skills: string[];
  skill_levels: Record<string, SkillLevel>;
  languages: string[];
  courses: string[];
  profession: string | null;
  linkedin_url: string | null;
  serve_mode: 'onsite' | 'virtual' | 'either';
  served_with_org: boolean;
  opted_in: boolean;
  is_active: boolean;
  last_active: string | null;
  hours: number;
  events_count: number;
  onboarded: boolean;
  availability: Slot[];
  history: HistoryRow[] | null;
};

export type PersonType = 'volunteer' | 'volunteer_teacher' | 'full_time_teacher';
export type SkillLevel = 'beginner' | 'intermediate' | 'expert';

/** The organization's volunteer directory (people who served with it or opted in). */
export function useDirectory(orgId: string | undefined) {
  return useQuery({
    queryKey: ['directory', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<DirectoryPerson[]> => {
      const { data, error } = await supabase.rpc('org_directory', { p_org: orgId! });
      if (error) throw error;
      return (data ?? []) as unknown as DirectoryPerson[];
    },
  });
}

export function useDirectoryPerson(orgId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['directory-person', orgId, userId],
    enabled: !!orgId && !!userId,
    queryFn: async (): Promise<DirectoryPerson | null> => {
      const { data, error } = await supabase.rpc('org_directory', { p_org: orgId!, p_user: userId! });
      if (error) throw error;
      return ((data ?? [])[0] as unknown as DirectoryPerson) ?? null;
    },
  });
}

export type TeamMember = {
  id: string;
  full_name: string;
  status: 'invited' | 'active';
  person_type: PersonType;
  interests: string[];
  skills: string[];
  skill_levels: Record<string, SkillLevel>;
  region: string | null;
  languages: string[];
};
export type Team = {
  id: string;
  name: string;
  description: string;
  seva_area: string | null;
  target_size: number;
  centre_id: string | null;
  centre_name: string | null;
  region: string | null;
  lead_id: string | null;
  lead_name: string | null;
  members: TeamMember[];
};

export function useOrgTeams(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-teams', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Team[]> => {
      const { data, error } = await supabase.rpc('org_teams', { p_org: orgId! });
      if (error) throw error;
      return (data ?? []) as unknown as Team[];
    },
  });
}

export type Suggestion = { id: string; full_name: string; person_type: PersonType; region: string | null; city: string | null; score: number; reasons: string[] };

export function useTeamSuggestions(teamId: string | undefined) {
  return useQuery({
    queryKey: ['team-suggestions', teamId],
    enabled: !!teamId,
    queryFn: async (): Promise<Suggestion[]> => {
      const { data, error } = await supabase.rpc('team_suggestions', { p_team: teamId! });
      if (error) throw error;
      return (data ?? []) as Suggestion[];
    },
  });
}

function useInvalidateTeams() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['org-teams'] });
    qc.invalidateQueries({ queryKey: ['team-suggestions'] });
    qc.invalidateQueries({ queryKey: ['my-teams'] });
  };
}

export function useSaveTeam() {
  const done = useInvalidateTeams();
  return useMutation({
    mutationFn: async (v: { id?: string; org_id: string; name: string; description: string; seva_area: string | null; centre_id: string | null; target_size: number }) => {
      const { id, org_id, ...rest } = v;
      if (id) {
        const { error } = await supabase.from('teams').update(rest).eq('id', id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase.from('teams').insert({ org_id, ...rest }).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: done,
  });
}

export function useDeleteTeam() {
  const done = useInvalidateTeams();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: done,
  });
}

export function useSetTeamLead() {
  const done = useInvalidateTeams();
  return useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string | null }) => {
      const { error } = await supabase.from('teams').update({ lead_id: userId }).eq('id', teamId);
      if (error) throw error;
    },
    onSuccess: done,
  });
}

export function useInviteToTeam() {
  const done = useInvalidateTeams();
  return useMutation({
    mutationFn: async ({ teamId, users }: { teamId: string; users: string[] }) => {
      const { data, error } = await supabase.rpc('invite_to_team', { p_team: teamId, p_users: users });
      if (error) throw error;
      return data;
    },
    onSuccess: done,
  });
}

export function useRemoveTeamMember() {
  const done = useInvalidateTeams();
  return useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      const { error } = await supabase.rpc('remove_team_member', { p_team: teamId, p_user: userId });
      if (error) throw error;
    },
    onSuccess: done,
  });
}

export type MyTeam = { id: string; name: string; org_name: string; seva_area: string | null; status: 'invited' | 'active'; lead_name: string | null; members_count: number };

export function useMyTeams() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['my-teams', session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<MyTeam[]> => {
      const { data, error } = await supabase.rpc('my_teams');
      if (error) throw error;
      return (data ?? []) as MyTeam[];
    },
  });
}

export function useRespondTeam() {
  const done = useInvalidateTeams();
  return useMutation({
    mutationFn: async ({ teamId, accept }: { teamId: string; accept: boolean }) => {
      const { error } = await supabase.rpc('respond_team_invite', { p_team: teamId, p_accept: accept });
      if (error) throw error;
    },
    onSuccess: done,
  });
}

export type Centre = Tables<'centres'>;

export function useCentres(orgId: string | undefined) {
  return useQuery({
    queryKey: ['centres', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Centre[]> => {
      const { data, error } = await supabase.from('centres').select('*').eq('org_id', orgId!).order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveCentre() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id?: string; org_id: string; name: string; city: string | null; province: string | null; country: string }) => {
      const { id, org_id, ...rest } = v;
      const { error } = id
        ? await supabase.from('centres').update(rest).eq('id', id)
        : await supabase.from('centres').insert({ org_id, ...rest });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['centres'] });
      qc.invalidateQueries({ queryKey: ['org-insights'] });
    },
  });
}

export type MySummary = { code: string; hours: number; events_count: number; is_active: boolean; joined_at: string };

export function useMySummary() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['my-summary', session?.user.id],
    enabled: !!session,
    staleTime: 0,
    queryFn: async (): Promise<MySummary | null> => {
      const { data, error } = await supabase.rpc('my_summary');
      if (error) throw error;
      return (data?.[0] as MySummary) ?? null;
    },
  });
}

export function useMyOpenMatches() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['my-open-matches', session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('my_open_matches', { p_tz: deviceTz() });
      if (error) throw error;
      return data ?? 0;
    },
  });
}

export type Breakdown = { score: number; skills: number; area: number; availability: number; location: number; experience: number; linkedin: number };

/** The signed-in volunteer's match with each seva (Discover badges). */
export function useMyMatchScores(taskIds: string[]) {
  const { session } = useAuth();
  const key = [...taskIds].sort().join(',');
  return useQuery({
    queryKey: ['my-match', session?.user.id, key],
    enabled: !!session && taskIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, Breakdown>> => {
      const { data, error } = await supabase.rpc('my_match_scores', { p_tasks: taskIds, p_tz: deviceTz() });
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.task_id, r.breakdown as unknown as Breakdown]));
    },
  });
}

/** Private accessibility needs (only you, admins, and organizers of seva you joined can read them). */
export function useMyPrivate() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['profile-private', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.from('profile_private').select('accessibility_needs').eq('user_id', session!.user.id).maybeSingle();
      if (error) throw error;
      return data?.accessibility_needs ?? '';
    },
  });
}

export function useSaveMyPrivate() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (needs: string) => {
      const uid = session!.user.id;
      const text = needs.trim();
      if (!text) {
        const { error } = await supabase.from('profile_private').delete().eq('user_id', uid);
        if (error) throw error;
        return;
      }
      // update first (only that column is writable), insert when there is no row yet
      const { data, error } = await supabase.from('profile_private').update({ accessibility_needs: text }).eq('user_id', uid).select('user_id');
      if (error) throw error;
      if (!data?.length) {
        const { error: insErr } = await supabase.from('profile_private').insert({ user_id: uid, accessibility_needs: text });
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile-private'] }),
  });
}

export function useRepeatWeekly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, until }: { eventId: string; until: string }) => {
      const { data, error } = await supabase.rpc('repeat_event_weekly', { p_event: eventId, p_until: until, p_tz: deviceTz() });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-events'] }),
  });
}
