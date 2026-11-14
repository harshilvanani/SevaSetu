import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { useConfirm } from '@/components/ConfirmDialog';
import { Badge } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { Card, Divider, EmptyState, Row, Screen, TopBar, useLayout } from '@/components/Layout';
import { Text } from '@/components/Text';
import {
  type OrgEvent,
  type TaskAssignment,
  useCompleteAssignment,
  useDeleteEvent,
  useOrgEvent,
  useProfileNames,
  usePublishEvent,
  useSetEventStatus,
  useTaskAssignments,
} from '@/features/org/api';
import { OrganizerGate, StatusBadge, useStaffingText } from '@/features/org/components';
import { StepHeader } from '@/features/org/EventForm';
import { exportVolunteers } from '@/features/org/export';
import { formatDay, formatRange } from '@/lib/format';
import { errorCode, type Tables } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

export default function ManageEventScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useOrgEvent(id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/events'));
  return (
    <OrganizerGate>
      {() => (
        <Screen title={t('org.events')} header={<TopBar onBack={back} title={event.data?.event.title} />} maxWidth={1100} refreshing={event.isRefetching} onRefresh={() => event.refetch()}>
          {event.data ? <Manage event={event.data.event} /> : <Text variant="caption">{t('common.loading')}</Text>}
        </Screen>
      )}
    </OrganizerGate>
  );
}

function Manage({ event }: { event: OrgEvent }) {
  const { t } = useTranslation();
  const { isDesktop } = useLayout();
  const publish = usePublishEvent();
  const setStatus = useSetEventStatus();
  const del = useDeleteEvent();
  const assignments = useTaskAssignments(event.seva_tasks.map((x) => x.id));
  const names = useProfileNames((assignments.data ?? []).map((a) => a.volunteer_id));
  const [publishError, setPublishError] = useState<string | null>(null);
  const { ask, dialog } = useConfirm();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const isDraft = event.status === 'draft';
  const tasks = event.seva_tasks;

  const checks = [
    { ok: event.title.trim().length > 1 && event.description.trim().length > 0, label: t('eventForm.checkTitle') },
    { ok: new Date(event.ends_at) > new Date(event.starts_at), label: t('eventForm.checkDate') },
    { ok: event.mode === 'virtual' || !!event.address, label: t('eventForm.checkLocation') },
    { ok: tasks.length > 0, label: t('eventForm.checkTask') },
  ];
  const canPublish = checks.every((c) => c.ok);

  const doPublish = async () => {
    setPublishError(null);
    try {
      await publish.mutateAsync(event.id);
    } catch (e) {
      const code = errorCode(e);
      setPublishError(code === 'venue_required' ? t('eventForm.addressRequired') : code === 'task_required' ? t('eventForm.noTasks') : (e as Error).message);
    }
  };

  const doExport = async () => {
    setExporting(true);
    setExportError(false);
    try {
      await exportVolunteers(event, assignments.data ?? [], t);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  };

  const sameDay = new Date(event.starts_at).toDateString() === new Date(event.ends_at).toDateString();
  const when = sameDay
    ? `${formatDay(event.starts_at)} · ${formatRange(event.starts_at, event.ends_at)}`
    : `${formatDay(event.starts_at)} – ${formatDay(event.ends_at)}`;

  const side = (
    <View style={{ gap: 12, width: isDesktop ? 340 : undefined }}>
      {isDraft ? (
        <Card style={{ gap: 12, padding: 20 }}>
          <Text variant="h3">{t('eventForm.checklist')}</Text>
          {checks.map((c) => (
            <Row key={c.label} gap={10}>
              <View style={{ width: 22, height: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: c.ok ? colors.purple : colors.track }}>
                {c.ok ? <Icon name="check" size={13} color={colors.white} strokeWidth={2.6} /> : null}
              </View>
              <Text variant="bodySm" color={c.ok ? colors.text : colors.muted}>{c.label}</Text>
            </Row>
          ))}
          <Button title={t('eventForm.publish')} size="lg" disabled={!canPublish} loading={publish.isPending} onPress={doPublish} />
          {publishError ? <Text variant="caption" color={colors.danger}>{publishError}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => ask({ title: t('eventForm.deleteDraft'), body: t('eventForm.deleteDraftConfirm'), confirmLabel: t('common.delete'), destructive: true, onConfirm: async () => { await del.mutateAsync(event.id); router.replace('/events'); } })} style={{ alignSelf: 'center', padding: 6 }}>
            <Text variant="label" color={colors.danger}>{t('eventForm.deleteDraft')}</Text>
          </Pressable>
        </Card>
      ) : event.status === 'published' ? (
        <Card style={{ gap: 10, padding: 20 }}>
          <Row gap={8}>
            <Icon name="check" size={18} color={colors.success} />
            <Text variant="label" color={colors.success}>{t('eventForm.published')}</Text>
          </Row>
          <Text variant="caption">{t('eventForm.publishedBody')}</Text>
          <Button title={t('eventForm.completeEvent')} variant="outline" onPress={() => setStatus.mutate({ id: event.id, status: 'completed' })} />
          <Button title={t('eventForm.cancelEvent')} variant="danger" onPress={() => ask({ title: t('eventForm.cancelEvent'), body: t('eventForm.cancelConfirm'), confirmLabel: t('eventForm.cancelEvent'), destructive: true, onConfirm: async () => { await setStatus.mutateAsync({ id: event.id, status: 'cancelled' }); } })} />
        </Card>
      ) : null}
    </View>
  );

  return (
    <View style={{ gap: 20 }}>
      {dialog}
      <View style={{ gap: 10 }}>
        <Row gap={10} wrap>
          <Text variant="h1" style={{ flexShrink: 1 }}>{event.title}</Text>
          <StatusBadge status={event.status} />
        </Row>
        <Text variant="caption">
          {when} · {t(`availability.modes.${event.mode}`)} · {event.visibility === 'public' ? t('seva.public') : t('seva.private')}
          {event.venue_name || event.address ? ` · ${event.venue_name ?? event.address}` : ''}
        </Text>
        <Row gap={10} wrap>
          <Button title={t('common.edit')} icon="edit" variant="outline" onPress={() => router.push({ pathname: '/events/[id]/edit', params: { id: event.id } })} />
          {(assignments.data ?? []).length > 0 ? (
            <Button title={t('export.download')} icon="inbox" variant="outline" loading={exporting} onPress={doExport} />
          ) : null}
        </Row>
        {exportError ? <Text variant="caption" color={colors.danger}>{t('common.somethingWrong')}</Text> : null}
        {isDraft ? <StepHeader step={tasks.length ? 3 : 2} /> : null}
      </View>

      <View style={[{ gap: 20 }, isDesktop && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1, gap: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="h3">{t('eventForm.tasksInEvent')} · {tasks.length}</Text>
            <Button title={t('eventForm.addAnother')} icon="plus" variant="secondary" onPress={() => router.push({ pathname: '/events/[id]/task', params: { id: event.id } })} />
          </Row>
          {tasks.length === 0 ? <EmptyState title={t('eventForm.noTasks')} /> : null}
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} assignments={(assignments.data ?? []).filter((a) => a.task_id === task.id)} names={names.data ?? {}} />
          ))}
        </View>
        {side}
      </View>
    </View>
  );
}

function TaskCard({ task, assignments, names }: { task: Tables<'seva_tasks'>; assignments: TaskAssignment[]; names: Record<string, string> }) {
  const { t } = useTranslation();
  const staffing = useStaffingText()(task);
  const complete = useCompleteAssignment();
  const [open, setOpen] = useState(false);
  return (
    <Card style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }} gap={8}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title">{task.title}</Text>
          <Text variant="caption">
            {task.type === 'quantity' ? `${t('seva.quantityBased')} · ${task.target_qty} ${task.unit}` : `${t('seva.roleBased')} · ${task.positions}`} ·{' '}
            {t(`availability.modes.${task.mode}`)} · {task.visibility === 'public' ? t('seva.public') : t('seva.private')}
          </Text>
        </View>
        <StatusBadge status={task.status} />
      </Row>
      <Row gap={12} wrap>
        <Text variant="caption" color={colors.text}>{staffing.capacity}</Text>
        <Text variant="caption" color={colors.text}>{staffing.progress}</Text>
        <Badge label={staffing.staffing} tone={staffing.tone} />
      </Row>
      <Row gap={10}>
        <Button title={t('common.edit')} variant="outline" onPress={() => router.push({ pathname: '/events/[id]/task', params: { id: task.event_id, taskId: task.id } })} style={{ height: 40 }} />
        <Button
          title={`${t('taskForm.joined')} · ${assignments.length}`}
          variant="ghost"
          icon={open ? 'chevronDown' : 'chevronRight'}
          onPress={() => setOpen(!open)}
          style={{ height: 40 }}
        />
      </Row>
      {open ? (
        <View style={{ gap: 8 }}>
          <Divider color={colors.cardBorder} />
          {assignments.length === 0 ? <Text variant="caption">{t('taskForm.noVolunteers')}</Text> : null}
          {assignments.map((a) => {
            const verified = a.progress_reports.filter((r) => r.status === 'approved').reduce((n, r) => n + (r.verified_qty ?? 0), 0);
            const pending = a.progress_reports.filter((r) => r.status === 'pending').reduce((n, r) => n + r.reported_qty, 0);
            return (
              <Row key={a.id} gap={10} style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodySm" weight="medium">{names[a.volunteer_id] ?? '—'}</Text>
                  <Text variant="caption">
                    {task.type === 'quantity'
                      ? `${a.claimed_qty} ${task.unit} · ${verified} ${t('mySeva.verified').toLowerCase()} · ${pending} ${t('mySeva.inReview').toLowerCase()}`
                      : formatDay(a.joined_at)}
                  </Text>
                </View>
                {a.status === 'completed' ? (
                  <Badge label={t('org.served')} tone="success" icon="check" />
                ) : task.type === 'role' ? (
                  <Button title={t('org.markServed')} variant="outline" onPress={() => complete.mutate(a.id)} style={{ height: 38 }} />
                ) : null}
              </Row>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}
