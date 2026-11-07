import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { DateTimeField } from '@/components/DateTimeField';
import { SearchField, TextField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Avatar, Card, Row, Screen, TopBar, useLayout } from '@/components/Layout';
import { OptionCards } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { useActiveOrg, useDeleteTask, useOrgEvent, useSaveTask, useSearchVolunteers, useSetTaskStatus, useTaskInvitations, type OrgEvent } from '@/features/org/api';
import { OrganizerGate } from '@/features/org/components';
import { StepHeader } from '@/features/org/EventForm';
import { INTERESTS } from '@/features/profile/prefs';
import type { Enums, Tables } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

export default function TaskScreen() {
  const { t } = useTranslation();
  const { id, taskId } = useLocalSearchParams<{ id: string; taskId?: string }>();
  const event = useOrgEvent(id);
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/events/[id]', params: { id } }));
  const task = event.data?.event.seva_tasks.find((x) => x.id === taskId);
  return (
    <OrganizerGate>
      {() => (
        <Screen header={<TopBar onBack={back} title={event.data?.event.title} />} maxWidth={860}>
          <Text variant="h1">{taskId ? t('taskForm.editTitle') : t('taskForm.newTitle')}</Text>
          {event.data?.event.status === 'draft' ? <StepHeader step={2} /> : null}
          {event.data && (!taskId || task) ? (
            <TaskForm key={taskId ?? 'new'} event={event.data.event} task={task} onDone={back} />
          ) : (
            <Text variant="caption">{t('common.loading')}</Text>
          )}
        </Screen>
      )}
    </OrganizerGate>
  );
}

const num = (s: string) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};

function TaskForm({ event, task, onDone }: { event: OrgEvent; task?: Tables<'seva_tasks'>; onDone: () => void }) {
  const { t } = useTranslation();
  const { isDesktop } = useLayout();
  const { org } = useActiveOrg();
  const save = useSaveTask();
  const del = useDeleteTask();
  const setStatus = useSetTaskStatus();
  const invitations = useTaskInvitations(task?.id);

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [steps, setSteps] = useState((task?.steps ?? []).join('\n'));
  const [instructions, setInstructions] = useState(task?.instructions ?? '');
  const [category, setCategory] = useState<string | null>(task?.category ?? null);
  const [type, setType] = useState<Enums<'task_type'>>(task?.type ?? 'quantity');
  const [target, setTarget] = useState(String(task?.target_qty ?? 10));
  const [unit, setUnit] = useState(task?.unit ?? '');
  const [maxPer, setMaxPer] = useState(String(task?.max_per_volunteer ?? ''));
  const [maxVols, setMaxVols] = useState(String(task?.max_volunteers ?? ''));
  const [minutes, setMinutes] = useState(String(task?.minutes_per_unit ?? ''));
  const [positions, setPositions] = useState(String(task?.positions ?? 2));
  const [starts, setStarts] = useState<Date | null>(task?.starts_at ? new Date(task.starts_at) : null);
  const [ends, setEnds] = useState<Date | null>(task?.ends_at ? new Date(task.ends_at) : null);
  const [deadline, setDeadline] = useState<Date | null>(task?.signup_deadline ? new Date(task.signup_deadline) : null);
  const [mode, setMode] = useState<Enums<'participation_mode'>>(task?.mode ?? (event.mode === 'hybrid' ? 'onsite' : event.mode));
  const [visibility, setVisibility] = useState<Enums<'visibility'>>(task?.visibility ?? 'public');
  const [invitees, setInvitees] = useState<{ id: string; name: string }[]>([]);
  const [inviteDays, setInviteDays] = useState(7);
  const [q, setQ] = useState('');
  const search = useSearchVolunteers(org?.id, q);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isQty = type === 'quantity';
  const locked = (task?.volunteers_count ?? 0) > 0;

  const submit = async (addAnother: boolean) => {
    const e: Record<string, string> = {};
    if (title.trim().length < 2) e.title = t('taskForm.required');
    if (isQty) {
      if (!num(target) || num(target)! < 1) e.target = t('taskForm.positive');
      if (!unit.trim()) e.unit = t('taskForm.required');
    } else if (!num(positions) || num(positions)! < 1) e.positions = t('taskForm.positive');
    if (starts && ends && ends <= starts) e.ends = t('eventForm.endAfterStart');
    setErrors(e);
    if (Object.keys(e).length) return;
    await save.mutateAsync({
      id: task?.id,
      eventId: event.id,
      eventStatus: event.status,
      invitees: visibility === 'private' ? invitees.map((i) => i.id) : [],
      inviteDays,
      input: {
        title: title.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        steps: steps.split('\n').map((s) => s.trim()).filter(Boolean),
        category,
        type,
        target_qty: isQty ? num(target) : null,
        unit: isQty ? unit.trim() : null,
        max_per_volunteer: isQty ? num(maxPer) : null,
        max_volunteers: isQty ? num(maxVols) : null,
        minutes_per_unit: isQty ? num(minutes) : null,
        positions: isQty ? null : num(positions),
        starts_at: starts?.toISOString() ?? null,
        ends_at: ends?.toISOString() ?? null,
        signup_deadline: deadline?.toISOString() ?? null,
        mode,
        visibility,
      },
    });
    if (addAnother) router.replace({ pathname: '/events/[id]/task', params: { id: event.id } });
    else onDone();
  };

  const tg = num(target) ?? 0;
  const mp = num(maxPer) ?? tg;
  const summary = isQty && unit
    ? num(maxVols)
      ? t('taskForm.summaryQty', { vols: num(maxVols), target: tg, unit, max: mp })
      : t('taskForm.summaryQtyNoVols', { target: tg, unit, max: mp })
    : null;

  const twoCol = isDesktop ? { flexDirection: 'row' as const, gap: 16 } : { gap: 16 };

  return (
    <View style={{ gap: 20 }}>
      <Card style={{ gap: 16, padding: 20 }}>
        <TextField label={t('taskForm.title')} value={title} onChangeText={setTitle} error={errors.title} placeholder="Call shelters to confirm counts" />
        <TextField label={t('taskForm.description')} value={description} onChangeText={setDescription} multiline />
        <TextField label={t('taskForm.steps')} optional value={steps} onChangeText={setSteps} multiline hint={t('taskForm.stepsHint')} />
        <View style={{ gap: 8 }}>
          <Text variant="label">{t('taskForm.category')}</Text>
          <Row gap={8} wrap>
            {INTERESTS.map((k) => (
              <Chip key={k} size="sm" label={t(`interests.${k}`)} selected={category === k} onPress={() => setCategory(category === k ? null : k)} />
            ))}
          </Row>
        </View>
      </Card>

      <Card style={{ gap: 16, padding: 20 }}>
        <Text variant="h3">{t('taskForm.type')}</Text>
        {locked ? (
          <Text variant="bodySm" weight="medium">{isQty ? t('taskForm.quantity') : t('taskForm.role')}</Text>
        ) : (
          <OptionCards
            label={t('taskForm.type')}
            value={type}
            onChange={setType}
            options={[
              { value: 'quantity', title: t('taskForm.quantity'), body: t('taskForm.quantityBody') },
              { value: 'role', title: t('taskForm.role'), body: t('taskForm.roleBody') },
            ]}
          />
        )}
        {isQty ? (
          <>
            <View style={twoCol}>
              <View style={{ flex: 1 }}>
                <TextField label={t('taskForm.target')} value={target} onChangeText={setTarget} keyboardType="number-pad" error={errors.target} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label={t('taskForm.unit')} value={unit} onChangeText={setUnit} placeholder={t('taskForm.unitPlaceholder')} error={errors.unit} />
              </View>
            </View>
            <View style={twoCol}>
              <View style={{ flex: 1 }}>
                <TextField label={t('taskForm.maxPer')} optional value={maxPer} onChangeText={setMaxPer} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label={t('taskForm.maxVolunteers')} optional value={maxVols} onChangeText={setMaxVols} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label={t('taskForm.minutesPer')} optional value={minutes} onChangeText={setMinutes} keyboardType="number-pad" hint={t('taskForm.minutesHint')} />
              </View>
            </View>
            {summary ? (
              <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.purpleTint }}>
                <Text variant="caption" color={colors.purpleDark}>{summary}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <TextField label={t('taskForm.positions')} value={positions} onChangeText={setPositions} keyboardType="number-pad" error={errors.positions} />
        )}
      </Card>

      <Card style={{ gap: 16, padding: 20 }}>
        <View style={{ gap: 4 }}>
          <Text variant="h3">{t('taskForm.schedule')}</Text>
          <Text variant="caption">{t('taskForm.scheduleHint')}</Text>
        </View>
        <View style={twoCol}>
          <View style={{ flex: 1 }}>
            <DateTimeField label={t('taskForm.starts')} optional value={starts} onChange={setStarts} />
          </View>
          <View style={{ flex: 1 }}>
            <DateTimeField label={t('taskForm.ends')} optional value={ends} onChange={setEnds} error={errors.ends} />
          </View>
        </View>
        <DateTimeField label={t('taskForm.deadline')} optional value={deadline} onChange={setDeadline} />
        <View style={{ gap: 8 }}>
          <Text variant="label">{t('taskForm.mode')}</Text>
          <Row gap={8} wrap>
            {(['onsite', 'virtual', 'hybrid'] as const).map((m) => (
              <Chip key={m} size="sm" label={t(`availability.modes.${m}`)} selected={mode === m} onPress={() => setMode(m)} />
            ))}
          </Row>
        </View>
      </Card>

      <Card style={{ gap: 16, padding: 20 }}>
        <Text variant="h3">{t('taskForm.visibility')}</Text>
        <OptionCards
          label={t('taskForm.visibility')}
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: 'public', title: t('seva.public'), body: t('taskForm.publicBody') },
            { value: 'private', title: t('seva.private'), body: t('taskForm.privateBody') },
          ]}
        />
        {visibility === 'private' ? (
          <View style={{ gap: 12 }}>
            <Text variant="label">{t('taskForm.invite')}</Text>
            {(invitations.data ?? []).length ? (
              <Text variant="caption">{t('taskForm.invitedCount', { count: invitations.data!.filter((i) => i.status === 'pending' || i.status === 'accepted').length })}</Text>
            ) : null}
            <Row gap={8} wrap>
              {invitees.map((p) => (
                <Row key={p.id} gap={4} style={{ height: 34, paddingLeft: 10, paddingRight: 4, borderRadius: 999, backgroundColor: colors.amberTint }}>
                  <Text variant="bodySm" color={colors.amberText}>{p.name}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} onPress={() => setInvitees(invitees.filter((x) => x.id !== p.id))} style={{ padding: 6 }}>
                    <Icon name="x" size={13} color={colors.amberText} />
                  </Pressable>
                </Row>
              ))}
            </Row>
            <SearchField value={q} onChangeText={setQ} placeholder={t('taskForm.inviteSearch')} />
            {q.trim().length >= 2 ? (
              <View style={{ gap: 6 }}>
                {(search.data ?? []).length === 0 && !search.isPending ? <Text variant="caption">{t('taskForm.inviteNone')}</Text> : null}
                {(search.data ?? [])
                  .filter((p) => !invitees.some((i) => i.id === p.id))
                  .map((p) => (
                    <Pressable
                      key={p.id}
                      accessibilityRole="button"
                      onPress={() => {
                        setInvitees([...invitees, { id: p.id, name: p.full_name || p.email }]);
                        setQ('');
                      }}
                      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: pressed ? colors.track : colors.cream }]}>
                      <Avatar name={p.full_name || p.email} size={32} color={colors.purpleTint} />
                      <View style={{ flex: 1 }}>
                        <Text variant="bodySm" weight="medium">{p.full_name || '—'}</Text>
                        <Text variant="caption">{[p.email, p.city].filter(Boolean).join(' · ')}</Text>
                      </View>
                      <Icon name="plus" size={18} color={colors.purple} />
                    </Pressable>
                  ))}
              </View>
            ) : null}
            <View style={{ gap: 8 }}>
              <Text variant="label">{t('taskForm.expiry')}</Text>
              <Row gap={8}>
                {[3, 7, 14].map((d) => (
                  <Chip key={d} size="sm" label={t('taskForm.days', { count: d })} selected={inviteDays === d} onPress={() => setInviteDays(d)} />
                ))}
              </Row>
            </View>
            <Text variant="caption">{t('taskForm.inviteNote')}</Text>
          </View>
        ) : null}
      </Card>

      <Card style={{ gap: 12, padding: 20 }}>
        <TextField label={t('taskForm.instructions')} optional value={instructions} onChangeText={setInstructions} multiline />
      </Card>

      {save.error ? <Text variant="caption" color={colors.danger}>{(save.error as Error).message}</Text> : null}
      <View style={[{ gap: 10 }, isDesktop && { flexDirection: 'row-reverse' }]}>
        <Button title={t('taskForm.save')} size="lg" onPress={() => submit(false)} loading={save.isPending} style={isDesktop ? { flex: 1 } : undefined} />
        {!task ? <Button title={t('taskForm.saveAdd')} size="lg" variant="outline" onPress={() => submit(true)} disabled={save.isPending} style={isDesktop ? { flex: 1 } : undefined} /> : null}
      </View>
      {task ? (
        <Row gap={16} wrap>
          {task.status === 'open' || task.status === 'full' ? (
            <Pressable accessibilityRole="button" onPress={() => setStatus.mutate({ id: task.id, status: 'closed' }, { onSuccess: onDone })} style={{ padding: 6 }}>
              <Text variant="label" color={colors.subtle}>{t('taskForm.closeSignups')}</Text>
            </Pressable>
          ) : task.status === 'closed' ? (
            <Pressable accessibilityRole="button" onPress={() => setStatus.mutate({ id: task.id, status: 'open' }, { onSuccess: onDone })} style={{ padding: 6 }}>
              <Text variant="label" color={colors.purple}>{t('taskForm.reopen')}</Text>
            </Pressable>
          ) : null}
          {locked ? (
            <Text variant="caption" style={{ padding: 6 }}>{t('taskForm.deleteBlocked')}</Text>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => del.mutate(task.id, { onSuccess: onDone })} style={{ padding: 6 }}>
              <Text variant="label" color={colors.danger}>{t('taskForm.delete')}</Text>
            </Pressable>
          )}
        </Row>
      ) : null}
    </View>
  );
}
