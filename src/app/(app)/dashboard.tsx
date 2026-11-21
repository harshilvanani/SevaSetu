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
import { useAuth } from '@/features/auth/AuthProvider';
import { useOrgInsights } from '@/features/insights/api';
import { StatTile } from '@/features/insights/charts';
import { useLabels } from '@/features/insights/labels';
import { AlertList, DataHealth, MomentumChart, Panel, RegionalCoverage, UpcomingList } from '@/features/insights/sections';
import { type OrgEvent, useOrgEvents, useProfileNames, useReviewQueue } from '@/features/org/api';
import { OrganizerGate, OrgSwitcher, useStaffingText } from '@/features/org/components';
import { ReviewCard } from '@/features/org/ReviewCard';
import { firstName } from '@/lib/format';
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
  const { profile } = useAuth();
  const L = useLabels();
  const events = useOrgEvents(orgId);
  const queue = useReviewQueue(orgId);
  const insights = useOrgInsights(orgId);
  const staffing = useStaffingText();
  const [now] = useState(() => Date.now());

  const all = events.data ?? [];
  const live = all.filter((e) => e.status === 'published' && new Date(e.ends_at).getTime() >= now);
  const drafts = all.filter((e) => e.status === 'draft');
  const liveTasks = live.flatMap((e) => e.seva_tasks.map((task) => ({ ...task, event: e })));
  const openTasks = liveTasks.filter((x) => x.status === 'open' && remaining(x) > 0);
  const startOf = (x: (typeof liveTasks)[number]) => x.starts_at ?? x.event.starts_at;
  const needThisWeek = openTasks.filter((x) => new Date(startOf(x)).getTime() - now < 7 * DAY).length;
  const names = useProfileNames((queue.data ?? []).map((r) => r.assignments.volunteer_id));
  const data = insights.data;
  const k = data?.kpis;

  const today = new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  const firstEvent = live[0] ?? drafts[0];

  const actions: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'plus', label: t('org.createEvent'), onPress: () => router.push('/events/new') },
    ...(firstEvent ? [{ icon: 'clipboard' as IconName, label: t('org.addTask'), onPress: () => router.push({ pathname: '/events/[id]/task', params: { id: firstEvent.id } }) }] : []),
    { icon: 'check', label: t('org.reviewProgress'), onPress: () => router.navigate('/reviews') },
    ...(isDesktop
      ? []
      : [
          { icon: 'users' as IconName, label: t('nav.volunteers'), onPress: () => router.navigate('/volunteers') },
          { icon: 'layers' as IconName, label: t('nav.teams'), onPress: () => router.navigate('/teams') },
          { icon: 'globe' as IconName, label: t('nav.regions'), onPress: () => router.navigate('/regions') },
          { icon: 'chart' as IconName, label: t('nav.impact'), onPress: () => router.navigate('/impact') },
          { icon: 'heart' as IconName, label: t('nav.donations'), onPress: () => router.navigate('/donations') },
        ]),
  ];
  const twoCol = isDesktop ? { flexDirection: 'row' as const, alignItems: 'flex-start' as const } : undefined;

  return (
    <Screen
      title={t('org.dashboard')}
      maxWidth={1240}
      refreshing={events.isRefetching || insights.isRefetching}
      onRefresh={() => { events.refetch(); queue.refetch(); insights.refetch(); }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 8 }} wrap gap={12}>
        <View style={{ gap: 4, flexShrink: 1 }}>
          <Text variant="overline" color={colors.purple}>{orgName}</Text>
          <Text variant="h1">{t('org.dashboard')}</Text>
          <Text variant="caption">{t('org.todayLine', { date: today, count: needThisWeek })}</Text>
        </View>
        {isDesktop ? <Button title={t('org.createEvent')} icon="plus" onPress={() => router.push('/events/new')} /> : null}
      </Row>
      <OrgSwitcher />

      <View style={styles.hero}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text variant="overline" color="#CDB8E6">{t('insights.welcome', { name: firstName(profile?.full_name) })}</Text>
          <Text style={{ fontFamily: fonts.serif, fontSize: isPhone ? 22 : 26, lineHeight: isPhone ? 30 : 34, color: colors.white }}>{t('insights.heroTitle')}</Text>
          <Text variant="bodySm" color="#E9DFF5">{t('insights.heroBody')}</Text>
          <Row gap={8} wrap style={{ marginTop: 8 }}>
            <Pressable accessibilityRole="button" onPress={() => router.navigate({ pathname: '/events', params: { view: 'month' } })} style={styles.heroBtn}>
              <Icon name="calendar" size={16} color={colors.plum} />
              <Text variant="label" color={colors.plum}>{t('insights.viewCalendar')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.navigate('/impact')} style={[styles.heroBtn, styles.heroBtnGhost]}>
              <Text variant="label" color={colors.white}>{t('insights.viewImpact')}</Text>
            </Pressable>
          </Row>
        </View>
        {!isPhone ? (
          <View style={styles.heroCircle} accessible accessibilityLabel={t('insights.upcomingCount', { count: k?.upcoming_events ?? 0 })}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 36, lineHeight: 42, color: colors.white }}>{k?.upcoming_events ?? '–'}</Text>
            <Text variant="small" color="#E9DFF5" align="center">{t('insights.upcomingEvents')}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <StatTile icon="users" label={t('insights.activeVolunteers')} value={k ? L.num(k.active_volunteers) : '–'}
          sub={k ? t('insights.inDirectory', { count: k.volunteers }) : undefined} onPress={() => router.navigate('/volunteers')} />
        <StatTile icon="calendar" tone="green" label={t('insights.upcomingEvents')} value={k?.upcoming_events ?? '–'}
          sub={drafts.length ? t('org.activeEventsSub', { drafts: drafts.length }) : undefined} onPress={() => router.navigate('/events')} />
        <StatTile icon="clock" tone="orange" label={t('insights.sevaHours')} value={k ? L.num(Math.round(k.hours_total)) : '–'}
          sub={k && k.hours_month > 0 ? t('insights.thisMonth', { hours: L.num(Math.round(k.hours_month)) }) : undefined} onPress={() => router.navigate('/impact')} />
        <StatTile icon="globe" tone="plum" label={t('insights.activeRegions')} value={k?.active_regions ?? '–'}
          sub={k ? t('insights.teachersCount', { count: k.teachers }) : undefined} onPress={() => router.navigate('/regions')} />
      </View>

      <Row gap={8} wrap>
        {actions.map((a) => (
          <Pressable key={a.label} accessibilityRole="button" onPress={a.onPress} style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.track }]}>
            <Icon name={a.icon} size={18} color={colors.purpleDark} />
            <Text variant="label">{a.label}</Text>
          </Pressable>
        ))}
      </Row>

      {events.isPending ? null : all.length === 0 ? (
        <EmptyState title={t('org.noEvents')} body={t('org.noEventsBody')}>
          <Button title={t('org.createEvent')} icon="plus" onPress={() => router.push('/events/new')} />
        </EmptyState>
      ) : null}

      {data ? (
        <>
          <View style={[{ gap: 16 }, twoCol]}>
            <Panel title={t('insights.upcomingTitle')} sub={t('insights.upcomingSub')} action={t('insights.fullCalendar')}
              onAction={() => router.navigate({ pathname: '/events', params: { view: 'agenda' } })} style={{ flex: 2 }}>
              <UpcomingList rows={data.upcoming} />
            </Panel>
            <Panel title={t('insights.coverageTitle')} sub={t('insights.coverageSub')} action={t('insights.allRegions')}
              onAction={() => router.navigate('/regions')} style={{ flex: 1 }}>
              <RegionalCoverage data={data} />
            </Panel>
          </View>
          <View style={[{ gap: 16 }, twoCol]}>
            <Panel title={t('alerts.title')} sub={t('alerts.sub', { count: data.alerts.length })} style={{ flex: 1 }}>
              <AlertList alerts={data.alerts} />
            </Panel>
            <Panel title={t('dataHealth.title')} sub={t('dataHealth.sub')} action={t('nav.impact')} onAction={() => router.navigate('/impact')} style={{ flex: 1 }}>
              <DataHealth data={data} compact />
            </Panel>
          </View>
          <Panel title={t('insights.momentum')} sub={t('insights.momentumSub')} action={t('insights.impactReport')} onAction={() => router.navigate('/impact')}>
            <MomentumChart data={data} />
          </Panel>
        </>
      ) : insights.isPending ? (
        <Text variant="caption">{t('common.loading')}</Text>
      ) : null}

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
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    padding: 24,
    borderRadius: 20,
    backgroundColor: colors.plum,
  },
  heroBtn: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 10, backgroundColor: colors.white },
  heroBtnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  heroCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 10,
  },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  th: { borderTopWidth: 0, paddingVertical: 10, backgroundColor: colors.cream, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
});
