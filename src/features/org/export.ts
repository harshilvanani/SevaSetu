import type { TFunction } from 'i18next';

import { downloadCsv, fileSlug, toCsv } from '@/lib/csv';
import { supabase } from '@/lib/supabase';

import type { OrgEvent, TaskAssignment } from './api';

/** Downloads a spreadsheet of everyone who joined the event's seva, with their reported and verified progress. */
export async function exportVolunteers(event: OrgEvent, assignments: TaskAssignment[], t: TFunction) {
  const ids = [...new Set(assignments.map((a) => a.volunteer_id))];
  const { data, error } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
  if (error) throw error;
  const people = new Map((data ?? []).map((p) => [p.id, p]));
  const taskOf = new Map(event.seva_tasks.map((x) => [x.id, x]));

  const rows: (string | number | null)[][] = [
    [
      t('export.task'),
      t('export.volunteer'),
      t('export.email'),
      t('export.joined'),
      t('export.committed'),
      t('export.reported'),
      t('export.pending'),
      t('export.verified'),
      t('export.status'),
    ],
  ];
  for (const a of [...assignments].sort((x, y) => (taskOf.get(x.task_id)?.title ?? '').localeCompare(taskOf.get(y.task_id)?.title ?? ''))) {
    const task = taskOf.get(a.task_id);
    const person = people.get(a.volunteer_id);
    const quantity = task?.type === 'quantity';
    const sum = (status: string, key: 'reported_qty' | 'verified_qty') =>
      a.progress_reports.filter((r) => r.status === status).reduce((n, r) => n + (r[key] ?? 0), 0);
    rows.push([
      task?.title ?? '',
      person?.full_name || '',
      person?.email ?? '',
      a.joined_at.slice(0, 10),
      quantity ? `${a.claimed_qty} ${task?.unit ?? ''}`.trim() : t('export.onePosition'),
      quantity ? sum('pending', 'reported_qty') + sum('approved', 'reported_qty') : '',
      quantity ? sum('pending', 'reported_qty') : '',
      quantity ? sum('approved', 'verified_qty') : '',
      t(`export.statuses.${a.status}`),
    ]);
  }
  await downloadCsv(`${fileSlug(event.title)}-volunteers-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
}
