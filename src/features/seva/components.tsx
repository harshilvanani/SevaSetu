import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Badge } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { Row } from '@/components/Layout';
import { ImpactBar, ProgressBar } from '@/components/ProgressBar';
import { Text } from '@/components/Text';
import { capacity, claimedFraction, joinState, progressBreakdown, remaining } from '@/domain/seva';
import { dayTile, formatDay, formatRange, formatWhen } from '@/lib/format';
import { colors, fonts, radius, shadow } from '@/theme/tokens';

import { type AssignmentWithTask, assignmentProgress, type TaskWithEvent, taskEnd, taskStart } from './api';

export function useTaskText() {
  const { t } = useTranslation();

  const mode = (task: TaskWithEvent) => t(`availability.modes.${task.mode}`);
  const category = (task: TaskWithEvent) => (task.category ? t(`interests.${task.category}`, { defaultValue: task.category }) : null);

  const when = (task: TaskWithEvent) => {
    const start = taskStart(task);
    if (!start) {
      const end = taskEnd(task);
      return end ? t('seva.anyTimeBefore', { date: formatDay(end) }) : t('seva.online');
    }
    return formatWhen(start);
  };

  const whenRange = (task: TaskWithEvent) => {
    const start = taskStart(task);
    if (!start) return when(task);
    return `${formatDay(start)} · ${formatRange(start, taskEnd(task))}`;
  };

  const capacityLine = (task: TaskWithEvent) => {
    const left = remaining(task);
    const total = capacity(task);
    if (task.type === 'role') return t('seva.positionsOpen', { left, total });
    return t('seva.unitsAvailable', { left, total, unit: task.unit ?? '' });
  };

  const leftShort = (task: TaskWithEvent) => {
    const left = remaining(task);
    return task.type === 'role' ? t('seva.spotsOpen', { left, total: capacity(task) }) : t('seva.unitsLeft', { count: left, unit: task.unit ?? '' });
  };

  return { mode, category, when, whenRange, capacityLine, leftShort };
}

export function StatusBadge({ task }: { task: TaskWithEvent }) {
  const { t } = useTranslation();
  const state = joinState(task);
  if (state === 'full') return <Badge label={t('seva.full')} tone="danger" />;
  if (state === 'closed') return <Badge label={t('seva.closed')} tone="plain" />;
  return null;
}

const kmLabel = (km: number | null) => (km == null ? null : km < 10 ? km.toFixed(1) : Math.round(km).toString());

/** Card used in carousels / desktop grid. */
export function SevaCard({ task, km, width }: { task: TaskWithEvent; km?: number | null; width?: number }) {
  const { t } = useTranslation();
  const text = useTaskText();
  const state = joinState(task);
  const meta = [text.when(task), task.mode === 'virtual' ? t('seva.online') : kmLabel(km ?? null) ? t('seva.kmAway', { km: kmLabel(km ?? null) }) : task.events.city]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${task.title}. ${meta}. ${text.capacityLine(task)}`}
      onPress={() => router.push(`/seva/${task.id}`)}
      style={({ pressed }) => [styles.card, width ? { width } : { flex: 1 }, pressed && { backgroundColor: '#FBF8F3' }]}>
      <Row gap={6} wrap>
        <Badge label={text.mode(task)} tone="purple" />
        {text.category(task) ? <Badge label={text.category(task)!} tone="neutral" /> : null}
        {task.visibility === 'private' ? <Badge label={t('seva.invited')} tone="amber" icon="lock" /> : null}
      </Row>
      <Text variant="title" numberOfLines={2}>{task.title}</Text>
      <Text variant="caption" numberOfLines={1}>{meta}</Text>
      <ProgressBar value={claimedFraction(task)} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="caption" color={colors.text}>
          <Text variant="caption" weight="semibold" color={colors.text}>{text.capacityLine(task)}</Text>
        </Text>
        <StatusBadge task={task} />
      </Row>
      <View style={[styles.cardCta, state !== 'open' && { backgroundColor: colors.sand }]}>
        <Text style={{ color: state === 'open' ? colors.white : colors.text, fontFamily: fonts.semibold, fontSize: 14 }}>
          {state === 'open' ? t('discover.viewJoin') : t('common.view')}
        </Text>
      </View>
    </Pressable>
  );
}

/** Compact list row. */
export function SevaRow({ task, km }: { task: TaskWithEvent; km?: number | null }) {
  const { t } = useTranslation();
  const text = useTaskText();
  const state = joinState(task);
  const meta = [text.when(task), text.mode(task), kmLabel(km ?? null) ? t('seva.kmAway', { km: kmLabel(km ?? null) }) : null].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${task.title}. ${meta}`}
      onPress={() => router.push(`/seva/${task.id}`)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#FBF8F3' }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="title" style={{ fontSize: 15 }}>{task.title}</Text>
        <Text variant="caption">{meta}</Text>
        {state === 'open' ? (
          <Text variant="caption" weight="semibold" color={colors.purpleDark}>{text.leftShort(task)}</Text>
        ) : (
          <StatusBadge task={task} />
        )}
      </View>
      <Icon name="chevronRight" size={20} color={colors.muted} />
    </Pressable>
  );
}

/** Row with a calendar tile (empty-state "good first seva"). */
export function SevaDateRow({ task, km }: { task: TaskWithEvent; km?: number | null }) {
  const { t } = useTranslation();
  const text = useTaskText();
  const start = taskStart(task);
  const tile = start ? dayTile(start) : null;
  const meta = [
    start ? formatRange(start, taskEnd(task)) : text.when(task),
    task.mode === 'virtual' ? text.mode(task) : kmLabel(km ?? null) ? t('seva.kmAway', { km: kmLabel(km ?? null) }) : null,
    text.leftShort(task),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/seva/${task.id}`)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#FBF8F3' }]}>
      <View style={[styles.tile, !tile && { backgroundColor: colors.purpleTint }]}>
        {tile ? (
          <>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, color: colors.orangeText }}>{tile.dow}</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 18, lineHeight: 22 }}>{tile.day}</Text>
          </>
        ) : (
          <Icon name="globe" size={20} color={colors.purpleDark} />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="title" style={{ fontSize: 15 }}>{task.title}</Text>
        <Text variant="caption">{meta}</Text>
      </View>
      <Icon name="chevronRight" size={20} color={colors.muted} />
    </Pressable>
  );
}

/** Plum hero card summarising the volunteer's active seva. */
export function ActiveSevaCard({ assignments }: { assignments: AssignmentWithTask[] }) {
  const { t } = useTranslation();
  const text = useTaskText();
  const active = assignments.filter((a) => a.status === 'active');
  if (!active.length) return null;
  // Prefer a quantity task that still needs reporting; otherwise the soonest.
  const primary = active.find((a) => a.seva_tasks.type === 'quantity') ?? active[0];
  const task = primary.seva_tasks;
  const { verified, pending } = assignmentProgress(primary);
  const b = progressBreakdown(primary.claimed_qty, verified, pending);
  const others = active.filter((a) => a.id !== primary.id);
  const next = others
    .map((a) => ({ a, start: taskStart(a.seva_tasks) }))
    .filter((x) => x.start)
    .sort((x, y) => x.start!.localeCompare(y.start!))[0];
  const due = taskEnd(task);

  return (
    <View accessibilityLabel={t('discover.yourSeva', { count: active.length })} style={styles.hero}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="overline" color={colors.amberSoft}>{t('discover.yourSeva', { count: active.length })}</Text>
        <Pressable accessibilityRole="link" onPress={() => router.navigate('/my-seva')} hitSlop={10}>
          <Text variant="label" color={colors.cream} style={{ fontSize: 13 }}>{t('common.seeAll')}</Text>
        </Pressable>
      </Row>
      <View style={{ gap: 4 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 19, lineHeight: 26, color: colors.cream }}>{task.title}</Text>
        <Text variant="caption" color="rgba(253,251,247,0.88)">
          {task.events.title}
          {task.type === 'quantity' && due ? ` · ${formatDay(due)}` : ` · ${text.when(task)}`}
        </Text>
      </View>
      {task.type === 'quantity' ? (
        <>
          <ImpactBar
            onDark
            verified={b.verified}
            pending={b.pending}
            total={primary.claimed_qty}
            label={`${b.verified} verified, ${b.pending} awaiting review, ${b.toGo} to go of ${primary.claimed_qty} ${task.unit}`}
          />
          <Text variant="caption" color={colors.cream}>
            <Text variant="caption" weight="semibold" color={colors.cream}>{b.verified} verified</Text> · {b.pending} in review · {b.toGo} to go
          </Text>
        </>
      ) : null}
      <Row gap={8}>
        {task.type === 'quantity' && b.toGo > 0 ? (
          <Button
            title={t('discover.reportProgress')}
            variant="light"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/my-seva', params: { assignment: primary.id, report: '1' } })}
          />
        ) : null}
        <Button
          title={t('discover.details')}
          variant="outlineLight"
          style={task.type === 'quantity' && b.toGo > 0 ? undefined : { flex: 1 }}
          onPress={() => router.push({ pathname: '/my-seva', params: { assignment: primary.id } })}
        />
      </Row>
      {next ? (
        <>
          <View style={{ height: 1, backgroundColor: 'rgba(253,251,247,0.18)' }} />
          <Row gap={8}>
            <Icon name="calendar" size={16} color={colors.amberSoft} />
            <Text variant="caption" color={colors.cream} style={{ flex: 1 }}>
              {t('discover.next', { title: next.a.seva_tasks.title, when: formatWhen(next.start!) })}
            </Text>
          </Row>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.card,
    padding: 16,
    gap: 10,
    ...shadow,
  },
  cardCta: {
    height: 44,
    borderRadius: radius.control,
    backgroundColor: colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tile: {
    width: 48,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.amberTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { backgroundColor: colors.plum, borderRadius: 20, padding: 20, gap: 12 },
});
