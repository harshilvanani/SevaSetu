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
  useHideSuggestions,
  useOrgEvent,
  useProfileNames,
  usePublishEvent,
  useReopenEvent,
  useSetEventStatus,
  useTaskAssignments,
} from '@/features/org/api';
import { AccessCard } from '@/features/org/AccessCard';
import { OrganizerGate, StatusBadge, useStaffingText } from '@/features/org/components';
import { StepHeader } from '@/features/org/EventForm';
import { exportVolunteers } from '@/features/org/export';
import { suggestedSeva, useLocalized, useSaveTemplate, useTemplates } from '@/features/org/templates';
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
  const reopen = useReopenEvent();
  const hide = useHideSuggestions();
  const templates = useTemplates();
  const saveTemplate = useSaveTemplate();
  const localized = useLocalized();
  const assignments = useTaskAssignments(event.seva_tasks.map((x) => x.id));
  const names = useProfileNames((assignments.data ?? []).map((a) => a.volunteer_id));
  const [publishError, setPublishError] = useState<string | null>(null);
  const { ask, dialog } = useConfirm();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const isDraft = event.status === 'draft';
  const tasks = event.seva_tasks;
  const template = templates.data?.find((x) => x.id === event.template_id);
  const suggestions = template && event.status !== 'cancelled' && event.status !== 'completed' ? suggestedSeva(template.event_template_tasks, tasks.map((x) => x.title)) : [];

  const checks = [
    { ok: event.title.trim().length > 1, label: t('eventForm.checkTitle') },
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
          <Button title={t('eventForm.completeEvent')} variant="outline" onPress={() => router.push({ pathname: '/events/[id]/complete', params: { id: event.id } })} />
          <Button title={t('eventForm.cancelEvent')} variant="danger" onPress={() => ask({ title: t('eventForm.cancelEvent'), body: t('eventForm.cancelConfirm'), confirmLabel: t('eventForm.cancelEvent'), destructive: true, onConfirm: async () => { await setStatus.mutateAsync({ id: event.id, status: 'cancelled' }); } })} />
        </Card>
      ) : event.status === 'completed' ? (
        <Card style={{ gap: 10, padding: 20 }}>
          <Row gap={8}>
            <Icon name="check" size={18} color={colors.success} />
            <Text variant="label" color={colors.success}>{t('complete.done')}</Text>
          </Row>
          <Text variant="caption">{t('complete.doneBody')}</Text>
          <Button
            title={t('complete.undo')}
            variant="outline"
            onPress={() =>
              ask({
                title: t('complete.undoTitle'),
                body: t('complete.undoBody'),
                confirmLabel: t('complete.undo'),
                onConfirm: async () => {
                  await reopen.mutateAsync(event.id);
                },
              })
            }
          />
        </Card>
      ) : null}
      {event.visibility === 'private' && event.status !== 'cancelled' ? <AccessCard eventId={event.id} orgId={event.org_id} isPrivate /> : null}
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          ask({
            title: t('eventForm.saveTemplate'),
            body: t('eventForm.saveTemplateBody'),
            fieldLabel: t('eventForm.templateName'),
            initialValue: event.title,
            singleLine: true,
            reason: 'required',
            confirmLabel: t('common.save'),
            onConfirm: async (name) => {
              await saveTemplate.mutateAsync({ orgId: event.org_id, name, visibility: event.visibility, tasks: tasks.map((x) => ({ name: x.title })) });
            },
          })
        }
        style={{ alignSelf: 'center', padding: 6 }}>
        <Text variant="label" color={colors.purple}>{t('eventForm.saveTemplate')}</Text>
      </Pressable>
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
          {event.status === 'draft' || event.status === 'published' ? (
            <Button title={t('find.open')} icon="search" variant="outline" onPress={() => router.push({ pathname: '/events/[id]/find', params: { id: event.id } })} />
          ) : null}
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
          {suggestions.length ? (
            <Card style={{ gap: 10, padding: 20, backgroundColor: colors.purpleTint }}>
              <Text variant="h3">{t('eventForm.suggested', { name: localized(template!) })}</Text>
              <Text variant="caption" color={colors.purpleDark}>{t('eventForm.suggestedBody')}</Text>
              <Row gap={8} wrap>
                {suggestions.map((x) => (
                  <Pressable
                    key={x.id}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/events/[id]/task', params: { id: event.id, name: localized(x) } })}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 38, borderRadius: 999, backgroundColor: pressed ? colors.border : colors.white, borderWidth: 1, borderColor: colors.border })}>
                    <Icon name="plus" size={14} color={colors.purple} />
                    <Text variant="bodySm" weight="medium">{localized(x).trim()}</Text>
                  </Pressable>
                ))}
              </Row>
              <Pressable accessibilityRole="button" onPress={() => hide.mutate(event.id)} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
                <Text variant="label" color={colors.purpleDark}>{t('eventForm.hideSuggestions')}</Text>
              </Pressable>
            </Card>
          ) : null}
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
