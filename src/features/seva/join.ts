import { useMutation, useQueryClient } from '@tanstack/react-query';

import { errorCode, supabase } from '@/lib/supabase';

export type JoinResult =
  | { status: 'joined'; assignment_id: string; qty: number }
  | { status: 'capacity_changed'; available: number }
  | { status: 'full' };

const KNOWN = ['course_required', 'invitation_required', 'signup_closed', 'already_joined', 'quantity_exceeds_max', 'task_not_open', 'event_not_published'];
export const joinErrorKey = (e: unknown) => {
  const code = errorCode(e);
  return KNOWN.includes(code) ? `join.errors.${code}` : 'join.errors.generic';
};

function invalidateSeva(qc: ReturnType<typeof useQueryClient>, taskId?: string) {
  qc.invalidateQueries({ queryKey: ['discover'] });
  qc.invalidateQueries({ queryKey: ['my-assignments'] });
  qc.invalidateQueries({ queryKey: ['my-invitations'] });
  qc.invalidateQueries({ queryKey: ['nav-badges'] });
  if (taskId) qc.invalidateQueries({ queryKey: ['task', taskId] });
}

export function useJoinTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (qty: number): Promise<JoinResult> => {
      const { data, error } = await supabase.rpc('join_task', { p_task: taskId, p_qty: qty });
      if (error) throw error;
      return data as unknown as JoinResult;
    },
    onSettled: () => invalidateSeva(qc, taskId),
  });
}

export function useDeclineInvitation(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase.rpc('decline_invitation', { p_invitation: invitationId });
      if (error) throw error;
    },
    onSettled: () => invalidateSeva(qc, taskId),
  });
}

export function useLeaveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { data, error } = await supabase.rpc('leave_task', { p_assignment: assignmentId });
      if (error) throw error;
      return data as unknown as { status: 'cancelled' } | { status: 'completed'; kept: number };
    },
    onSettled: () => invalidateSeva(qc),
  });
}

export function useUpdateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, qty }: { assignmentId: string; qty: number }) => {
      const { data, error } = await supabase.rpc('update_claim', { p_assignment: assignmentId, p_qty: qty });
      if (error) throw error;
      return data as unknown as { status: 'updated'; qty: number } | { status: 'capacity_changed'; available: number };
    },
    onSettled: () => invalidateSeva(qc),
  });
}
