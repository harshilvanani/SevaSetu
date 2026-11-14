import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/Button';
import { Badge } from '@/components/Chip';
import { useConfirm } from '@/components/ConfirmDialog';
import { TextField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Card, Divider, EmptyState, Row, Screen, TopBar, useLayout } from '@/components/Layout';
import { ImpactBar } from '@/components/ProgressBar';
import { Segmented } from '@/components/Segmented';
import { Stepper } from '@/components/Stepper';
import { Text } from '@/components/Text';
import { progressBreakdown, remaining, reportable } from '@/domain/seva';
import { useAuth } from '@/features/auth/AuthProvider';
import { type AssignmentWithTask, assignmentProgress, taskEnd, taskStart, useMyAssignments } from '@/features/seva/api';
import { useTaskText } from '@/features/seva/components';
import { useLeaveTask, useUpdateClaim } from '@/features/seva/join';
import { type Bucket, bucketOf, progressErrorKey, usePublicNames, useSubmitProgress } from '@/features/seva/progress';
import { addToCalendar } from '@/lib/calendar';
import { formatDateTime, formatDay, formatTime, formatWhen } from '@/lib/format';
import { errorCode, supabase } from '@/lib/supabase';
import { colors, fonts, radius } from '@/theme/tokens';

export default function MySevaScreen() {
  const { t } = useTranslation();
  const { isDesktop } = useLayout();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ assignment?: string; report?: string }>();
  const assignments = useMyAssignments();
  const [bucket, setBucket] = useState<Bucket>('active');
  const [selectedId, setSelectedId] = useState<string | null>(params.assignment ?? null);
  const [reportOpen, setReportOpen] = useState(params.report === '1');

  const stats = useQuery({
    queryKey: ['volunteer-stats', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('volunteer_stats');
      if (error) throw error;
      return data?.[0] ?? { verified_hours: 0, completed_count: 0, active_count: 0 };
    },
  });

  if (!session) {
    return (
      <Screen title={t('mySeva.title')} maxWidth={560}>
        <View style={{ paddingTop: 24, gap: 12 }}>
          <Text variant="h1">{t('profile.guestTitle')}</Text>
          <Text variant="body" color={colors.body}>{t('profile.guestBody')}</Text>
        </View>
        <Button title={t('auth.signIn')} size="lg" onPress={() => router.push('/sign-in')} />
      </Screen>
    );
  }

  const all = assignments.data ?? [];
  const groups: Record<Bucket, AssignmentWithTask[]> = { active: [], upcoming: [], completed: [] };
  for (const a of all) {
    const b = bucketOf(a);
    if (b) groups[b].push(a);
  }
  const list = groups[bucket];
  const selected = all.find((a) => a.id === selectedId) ?? null;
  const select = (id: string | null) => {
    setSelectedId(id);
    router.setParams({ assignment: id ?? undefined, report: undefined });
  };

  // Phone: detail replaces the list.
  if (!isDesktop && selected) {
    return (
      <>
        <Screen title={t('mySeva.title')} header={<TopBar title={t('mySeva.title')} onBack={() => select(null)} />} maxWidth={720}>
          <AssignmentDetail a={selected} onReport={() => setReportOpen(true)} inlineReport={false} />
        </Screen>
        <ReportSheet a={selected} visible={reportOpen} onClose={() => setReportOpen(false)} />
      </>
    );
  }

  const listView = (
    <View style={{ gap: 16, flex: isDesktop ? 0.9 : undefined }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="h1">{t('mySeva.title')}</Text>
        {isDesktop ? <Button title={t('mySeva.findMore')} variant="outline" icon="search" onPress={() => router.navigate('/discover')} /> : null}
      </Row>
      <Segmented
        label={t('mySeva.title')}
        value={bucket}
        onChange={setBucket}
        options={(['active', 'upcoming', 'completed'] as const).map((b) => ({
          value: b,
          label: groups[b].length ? t('mySeva.tabCount', { label: t(`mySeva.${b}`), count: groups[b].length }) : t(`mySeva.${b}`),
        }))}
      />
      <Row gap={12}>
        <Card style={{ flex: 1, gap: 0, paddingVertical: 12 }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 26, lineHeight: 32 }}>{stats.data?.verified_hours ?? 0}</Text>
          <Text variant="caption">{t('mySeva.hoursStat')}</Text>
        </Card>
        <Card style={{ flex: 1, gap: 0, paddingVertical: 12 }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 26, lineHeight: 32 }}>{stats.data?.completed_count ?? 0}</Text>
          <Text variant="caption">{t('mySeva.completedStat')}</Text>
        </Card>
      </Row>
      {assignments.isPending ? (
        <Text variant="caption">{t('common.loading')}</Text>
      ) : list.length === 0 ? (
        <EmptyState
          title={t(bucket === 'active' ? 'mySeva.emptyActive' : bucket === 'upcoming' ? 'mySeva.emptyUpcoming' : 'mySeva.emptyCompleted')}
          body={bucket === 'completed' ? t('mySeva.emptyCompletedBody') : t('mySeva.emptyActiveBody')}>
          <Button title={t('mySeva.findMore')} variant="outline" onPress={() => router.navigate('/discover')} />
        </EmptyState>
      ) : (
        list.map((a) => <AssignmentCard key={a.id} a={a} selected={isDesktop && a.id === selected?.id} onPress={() => select(a.id)} />)
      )}
      {!isDesktop && list.length > 0 ? (
        <Button title={t('mySeva.findMore')} variant="secondary" icon="search" onPress={() => router.navigate('/discover')} />
      ) : null}
    </View>
  );

  if (isDesktop) {
    const detail = selected ?? list[0] ?? null;
    return (
      <Screen title={t('mySeva.title')} maxWidth={1240} refreshing={assignments.isRefetching} onRefresh={() => assignments.refetch()}>
        <Row gap={28} style={{ alignItems: 'flex-start', paddingTop: 8 }}>
          {listView}
          <View style={{ flex: 1.3 }}>
            {detail ? (
              <Card style={{ padding: 24, gap: 20 }}>
                <AssignmentDetail a={detail} inlineReport onReport={() => undefined} />
              </Card>
            ) : (
              <EmptyState title={t('mySeva.selectHint')} />
            )}
          </View>
        </Row>
      </Screen>
    );
  }

  return (
    <Screen title={t('mySeva.title')} refreshing={assignments.isRefetching} onRefresh={() => assignments.refetch()}>
      {listView}
    </Screen>
  );
}

function AssignmentCard({ a, selected, onPress }: { a: AssignmentWithTask; selected?: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const text = useTaskText();
  const task = a.seva_tasks;
  const { verified, pending } = assignmentProgress(a);
  const b = progressBreakdown(a.claimed_qty, verified, pending);
  const start = taskStart(task);
  const due = taskEnd(task);
  const unit = task.unit ?? '';
  const next =
    a.status === 'completed'
      ? task.type === 'role'
        ? t('mySeva.roleConfirmed')
        : t('mySeva.nextDone')
      : task.type === 'quantity'
        ? b.toGo > 0
          ? t('mySeva.nextReport')
          : t('mySeva.nextWaiting')
        : start
          ? t('mySeva.nextArrive', { time: formatTime(new Date(new Date(start).getTime() - 15 * 60_000).toISOString()) })
          : null;

  return (
    <Card onPress={onPress} accessibilityLabel={task.title} style={selected ? { borderColor: colors.purple, borderWidth: 2, padding: 15 } : undefined}>
      <Row gap={6} wrap>
        <Badge label={text.mode(task)} tone="purple" />
        <Badge label={task.type === 'quantity' ? t('seva.quantityBased') : t('seva.roleBased')} tone="neutral" />
        {task.type === 'quantity' && due && a.status === 'active' ? (
          <Badge label={t('mySeva.due', { date: formatDay(due) })} tone="amber" />
        ) : start ? (
          <Badge label={formatDay(start)} tone="amber" />
        ) : null}
        {a.status === 'completed' ? <Badge label={t('mySeva.approved')} tone="success" icon="check" /> : null}
      </Row>
      <View style={{ gap: 2 }}>
        <Text variant="title">{task.title}</Text>
        <Text variant="caption">{task.events.title}</Text>
      </View>
      {task.type === 'quantity' ? (
        <>
          <ImpactBar
            verified={b.verified}
            pending={b.pending}
            total={a.claimed_qty}
            label={t('mySeva.progressLine', { ...b, total: a.claimed_qty, unit })}
          />
          <Text variant="caption" color={colors.text}>{t('mySeva.progressLine', { ...b, total: a.claimed_qty, unit })}</Text>
        </>
      ) : start ? (
        <Text variant="caption">
          {text.whenRange(task)}
          {task.events.venue_name ? ` · ${task.events.venue_name}` : ''}
        </Text>
      ) : null}
      {next ? (
        <Row gap={6}>
          <Icon name={a.status === 'completed' ? 'check' : 'chevronRight'} size={14} color={colors.purple} />
          <Text variant="caption" weight="semibold" color={colors.purpleDark}>{next}</Text>
        </Row>
      ) : null}
    </Card>
  );
}

function AssignmentDetail({ a, onReport, inlineReport }: { a: AssignmentWithTask; onReport: () => void; inlineReport: boolean }) {
  const { t } = useTranslation();
  const text = useTaskText();
  const task = a.seva_tasks;
  const unit = task.unit ?? '';
  const { verified, pending } = assignmentProgress(a);
  const b = progressBreakdown(a.claimed_qty, verified, pending);
  const canReport = task.type === 'quantity' && a.status === 'active' && reportable(a.claimed_qty, verified, pending) > 0;
  const names = usePublicNames([task.events.created_by, ...(a.progress_reports ?? []).map((r) => r.reviewed_by)]);
  const start = taskStart(task);
  const due = taskEnd(task);

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 4 }}>
        <Text variant="h2">{task.title}</Text>
        <Text variant="caption">
          {task.events.title} · {task.events.organizations?.name}
        </Text>
      </View>

      <View style={styles.facts}>
        <Fact label={t('mySeva.organizer')} value={names.data?.[task.events.created_by ?? ''] || task.events.organizations?.name || '—'} />
        <Fact
          label={task.type === 'quantity' ? t('mySeva.deadline') : t('details.dateTime')}
          value={task.type === 'quantity' ? (due ? formatWhen(due) : '—') : text.whenRange(task)}
        />
        <Fact label={t('mySeva.mode')} value={text.mode(task)} />
        {task.type === 'quantity' ? <Fact label={t('mySeva.assigned')} value={`${a.claimed_qty} ${unit}`} /> : null}
      </View>

      {task.type === 'quantity' ? (
        <View style={{ gap: 10 }}>
          <Text variant="h3">{t('mySeva.yourProgress')}</Text>
          <Row gap={10}>
            <Counter n={b.verified} label={t('mySeva.verified')} color={colors.purpleDark} bg={colors.purpleTint} />
            <Counter n={b.pending} label={t('mySeva.awaiting')} color={colors.amberTextDark} bg={colors.amberTint} />
            <Counter n={b.toGo} label={t('mySeva.toGo')} color={colors.subtle} bg={colors.sandSoft} />
          </Row>
          <ImpactBar verified={b.verified} pending={b.pending} total={a.claimed_qty} label={t('mySeva.progressLine', { ...b, total: a.claimed_qty, unit })} />
          <Text variant="caption">{t('mySeva.onlyVerified', { unit })}</Text>
        </View>
      ) : a.status === 'completed' ? (
        <Row gap={8}>
          <Icon name="check" size={18} color={colors.success} />
          <Text variant="label" color={colors.success}>{t('mySeva.roleConfirmed')}</Text>
        </Row>
      ) : null}

      {canReport ? (
        inlineReport ? (
          <Card style={{ backgroundColor: colors.cream, gap: 14 }}>
            <Text variant="h3">{t('mySeva.reportTitle')}</Text>
            <ReportForm a={a} />
          </Card>
        ) : (
          <Button title={t('mySeva.reportTitle')} size="lg" onPress={onReport} />
        )
      ) : null}

      <History a={a} names={names.data ?? {}} />

      {task.type === 'quantity' ? (
        <Card style={{ gap: 6, backgroundColor: colors.cream }}>
          <Text variant="label">{t('mySeva.wholeTask', { total: task.target_qty, unit })}</Text>
          <Text variant="caption">{t('mySeva.wholeTaskLine', { volunteers: task.volunteers_count, unclaimed: remaining(task), unit })}</Text>
          <ImpactBar
            verified={task.verified_total}
            pending={task.pending_total}
            total={task.target_qty ?? 0}
            label={t('mySeva.wholeTaskProgress', {
              verified: task.verified_total,
              pending: task.pending_total,
              remaining: Math.max((task.target_qty ?? 0) - task.verified_total - task.pending_total, 0),
            })}
          />
          <Text variant="caption">
            {t('mySeva.wholeTaskProgress', {
              verified: task.verified_total,
              pending: task.pending_total,
              remaining: Math.max((task.target_qty ?? 0) - task.verified_total - task.pending_total, 0),
            })}
          </Text>
        </Card>
      ) : null}

      <Actions a={a} start={start} />
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 140, flexGrow: 1, flexBasis: '45%', gap: 2 }}>
      <Text variant="small" color={colors.muted}>{label}</Text>
      <Text variant="bodySm" weight="medium">{value}</Text>
    </View>
  );
}

function Counter({ n, label, color, bg }: { n: number; label: string; color: string; bg: string }) {
  return (
    <View style={{ flex: 1, padding: 12, borderRadius: radius.control, backgroundColor: bg, gap: 2 }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 26, lineHeight: 32, color }}>{n}</Text>
      <Text variant="small" color={color}>{label}</Text>
    </View>
  );
}

function ReportForm({ a, onDone }: { a: AssignmentWithTask; onDone?: () => void }) {
  const { t } = useTranslation();
  const task = a.seva_tasks;
  const unit = task.unit ?? '';
  const { verified, pending } = assignmentProgress(a);
  const max = reportable(a.claimed_qty, verified, pending);
  const [qty, setQty] = useState(Math.min(1, max));
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = useSubmitProgress();

  if (max <= 0) return <Text variant="caption">{t('mySeva.nothingToReport')}</Text>;

  const send = async () => {
    setMsg(null);
    try {
      await submit.mutateAsync({ assignmentId: a.id, qty, note });
      setNote('');
      setQty(1);
      setMsg({ ok: true, text: t('mySeva.submitted') });
      onDone?.();
    } catch (e) {
      setMsg({ ok: false, text: t(progressErrorKey(e)) });
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 8 }}>
        <Text variant="label">{t('mySeva.completedSince', { unit: unit.charAt(0).toUpperCase() + unit.slice(1) })}</Text>
        <Row gap={12}>
          <Stepper value={qty} onChange={setQty} max={max} label={unit} size="lg" />
        </Row>
        <Text variant="caption">
          {qty >= max ? t('mySeva.maxReached', { total: a.claimed_qty, unit }) : t('mySeva.canReport', { count: max, total: a.claimed_qty })}
        </Text>
      </View>
      <TextField label={t('mySeva.note')} optional value={note} onChangeText={setNote} multiline maxLength={500} hint={t('mySeva.noteHint')} />
      <Button title={t('mySeva.submit')} size="lg" loading={submit.isPending} onPress={send} />
      {msg ? (
        <Text variant="caption" color={msg.ok ? colors.purpleDark : colors.danger} accessibilityLiveRegion="polite">
          {msg.text}
        </Text>
      ) : null}
    </View>
  );
}

function ReportSheet({ a, visible, onClose }: { a: AssignmentWithTask; visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { verified, pending } = assignmentProgress(a);
  const b = progressBreakdown(a.claimed_qty, verified, pending);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel={t('common.close')} style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grabber} />
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text variant="h2">{t('mySeva.reportTitle')}</Text>
            <Text variant="caption">{a.seva_tasks.title}</Text>
          </View>
          <IconButton icon="x" label={t('common.close')} onPress={onClose} />
        </Row>
        <Row gap={10}>
          <Counter n={b.verified} label={t('mySeva.verified')} color={colors.purpleDark} bg={colors.purpleTint} />
          <Counter n={b.pending} label={t('mySeva.inReview')} color={colors.amberTextDark} bg={colors.amberTint} />
          <Counter n={b.toGo} label={t('mySeva.toGo')} color={colors.subtle} bg={colors.sandSoft} />
        </Row>
        <ScrollView keyboardShouldPersistTaps="handled">
          <ReportForm a={a} onDone={() => setTimeout(onClose, 900)} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function History({ a, names }: { a: AssignmentWithTask; names: Record<string, string> }) {
  const { t } = useTranslation();
  const task = a.seva_tasks;
  const unit = task.unit ?? '';
  const reports = [...(a.progress_reports ?? [])].sort((x, y) => y.created_at.localeCompare(x.created_at));
  return (
    <View style={{ gap: 12 }}>
      <Text variant="h3">{t('mySeva.history')}</Text>
      {reports.map((r) => {
        const adjusted = r.status === 'approved' && (r.verified_qty ?? 0) < r.reported_qty;
        const reviewer = names[r.reviewed_by ?? ''] || task.events.organizations?.name || '';
        return (
          <View key={r.id} style={styles.historyItem}>
            <View style={[styles.dot, { backgroundColor: r.status === 'pending' ? colors.amber : r.status === 'rejected' ? colors.danger : colors.purple }]} />
            <View style={{ flex: 1, gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }} wrap>
                <Text variant="label">{t('mySeva.youReported', { count: r.reported_qty, unit })}</Text>
                <Badge
                  label={
                    r.status === 'pending'
                      ? t('mySeva.pending')
                      : r.status === 'rejected'
                        ? t('mySeva.rejected')
                        : adjusted
                          ? t('mySeva.adjusted', { count: r.verified_qty })
                          : t('mySeva.approved')
                  }
                  tone={r.status === 'pending' ? 'amber' : r.status === 'rejected' ? 'danger' : adjusted ? 'neutral' : 'success'}
                />
              </Row>
              <Text variant="caption">{formatDateTime(r.created_at)}</Text>
              {r.note ? <Text variant="bodySm" color={colors.body}>“{r.note}”</Text> : null}
              {adjusted && r.reviewed_at ? (
                <Text variant="caption" color={colors.subtle}>
                  {t('mySeva.adjustedBy', { name: reviewer, from: r.reported_qty, to: r.verified_qty, date: formatDateTime(r.reviewed_at), reason: r.review_reason ?? '' })}
                </Text>
              ) : null}
              {r.status === 'rejected' && r.reviewed_at ? (
                <Text variant="caption" color={colors.danger}>
                  {t('mySeva.rejectedBy', { name: reviewer, date: formatDateTime(r.reviewed_at), reason: r.review_reason ?? '' })}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
      <View style={styles.historyItem}>
        <View style={[styles.dot, { backgroundColor: colors.border }]} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">
            {task.type === 'quantity' ? t('mySeva.joinedEvent', { count: a.claimed_qty, unit }) : t('mySeva.joinedRole')}
          </Text>
          <Text variant="caption">{formatDateTime(a.joined_at)}</Text>
        </View>
      </View>
    </View>
  );
}

function Actions({ a, start }: { a: AssignmentWithTask; start: string | null }) {
  const { t } = useTranslation();
  const task = a.seva_tasks;
  const unit = task.unit ?? '';
  const leave = useLeaveTask();
  const update = useUpdateClaim();
  const [editing, setEditing] = useState(false);
  const { verified, pending } = assignmentProgress(a);
  const floor = Math.max(verified + pending, 1);
  const ceiling = Math.min(task.max_per_volunteer ?? Number.POSITIVE_INFINITY, remaining(task) + a.claimed_qty);
  const [qty, setQty] = useState(a.claimed_qty);
  const [msg, setMsg] = useState<string | null>(null);
  const { ask, dialog } = useConfirm();

  if (a.status !== 'active') {
    return <Button title={t('mySeva.viewSeva')} variant="outline" onPress={() => router.push(`/seva/${task.id}`)} />;
  }

  const confirmLeave = () => {
    if (pending > 0) {
      return ask({ title: t('mySeva.leave'), body: t('mySeva.leaveBlocked'), confirmLabel: t('common.ok'), hideCancel: true, onConfirm: () => {} });
    }
    ask({
      title: t('mySeva.leave'),
      body: t('mySeva.leaveConfirm'),
      confirmLabel: t('mySeva.leave'),
      destructive: true,
      onConfirm: async () => {
        try {
          await leave.mutateAsync(a.id);
        } catch (e) {
          throw new Error(errorCode(e) === 'reports_pending' ? t('mySeva.leaveBlocked') : t('mySeva.errors.generic'));
        }
      },
    });
  };

  const saveQty = async () => {
    setMsg(null);
    try {
      const res = await update.mutateAsync({ assignmentId: a.id, qty });
      if (res.status === 'capacity_changed') {
        setQty(res.available);
        setMsg(t('join.capacityTitle', { count: res.available, unit }));
      } else setEditing(false);
    } catch (e) {
      setMsg(t(progressErrorKey(e)));
    }
  };

  return (
    <View style={{ gap: 10 }}>
      {dialog}
      <Divider color={colors.cardBorder} />
      {task.type === 'quantity' && editing ? (
        <View style={{ gap: 10 }}>
          <Text variant="label">{t('mySeva.changeQty')}</Text>
          <Row gap={10}>
            <Stepper value={qty} onChange={setQty} min={floor} max={Math.max(ceiling, floor)} label={unit} />
            <Button title={t('mySeva.saveQty', { count: qty, unit })} style={{ flex: 1 }} loading={update.isPending} onPress={saveQty} disabled={qty === a.claimed_qty} />
          </Row>
          {msg ? <Text variant="caption" color={colors.danger}>{msg}</Text> : null}
        </View>
      ) : null}
      <Row gap={10} wrap>
        <Button title={t('mySeva.viewSeva')} variant="outline" onPress={() => router.push(`/seva/${task.id}`)} />
        {start ? (
          <Button
            title={t('join.addToCalendar')}
            icon="calendar"
            variant="outline"
            onPress={() => addToCalendar({ title: task.title, start, end: taskEnd(task), location: task.mode === 'virtual' ? null : task.events.address, notes: task.events.title })}
          />
        ) : null}
        {task.type === 'quantity' && !editing ? <Button title={t('mySeva.changeQty')} variant="outline" onPress={() => setEditing(true)} /> : null}
      </Row>
      <Pressable accessibilityRole="button" onPress={confirmLeave} style={{ alignSelf: 'flex-start', paddingVertical: 8 }}>
        <Text variant="label" color={colors.danger}>{t('mySeva.leave')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, padding: 14, borderRadius: radius.control, backgroundColor: colors.cream },
  historyItem: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 999, marginTop: 6 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(34,34,34,0.35)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: 20,
    gap: 16,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 999, backgroundColor: colors.border },
});
