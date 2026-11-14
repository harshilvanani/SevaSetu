import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { errorCode, supabase } from '@/lib/supabase';

export type PrivateEvent = {
  id: string;
  title: string;
  org_id: string;
  org_name: string;
  starts_at: string;
  /** null = no request yet */
  access: 'requested' | 'invited' | 'approved' | 'declined' | 'revoked' | 'expired' | null;
};

/** Private events a signed-in volunteer can see exist (name, organization, date), with their own request status. */
export function usePrivateEvents() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['private-events', session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<PrivateEvent[]> => {
      const { data, error } = await supabase.rpc('list_private_events');
      if (error) throw error;
      return (data ?? []) as PrivateEvent[];
    },
  });
}

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    for (const k of ['private-events', 'discover', 'my-invitations', 'private-event-tasks']) qc.invalidateQueries({ queryKey: [k] });
  };
}

export function useRequestAccess() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (v: { eventId: string; note?: string }) => {
      const { error } = await supabase.rpc('request_event_access', { p_event: v.eventId, p_note: v.note || undefined });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useDeclineEventInvite() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.rpc('decline_event_invitation', { p_event: eventId });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

/** Seva of a private event the volunteer already has access to (RLS hides them otherwise). */
export function usePrivateEventTasks(eventId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['private-event-tasks', eventId],
    enabled: !!eventId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seva_tasks')
        .select('id, title, type, positions, target_qty, unit, starts_at, status')
        .eq('event_id', eventId!)
        .neq('status', 'draft')
        .order('title');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export const accessErrorKey = (e: unknown) => {
  const code = errorCode(e);
  return ['event_not_found', 'already_has_access', 'account_blocked'].includes(code) ? `access.errors.${code}` : 'access.errors.generic';
};
