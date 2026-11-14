import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Share, StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/Button';
import { Badge } from '@/components/Chip';
import { Icon, type IconName } from '@/components/Icon';
import { Avatar, Card, Divider, EmptyState, Row, Screen, TopBar, useLayout } from '@/components/Layout';
import { ProgressBar } from '@/components/ProgressBar';
import { Stepper } from '@/components/Stepper';
import { Text } from '@/components/Text';
import { capacity, claimedFraction, joinState, maxClaim, remaining } from '@/domain/seva';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  type TaskWithEvent,
  taskDistance,
  taskEnd,
  taskStart,
  useDiscoverTasks,
  useMyAssignments,
  useMyInvitations,
  useTask,
} from '@/features/seva/api';
import { SevaRow, useTaskText } from '@/features/seva/components';
import { joinErrorKey, useDeclineInvitation, useJoinTask } from '@/features/seva/join';
import { formatDay, formatDayYear, formatRange, formatWhen } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, fonts, radius } from '@/theme/tokens';

export default function SevaDetailsScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDesktop } = useLayout();
  const task = useTask(id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/discover'));

  const share = async () => {
    if (!task.data) return;
    const url = Linking.createURL(`/seva/${id}`);
    try {
      await Share.share({ message: `${task.data.title} — ${url}`, url, title: task.data.title });
    } catch {
      // Sharing unsupported (some desktop browsers).
    }
  };

  const header = (
    <TopBar
      onBack={back}
      title={isDesktop ? undefined : task.data?.events.title}
      right={task.data ? <IconButton icon="share" label={t('details.share')} onPress={share} /> : null}
    />
  );

  if (task.isPending) {
    return (
      <Screen header={header}>
        <Text variant="caption">{t('common.loading')}</Text>
      </Screen>
    );
  }
  if (!task.data) {
    return (
      <Screen header={header} maxWidth={560}>
        <EmptyState title={t('details.notFound')} body={t('details.notFoundBody')}>
          <Button title={t('nav.discover')} variant="outline" onPress={() => router.replace('/discover')} />
        </EmptyState>
      </Screen>
    );
  }
  return <Details task={task.data} header={header} />;
}

function Details({ task, header }: { task: TaskWithEvent; header: ReactNode }) {
  const { t } = useTranslation();
  const { isDesktop } = useLayout();
  const { profile } = useAuth();
  const text = useTaskText();
  const discover = useDiscoverTasks();
  const assignments = useMyAssignments();
  const mine = assignments.data?.find((a) => a.task_id === task.id && a.status !== 'cancelled');

  const organizer = useQuery({
    queryKey: ['public-profile', task.events.created_by],
    enabled: !!task.events.created_by,
    queryFn: async () => {
      const { data } = await supabase.from('public_profiles').select('full_name').eq('id', task.events.created_by!).maybeSingle();
      return data?.full_name ?? null;
    },
  });
  // Visible only to org members and volunteers who joined (RLS).
  const privateDetails = useQuery({
    queryKey: ['event-private', task.event_id, !!mine],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase.from('event_private_details').select('*').eq('event_id', task.event_id).maybeSingle();
      return data;
    },
  });

  const siblings = (discover.data ?? []).filter((x) => x.event_id === task.event_id && x.id !== task.id);
  const km = taskDistance(task, profile ? { latitude: profile.latitude, longitude: profile.longitude } : null);
  const start = taskStart(task);
  const end = taskEnd(task);
  const orgName = task.events.organizations?.name ?? '';

  const content = (
    <View style={{ gap: 20, flex: 1 }}>
      <Row gap={6} wrap>
        <Badge label={text.mode(task)} tone="purple" />
        <Badge label={task.visibility === 'private' ? t('seva.private') : t('seva.public')} tone={task.visibility === 'private' ? 'amber' : 'neutral'} icon={task.visibility === 'private' ? 'lock' : undefined} />
        <Badge label={task.type === 'quantity' ? t('seva.quantityBased') : t('seva.roleBased')} tone="neutral" />
        {text.category(task) ? <Badge label={text.category(task)!} tone="neutral" /> : null}
      </Row>
      <View style={{ gap: 12 }}>
        <Text variant={isDesktop ? 'display' : 'h1'}>{task.title}</Text>
        <Row gap={10}>
          <Avatar name={orgName} size={36} color={colors.purpleTint} />
          <View style={{ flex: 1 }}>
            <Text variant="label">{orgName}</Text>
            <Text variant="caption">
              {t('details.partOf', { event: task.events.title })}
              {organizer.data ? ` · ${t('details.organizedBy', { org: organizer.data })}` : ''}
            </Text>
          </View>
        </Row>
      </View>

      {!isDesktop ? (
        <Card style={{ gap: 8 }}>
          <Text variant="title">{text.capacityLine(task)}</Text>
          <ProgressBar value={claimedFraction(task)} />
          <Text variant="caption">
            {t('details.volunteersJoined', { count: task.volunteers_count })}
            {task.type === 'quantity' && task.max_per_volunteer ? ` · ${t('details.upToEach', { max: task.max_per_volunteer, unit: task.unit })}` : ''}
          </Text>
        </Card>
      ) : null}

      <View style={{ gap: 14 }}>
        <InfoRow icon="calendar" title={t('details.dateTime')}>
          {start ? (
            <>
              <Text variant="bodySm" weight="medium">{formatDayYear(start)}</Text>
              <Text variant="caption">
                {formatRange(start, end)}
                {task.signup_deadline ? ` · ${t('details.signupBy', { date: formatWhen(task.signup_deadline) })}` : ''}
              </Text>
            </>
          ) : (
            <Text variant="bodySm" weight="medium">{text.when(task)}</Text>
          )}
        </InfoRow>
        {task.mode !== 'virtual' && task.events.address ? (
          <InfoRow icon="mapPin" title={t('details.venue')}>
            <Text variant="bodySm" weight="medium">{task.events.venue_name ?? task.events.address}</Text>
            <Text variant="caption">
              {task.events.address}
              {km != null ? ` · ${t('seva.kmAway', { km: km.toFixed(1) })}` : ''}
              {' · '}
              <Text
                variant="caption"
                weight="semibold"
                color={colors.purple}
                accessibilityRole="link"
                onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.events.address!)}`)}>
                {t('details.directions')}
              </Text>
            </Text>
          </InfoRow>
        ) : null}
        <InfoRow icon={task.type === 'quantity' ? 'clipboard' : 'users'} title={task.type === 'quantity' ? t('details.target') : t('details.positions')}>
          <Text variant="bodySm" weight="medium">
            {task.type === 'quantity'
              ? task.max_per_volunteer
                ? t('details.targetValue', { total: task.target_qty, unit: task.unit, max: task.max_per_volunteer })
                : t('details.targetValueNoMax', { total: task.target_qty, unit: task.unit })
              : t('details.positionsValue', { total: task.positions })}
          </Text>
          <Text variant="caption">{t('details.claimHint')}</Text>
        </InfoRow>
      </View>

      {task.description ? (
        <View style={{ gap: 8 }}>
          <Text variant="h3">{t('details.about')}</Text>
          <Text variant="body" color={colors.body}>{task.description}</Text>
        </View>
      ) : null}

      {task.steps.length ? (
        <View style={{ gap: 10 }}>
          <Text variant="h3">{t('details.whatYoullDo')}</Text>
          {task.steps.map((s, i) => (
            <Row key={i} gap={12} style={{ alignItems: 'flex-start' }}>
              <View style={styles.stepNum}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.purpleDark }}>{i + 1}</Text>
              </View>
              <Text variant="bodySm" color={colors.body} style={{ flex: 1, paddingTop: 2 }}>{s}</Text>
            </Row>
          ))}
        </View>
      ) : null}

      {task.instructions ? (
        <View style={styles.instructions}>
          <Icon name="info" size={18} color={colors.purpleDark} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" color={colors.purpleDark}>{t('details.instructions')}</Text>
            <Text variant="bodySm" color={colors.purpleDark}>{task.instructions}</Text>
          </View>
        </View>
      ) : null}

      {privateDetails.data && (privateDetails.data.online_details || privateDetails.data.contact_info) ? (
        <Card style={{ gap: 8 }}>
          {privateDetails.data.online_details ? (
            <>
              <Text variant="label">{t('details.onlineDetails')}</Text>
              <Text variant="bodySm" selectable>{privateDetails.data.online_details}</Text>
            </>
          ) : null}
          {privateDetails.data.contact_info ? (
            <>
              <Text variant="label">{t('details.contact')}</Text>
              <Text variant="bodySm" selectable>{privateDetails.data.contact_info}</Text>
            </>
          ) : null}
        </Card>
      ) : (
        <Text variant="caption">{t('details.contactAfterJoin')}</Text>
      )}

      {siblings.length ? (
        <View style={{ gap: 10 }}>
          <Text variant="h3">{t('details.moreInEvent')}</Text>
          {siblings.slice(0, 4).map((s) => (
            <SevaRow key={s.id} task={s} />
          ))}
        </View>
      ) : null}
    </View>
  );

  if (isDesktop) {
    return (
      <Screen title={task.title} header={header} maxWidth={1180}>
        <Row gap={40} style={{ alignItems: 'flex-start' }}>
          {content}
          <View style={{ width: 380 }}>
            <JoinPanel task={task} mine={!!mine} layout="panel" />
          </View>
        </Row>
      </Screen>
    );
  }
  return (
    <Screen title={task.title} header={header} footer={<JoinPanel task={task} mine={!!mine} layout="footer" />}>
      {content}
    </Screen>
  );
}

function InfoRow({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <Row gap={12} style={{ alignItems: 'flex-start' }}>
      <View style={styles.infoIcon}>
        <Icon name={icon} size={18} color={colors.purpleDark} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="small" color={colors.muted}>{title}</Text>
        {children}
      </View>
    </Row>
  );
}

function JoinPanel({ task, mine, layout }: { task: TaskWithEvent; mine: boolean; layout: 'panel' | 'footer' }) {
  const { t } = useTranslation();
  const { session, profile } = useAuth();
  const required = task.required_courses ?? [];
  const meetsCourses = !required.length || required.some((c) => (profile?.courses ?? []).includes(c));
  const courseNames = required.map((c) => t(`courses.${c}`)).join(t('courses.or'));
  const text = useTaskText();
  const invitations = useMyInvitations();
  const discover = useDiscoverTasks();
  const join = useJoinTask(task.id);
  const decline = useDeclineInvitation(task.id);
  const max = Math.max(1, maxClaim(task));
  const [qty, setQty] = useState(() => Math.min(task.type === 'quantity' ? Math.min(6, max) : 1, max));
  const [adjusted, setAdjusted] = useState<number | null>(null);
  const [fullNow, setFullNow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = fullNow ? 'full' : joinState(task);
  const invite = invitations.data?.find((i) => i.task_id === task.id);
  const unit = task.unit ?? '';
  const isPanel = layout === 'panel';

  const doJoin = async (n: number) => {
    setError(null);
    try {
      const res = await join.mutateAsync(n);
      if (res.status === 'joined') {
        router.replace({ pathname: '/seva/[id]/joined', params: { id: task.id, qty: String(res.qty) } });
      } else if (res.status === 'capacity_changed') {
        setAdjusted(res.available);
        setQty(res.available);
      } else {
        setFullNow(true);
      }
    } catch (e) {
      setError(t(joinErrorKey(e)));
    }
  };

  const wrap = (children: ReactNode) =>
    isPanel ? <Card style={{ gap: 14, padding: 20 }}>{children}</Card> : <View style={{ gap: 10 }}>{children}</View>;

  const summary = isPanel ? (
    <View style={{ gap: 8 }}>
      <Text variant="h3">{text.capacityLine(task)}</Text>
      <ProgressBar value={claimedFraction(task)} />
      <Text variant="caption">{t('details.volunteersJoined', { count: task.volunteers_count })}</Text>
      {required.length ? (
        <Row gap={6}>
          <Icon name="bookmark" size={14} color={colors.purpleDark} />
          <Text variant="caption" color={colors.purpleDark}>{t('courses.requires', { courses: courseNames })}</Text>
        </Row>
      ) : null}
      <Divider color={colors.cardBorder} />
    </View>
  ) : null;

  if (mine) {
    return wrap(
      <>
        {summary}
        <Row gap={8}>
          <Icon name="check" size={18} color={colors.purple} />
          <Text variant="label" color={colors.purpleDark}>{t('join.alreadyJoined')}</Text>
        </Row>
        <Button title={t('join.viewMySeva')} size="lg" onPress={() => router.navigate({ pathname: '/my-seva', params: {} })} />
      </>,
    );
  }

  if (!session) {
    return wrap(
      <>
        {summary}
        <Button title={t('join.signInToJoin')} size="lg" onPress={() => router.push('/sign-in')} />
      </>,
    );
  }

  if (!meetsCourses) {
    return wrap(
      <>
        {summary}
        <View style={{ gap: 6 }}>
          <Text variant="label">{t('courses.needTitle', { courses: courseNames })}</Text>
          <Text variant="caption">{t('courses.needBody')}</Text>
        </View>
        <Button title={t('courses.update')} variant="outline" size="lg" onPress={() => router.push('/availability')} />
      </>,
    );
  }

  if (state === 'full' || state === 'closed') {
    const similar = (discover.data ?? [])
      .filter((x) => x.id !== task.id && joinState(x) === 'open' && x.visibility === 'public')
      .sort((a, b) => Number(b.category === task.category) - Number(a.category === task.category))
      .slice(0, 2);
    return wrap(
      <>
        {summary}
        <View style={{ gap: 4 }}>
          <Row gap={8}>
            <Badge label={state === 'full' ? t('seva.full') : t('seva.closed')} tone={state === 'full' ? 'danger' : 'plain'} />
            <Text variant="title">{state === 'full' ? t('join.fullTitle') : t('join.closedTitle')}</Text>
          </Row>
          <Text variant="caption">
            {state === 'closed'
              ? t('join.closedBody')
              : task.type === 'role'
                ? t('join.fullRoleBody')
                : t('join.fullBody', { total: capacity(task), unit })}
          </Text>
        </View>
        {state === 'full' && (isPanel || similar.length) ? similar.map((s) => <SevaRow key={s.id} task={s} />) : null}
      </>,
    );
  }

  const isQty = task.type === 'quantity';
  return wrap(
    <>
      {summary}
      {invite ? (
        <View style={styles.invite}>
          <Icon name="mail" size={18} color={colors.amberText} />
          <Text variant="bodySm" color={colors.amberText} style={{ flex: 1 }}>{t('join.invitedBanner')}</Text>
        </View>
      ) : null}
      {adjusted != null ? (
        <View style={styles.adjusted} accessibilityLiveRegion="assertive">
          <Text variant="label" color={colors.amberText}>{t('join.capacityTitle', { count: adjusted, unit })}</Text>
          <Text variant="caption" color={colors.amberText}>{t('join.capacityBody', { count: adjusted })}</Text>
        </View>
      ) : null}
      {isQty && isPanel ? (
        <View style={{ gap: 8 }}>
          <Text variant="label">{t('join.howMany', { unit })}</Text>
          <Stepper value={qty} onChange={setQty} max={adjusted ?? max} label={unit} size="lg" />
          <Text variant="caption">{t('join.canClaim', { max })}</Text>
        </View>
      ) : null}
      <Row gap={10}>
        {isQty && !isPanel ? <Stepper value={qty} onChange={setQty} max={adjusted ?? max} label={unit} /> : null}
        <Button
          title={
            adjusted != null
              ? t('join.joinWith', { count: qty, unit })
              : isQty
                ? isPanel
                  ? t('join.joinQty', { count: qty, unit })
                  : t('join.join')
                : t('join.joinRole')
          }
          size="lg"
          style={{ flex: 1 }}
          loading={join.isPending}
          onPress={() => doJoin(qty)}
        />
      </Row>
      {error ? <Text variant="caption" color={colors.danger}>{error}</Text> : null}
      <Text variant="caption" align="center">
        {isQty ? t('join.reservedNote', { count: qty, unit, max }) : t('join.reservedRoleNote')}
      </Text>
      {invite ? (
        <Pressable accessibilityRole="button" onPress={() => decline.mutate(invite.id, { onSuccess: () => router.replace('/discover') })} style={{ alignSelf: 'center', padding: 6 }}>
          <Text variant="label" color={colors.muted}>{decline.isSuccess ? t('join.declined') : t('join.decline')}</Text>
        </Pressable>
      ) : null}
      {Platform.OS === 'web' && remaining(task) <= 3 && remaining(task) > 0 ? (
        <Text variant="caption" color={colors.orangeText} align="center">{text.leftShort(task)}</Text>
      ) : null}
      {task.signup_deadline && isPanel ? (
        <Text variant="caption" align="center">{t('details.deadline')}: {formatDay(task.signup_deadline)}</Text>
      ) : null}
    </>,
  );
}

const styles = StyleSheet.create({
  infoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.purpleTint, alignItems: 'center', justifyContent: 'center' },
  stepNum: { width: 26, height: 26, borderRadius: 999, backgroundColor: colors.purpleTint, alignItems: 'center', justifyContent: 'center' },
  instructions: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.control, backgroundColor: colors.purpleTint },
  invite: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: radius.control, backgroundColor: colors.amberTint },
  adjusted: { gap: 4, padding: 12, borderRadius: radius.control, backgroundColor: colors.amberTint },
});
