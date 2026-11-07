import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Badge, Chip } from '@/components/Chip';
import { Icon, type IconName } from '@/components/Icon';
import { Card, EmptyState, Row, Screen, SectionHeader, useLayout } from '@/components/Layout';
import { Text } from '@/components/Text';
import { remaining } from '@/domain/seva';
import { type OrgEvent, useOrgEvents, useProfileNames, useReviewQueue, useTaskAssignments } from '@/features/org/api';
import { MetricCard, OrganizerGate, OrgSwitcher, useStaffingText } from '@/features/org/components';
import { EventsTable } from '@/features/org/EventsTable';
import { ReviewCard } from '@/features/org/ReviewCard';
import { dayTile, formatDay } from '@/lib/format';
import { intlLocale } from '@/lib/i18n';
import type { Tables } from '@/lib/supabase';
import { colors, fonts, radius } from '@/theme/tokens';

export default function DashboardScreen() {
  return <OrganizerGate>{(org) => <Dashboard orgId={org.id} orgName={org.name} />}</OrganizerGate>;
}

const DAY = 86_400_000;

function Dashboard({ orgId, orgName }: { orgId: string; orgName: string }) {
  const { t } = useTranslation();
  const { isDesktop, isPhone } = useLayout();
  const events = useOrgEvents(orgId);
  const queue = useReviewQueue(orgId);
  const staffing = useStaffingText();
  const [now] = useState(() => Date.now());

  const all = events.data ?? [];
  const live = all.filter((e) => e.status === 'published' && new Date(e.ends_at).getTime() >= now);
  const drafts = all.filter((e) => e.status === 'draft');
  const liveTasks = live.flatMap((e) => e.seva_tasks.map((task) => ({ ...task, event: e })));
  const assignments = useTaskAssignments(liveTasks.map((x) => x.id));
  const activeVolunteers = new Set((assignments.data ?? []).filter((a) => a.status === 'active').map((a) => a.volunteer_id)).size;
  const openTasks = liveTasks.filter((x) => x.status === 'open' && remaining(x) > 0);
  const openPositions = openTasks.reduce((n, x) => n + remaining(x), 0);
  const startOf = (x: (typeof liveTasks)[number]) => x.starts_at ?? x.event.starts_at;
  const needThisWeek = openTasks.filter((x) => new Date(startOf(x)).getTime() - now < 7 * DAY).length;
  const oldest = queue.data?.[0];
  const names = useProfileNames((queue.data ?? []).map((r) => r.assignments.volunteer_id));

  // Upcoming deadlines (next 14 days)
  type Deadline = { at: string; title: string; detail: string; tone: 'amber' | 'purple' };
  const deadlines: Deadline[] = [];
  for (const x of liveTasks) {
    const left = remaining(x);
    if (x.type === 'role' && left > 0) {
      deadlines.push({ at: startOf(x), title: x.title, detail: t('org.deadlineOpen', { count: left }), tone: 'amber' });
    }
    if (x.type === 'quantity') {
      const due = x.signup_deadline ?? x.ends_at ?? x.event.ends_at;
      const unverified = (x.target_qty ?? 0) - x.verified_total;
      if (left > 0 && x.signup_deadline) deadlines.push({ at: x.signup_deadline, title: x.title, detail: t('org.signupsClose', { left: `${left} ${x.unit}` }), tone: 'amber' });
      else if (unverified > 0) deadlines.push({ at: due, title: x.title, detail: t('org.deadlineUnverified', { count: unverified, unit: x.unit }), tone: 'purple' });
    }
  }
  const upcoming = deadlines
    .filter((d) => {
      const ms = new Date(d.at).getTime() - now;
      return ms > -DAY && ms < 14 * DAY;
    })
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 5);

  const today = new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  const firstEvent = live[0] ?? drafts[0];

  const actions: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'plus', label: t('org.createEvent'), onPress: () => router.push('/events/new') },
    ...(firstEvent ? [{ icon: 'clipboard' as IconName, label: t('org.addTask'), onPress: () => router.push({ pathname: '/events/[id]/task', params: { id: firstEvent.id } }) }] : []),
    { icon: 'check', label: t('org.reviewProgress'), onPress: () => router.navigate('/reviews') },
  ];

  return (
    <Screen maxWidth={1240} refreshing={events.isRefetching} onRefresh={() => { events.refetch(); queue.refetch(); assignments.refetch(); }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 8 }} wrap gap={12}>
        <View style={{ gap: 4, flexShrink: 1 }}>
          <Text variant="overline" color={colors.purple}>{orgName}</Text>
          <Text variant="h1">{t('org.dashboard')}</Text>
          <Text variant="caption">{t('org.todayLine', { date: today, count: needThisWeek })}</Text>
        </View>
        {isDesktop ? <Button title={t('org.createEvent')} icon="plus" onPress={() => router.push('/events/new')} /> : null}
      </Row>
      <OrgSwitcher />

      <Row gap={8} wrap>
        {actions.map((a) => (
          <Pressable key={a.label} accessibilityRole="button" onPress={a.onPress} style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.track }]}>
            <Icon name={a.icon} size={18} color={colors.purpleDark} />
            <Text variant="label">{a.label}</Text>
          </Pressable>
        ))}
      </Row>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <MetricCard label={t('org.activeEvents')} value={live.length} sub={drafts.length ? `+ ${t('org.activeEventsSub', { drafts: drafts.length })}` : undefined} />
        <MetricCard label={t('org.activeVolunteers')} value={activeVolunteers} sub={t('org.activeVolunteersSub', { count: live.length })} />
        <MetricCard label={t('org.openPositions')} value={openPositions} sub={t('org.openPositionsSub', { count: openTasks.length })} />
        <MetricCard
          label={t('org.awaitingReview')}
          value={queue.data?.length ?? 0}
          action={queue.data?.length ? t('org.reviewNow') : undefined}
          onAction={() => router.navigate('/reviews')}
          sub={oldest ? formatDay(oldest.created_at) : undefined}
        />
      </View>

      {events.isPending ? null : all.length === 0 ? (
        <EmptyState title={t('org.noEvents')} body={t('org.noEventsBody')}>
          <Button title={t('org.createEvent')} icon="plus" onPress={() => router.push('/events/new')} />
        </EmptyState>
      ) : (
        <View style={[{ gap: 20 }, isDesktop && { flexDirection: 'row', alignItems: 'flex-start' }]}>
          <View style={{ flex: 2, gap: 12 }}>
            <SectionHeader title={t('org.events')} action={t('org.allEvents')} onAction={() => router.navigate('/events')} />
            <EventsTable events={all.filter((e) => e.status !== 'cancelled').slice(0, 5)} compact={isPhone} />
          </View>
          <View style={{ flex: 1, gap: 12 }}>
            <SectionHeader title={t('org.deadlines')} />
            <Card style={{ gap: 12 }}>
              {upcoming.length === 0 ? <Text variant="caption">{t('org.noDeadlines')}</Text> : null}
              {upcoming.map((d, i) => {
                const tile = dayTile(d.at);
                return (
                  <Row key={i} gap={12}>
                    <View style={[styles.tile, { backgroundColor: d.tone === 'amber' ? colors.amberTint : colors.purpleTint }]}>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 10, lineHeight: 12, color: d.tone === 'amber' ? colors.orangeText : colors.purpleDark }}>{tile.dow}</Text>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20 }}>{tile.day}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="label" numberOfLines={1}>{d.title}</Text>
                      <Text variant="caption">{d.detail}</Text>
                    </View>
                  </Row>
                );
              })}
            </Card>
          </View>
        </View>
      )}

      {liveTasks.length ? <TasksTable events={live} staffing={staffing} compact={isPhone} /> : null}

      {queue.data?.length ? (
        <View style={{ gap: 12 }}>
          <SectionHeader title={`${t('org.reviewsTitle')} · ${queue.data.length}`} action={t('common.seeAll')} onAction={() => router.navigate('/reviews')} />
          <View style={[{ gap: 12 }, isDesktop && { flexDirection: 'row', flexWrap: 'wrap' }]}>
            {queue.data.slice(0, 3).map((r) => (
              <View key={r.id} style={isDesktop ? { flexBasis: '31%', flexGrow: 1 } : undefined}>
                <ReviewCard item={r} name={names.data?.[r.assignments.volunteer_id] ?? '—'} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function TasksTable({ events, staffing, compact }: { events: OrgEvent[]; staffing: ReturnType<typeof useStaffingText>; compact: boolean }) {
  const { t } = useTranslation();
  const [eventId, setEventId] = useState(events[0]?.id);
  const event = events.find((e) => e.id === eventId) ?? events[0];
  const tasks = event?.seva_tasks ?? [];
  const meta = (x: Tables<'seva_tasks'>) =>
    [x.type === 'quantity' ? `${t('seva.quantityBased')} · ${x.target_qty} ${x.unit}` : t('seva.roleBased'), t(`availability.modes.${x.mode}`)].join(' · ');

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <SectionHeader title={t('org.tasks')} />
        <Text variant="caption">{t('org.tasksNote')}</Text>
      </View>
      {events.length > 1 ? (
        <Row gap={8} wrap>
          {events.map((e) => (
            <Chip key={e.id} size="sm" label={e.title} selected={e.id === event?.id} onPress={() => setEventId(e.id)} />
          ))}
        </Row>
      ) : null}
      {compact ? (
        tasks.map((x) => {
          const s = staffing(x);
          return (
            <Card key={x.id} onPress={() => router.push({ pathname: '/events/[id]/task', params: { id: x.event_id, taskId: x.id } })}>
              <Text variant="title">{x.title}</Text>
              <Text variant="caption">{meta(x)}</Text>
              <Text variant="caption" color={colors.text}>{s.capacity} · {s.progress}</Text>
              <Badge label={s.staffing} tone={s.tone} />
            </Card>
          );
        })
      ) : (
        <Card style={{ padding: 0, gap: 0 }}>
          <View style={[styles.tr, styles.th]}>
            <Text variant="small" color={colors.muted} style={{ flex: 2.4 }}>{t('org.task')}</Text>
            <Text variant="small" color={colors.muted} style={{ flex: 1.4 }}>{t('org.capacity')}</Text>
            <Text variant="small" color={colors.muted} style={{ flex: 1.4 }}>{t('org.verifiedProgress')}</Text>
            <Text variant="small" color={colors.muted} style={{ flex: 1.2 }}>{t('org.staffing')}</Text>
          </View>
          {tasks.map((x) => {
            const s = staffing(x);
            return (
              <Pressable
                key={x.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/events/[id]/task', params: { id: x.event_id, taskId: x.id } })}
                style={({ pressed }) => [styles.tr, pressed && { backgroundColor: colors.cream }]}>
                <View style={{ flex: 2.4 }}>
                  <Text variant="label">{x.title}</Text>
                  <Text variant="caption">{meta(x)}</Text>
                </View>
                <Text variant="bodySm" style={{ flex: 1.4 }}>{s.capacity}</Text>
                <Text variant="bodySm" style={{ flex: 1.4 }}>{s.progress}</Text>
                <View style={{ flex: 1.2 }}>
                  <Badge label={s.staffing} tone={s.tone} />
                </View>
              </Pressable>
            );
          })}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  tile: { width: 42, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  th: { borderTopWidth: 0, paddingVertical: 10, backgroundColor: colors.cream, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
});
