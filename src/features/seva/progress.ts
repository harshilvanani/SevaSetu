import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { errorCode, supabase } from '@/lib/supabase';

import type { AssignmentWithTask } from './api';
import { taskStart } from './api';

export function useSubmitProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, qty, note }: { assignmentId: string; qty: number; note?: string }) => {
      const { data, error } = await supabase.rpc('submit_progress', { p_assignment: assignmentId, p_qty: qty, p_note: note ?? undefined });
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['my-assignments'] });
      qc.invalidateQueries({ queryKey: ['discover'] });
    },
  });
}

export const progressErrorKey = (e: unknown) => {
  const code = errorCode(e);
  return ['quantity_exceeds_remaining', 'quantity_below_reported', 'reports_pending'].includes(code)
    ? `mySeva.errors.${code}`
    : 'mySeva.errors.generic';
};

/** Names for reviewer / organizer ids. */
export function usePublicNames(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter(Boolean) as string[])].sort();
  return useQuery({
    queryKey: ['public-names', unique.join(',')],
    enabled: unique.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('public_profiles').select('id, full_name').in('id', unique);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.id!, p.full_name ?? ''])) as Record<string, string>;
    },
  });
}

export type Bucket = 'active' | 'upcoming' | 'completed';

/** Active = in progress or within a week; Upcoming = scheduled further out; Completed = verified. */
export function bucketOf(a: AssignmentWithTask, now = new Date()): Bucket | null {
  if (a.status === 'completed') return 'completed';
  if (a.status !== 'active') return null;
  const start = taskStart(a.seva_tasks);
  if (a.seva_tasks.type === 'role' && start && new Date(start).getTime() - now.getTime() > 7 * 86_400_000) return 'upcoming';
  return 'active';
}
