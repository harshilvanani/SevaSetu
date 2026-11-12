import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { errorCode, supabase, type Tables } from '@/lib/supabase';

export type AdminOverview = {
  users: number;
  users_7d: number;
  blocked: number;
  admins: number;
  orgs: Partial<Record<'pending' | 'approved' | 'rejected' | 'suspended', number>>;
  events_live: number;
  active_volunteers: number;
  verified_hours: number;
};

export type AdminUser = {
  id: string;
  email: string | null;
  full_name: string;
  city: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  providers: string[];
  is_platform_admin: boolean;
  blocked_at: string | null;
  blocked_reason: string | null;
  onboarded: boolean;
  org_count: number;
  assignment_count: number;
};

export type OrgAction = 'approve' | 'reject' | 'suspend' | 'reinstate';

const KNOWN = ['cannot_block_self', 'cannot_block_admin', 'cannot_remove_self', 'last_admin', 'user_blocked', 'invalid_transition'];
export const adminErrorKey = (e: unknown) => {
  const code = errorCode(e);
  return KNOWN.includes(code) ? `admin.errors.${code}` : 'admin.errors.generic';
};

export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_overview');
      if (error) throw error;
      return data as unknown as AdminOverview;
    },
  });
}

export function useAdminOrganizations() {
  return useQuery({
    queryKey: ['admin', 'orgs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminOrganization(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'org', id],
    enabled: !!id,
    queryFn: async () => {
      const [org, members, events] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', id!).maybeSingle(),
        supabase.from('org_members').select('role, user_id, created_at').eq('org_id', id!),
        supabase.from('events').select('*, seva_tasks(volunteers_count)').eq('org_id', id!).order('starts_at', { ascending: false }),
      ]);
      if (org.error) throw org.error;
      const ids = [...new Set([...(members.data ?? []).map((m) => m.user_id), org.data?.created_by, org.data?.reviewed_by].filter(Boolean) as string[])];
      const { data: people } = ids.length ? await supabase.from('profiles').select('id, full_name, email').in('id', ids) : { data: [] };
      return {
        org: org.data,
        members: members.data ?? [],
        events: (events.data ?? []) as (Tables<'events'> & { seva_tasks: { volunteers_count: number }[] })[],
        people: Object.fromEntries((people ?? []).map((p) => [p.id, p])) as Record<string, { id: string; full_name: string; email: string | null }>,
      };
    },
  });
}

export function useAdminUsers(query: string) {
  return useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_users', { p_query: query || undefined });
      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
  });
}

export function useAdminUserDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'user', id],
    enabled: !!id,
    queryFn: async () => {
      const [memberships, assignments] = await Promise.all([
        supabase.from('org_members').select('role, organizations(id, name, status)').eq('user_id', id!),
        supabase
          .from('assignments')
          .select('id, status, claimed_qty, joined_at, seva_tasks(id, title, unit, type, events(title))')
          .eq('volunteer_id', id!)
          .order('joined_at', { ascending: false }),
      ]);
      if (assignments.error) throw assignments.error;
      return {
        memberships: (memberships.data ?? []) as unknown as { role: string; organizations: { id: string; name: string; status: string } }[],
        assignments: (assignments.data ?? []) as unknown as {
          id: string;
          status: string;
          claimed_qty: number;
          joined_at: string;
          seva_tasks: { id: string; title: string; unit: string | null; type: string; events: { title: string } };
        }[],
      };
    },
  });
}

export function useAdminEvents() {
  return useQuery({
    queryKey: ['admin', 'events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, organizations(id, name), seva_tasks(volunteers_count)')
        .order('starts_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as (Tables<'events'> & { organizations: { id: string; name: string }; seva_tasks: { volunteers_count: number }[] })[];
    },
  });
}

export function useAuditLog(limit = 200) {
  return useQuery({
    queryKey: ['admin', 'audit', limit],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_actions').select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      const adminIds = [...new Set((data ?? []).map((a) => a.admin_id).filter(Boolean) as string[])];
      const { data: names } = adminIds.length
        ? await supabase.from('public_profiles').select('id, full_name').in('id', adminIds)
        : { data: [] };
      const byId = Object.fromEntries((names ?? []).map((n) => [n.id!, n.full_name ?? '']));
      return (data ?? []).map((a) => ({ ...a, admin_name: byId[a.admin_id ?? ''] ?? '' }));
    },
  });
}

function useInvalidateAdmin() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['admin'] });
    qc.invalidateQueries({ queryKey: ['discover'] });
  };
}

export function useReviewOrganization() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: async (v: { id: string; action: OrgAction; reason?: string }) => {
      const { error } = await supabase.rpc('admin_review_organization', { p_org: v.id, p_action: v.action, p_reason: v.reason });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSetUserBlocked() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: async (v: { id: string; blocked: boolean; reason?: string }) => {
      const { data, error } = await supabase.rpc('admin_set_user_blocked', { p_user: v.id, p_blocked: v.blocked, p_reason: v.reason });
      if (error) throw error;
      return data as unknown as { cancelled: number };
    },
    onSuccess: invalidate,
  });
}

export function useSetPlatformAdmin() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: async (v: { id: string; admin: boolean }) => {
      const { error } = await supabase.rpc('admin_set_platform_admin', { p_user: v.id, p_admin: v.admin });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useCancelEvent() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: async (v: { id: string; reason: string }) => {
      const { error } = await supabase.rpc('admin_cancel_event', { p_event: v.id, p_reason: v.reason });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
