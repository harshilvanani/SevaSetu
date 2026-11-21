import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/Chip';
import { Card, Row, SectionHeader } from '@/components/Layout';
import { ProgressBar } from '@/components/ProgressBar';
import { Text } from '@/components/Text';
import { dayTile, formatTime } from '@/lib/format';
import { colors, fonts } from '@/theme/tokens';

import type { Alert, Insights, UpcomingRow } from './api';
import { AreaChart, Meter } from './charts';
import { useLabels } from './labels';

const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : null);

export function UpcomingList({ rows, limit = 5 }: { rows: UpcomingRow[]; limit?: number }) {
  const { t } = useTranslation();
  const L = useLabels();
  if (!rows.length) return <Text variant="caption">{t('insights.noUpcoming')}</Text>;
  return (
    <View>
      {rows.slice(0, limit).map((e, i) => {
        const tile = dayTile(e.starts_at);
        const fill = e.positions > 0 ? e.filled / e.positions : 0;
        return (
          <Pressable
            key={e.id}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })}
            style={({ pressed }) => [styles.upRow, i > 0 && styles.upBorder, pressed && { backgroundColor: colors.cream }]}>
            <View style={styles.dateTile}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 18, lineHeight: 22, color: colors.purpleDark }}>{tile.day}</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 10, lineHeight: 12, color: colors.purpleDark, textTransform: 'uppercase' }}>{tile.month}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" numberOfLines={1}>{e.title}</Text>
              <Text variant="caption" numberOfLines={1}>
                {[formatTime(e.starts_at), e.centre ?? e.city, t(`availability.modes.${e.mode}`)].filter(Boolean).join(' · ')}
              </Text>
              {e.positions > 0 ? (
                <Row gap={8} style={{ marginTop: 4 }}>
                  <View style={{ flex: 1, maxWidth: 220 }}>
                    <ProgressBar value={fill} color={fill >= 0.9 ? colors.success : fill >= 0.6 ? colors.purple : colors.deepOrange} />
                  </View>
                  <Text variant="small" color={colors.muted}>{t('insights.filledOf', { filled: e.filled, total: e.positions })}</Text>
                </Row>
              ) : null}
            </View>
            {e.region ? <Badge label={L.region(e.region)} tone="plain" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function RegionalCoverage({ data }: { data: Insights }) {
  const { t } = useTranslation();
  const L = useLabels();
  const rows = data.regions.filter((r) => r.positions > 0 || r.volunteers > 0).sort((a, b) => b.volunteers - a.volunteers);
  if (!rows.length) return <Text variant="caption">{t('regions.empty')}</Text>;
  return (
    <View style={{ gap: 14 }}>
      {rows.map((r) => (
        <Meter
          key={r.region}
          label={L.region(r.region)}
          percent={pct(r.filled, r.positions)}
          note={t('regions.meterNote', { count: r.volunteers, teachers: r.teachers })}
        />
      ))}
    </View>
  );
}

const severityColor = { high: colors.danger, medium: colors.amber, low: colors.purple } as const;

export function useAlertText() {
  const { t } = useTranslation();
  return (a: Alert) => {
    switch (a.kind) {
      case 'understaffed':
        return { title: t('alerts.understaffed', { title: a.title, count: a.missing ?? 0 }), detail: t('alerts.understaffedDetail') };
      case 'almost_full':
        return { title: t('alerts.almostFull', { title: a.title, percent: a.percent }), detail: t('alerts.almostFullDetail') };
      case 'log_hours':
        return { title: t('alerts.logHours', { title: a.title }), detail: t('alerts.logHoursDetail') };
      case 'missing_availability':
        return { title: t('alerts.missingAvailability', { count: a.count ?? 0 }), detail: t('alerts.missingAvailabilityDetail') };
      case 'pending_reviews':
        return { title: t('alerts.pendingReviews', { count: a.count ?? 0 }), detail: t('alerts.pendingReviewsDetail') };
    }
  };
}

function openAlert(a: Alert) {
  if (a.kind === 'log_hours' && a.event_id) router.push({ pathname: '/events/[id]/complete', params: { id: a.event_id } });
  else if (a.kind === 'understaffed' && a.event_id) router.push({ pathname: '/events/[id]/find', params: { id: a.event_id } });
  else if (a.event_id) router.push({ pathname: '/events/[id]', params: { id: a.event_id } });
  else if (a.kind === 'pending_reviews') router.navigate('/reviews');
  else router.navigate({ pathname: '/volunteers', params: { filter: 'no_availability' } });
}

export function AlertList({ alerts, limit = 5 }: { alerts: Alert[]; limit?: number }) {
  const { t } = useTranslation();
  const text = useAlertText();
  if (!alerts.length) return <Text variant="caption">{t('alerts.none')}</Text>;
  return (
    <View>
      {alerts.slice(0, limit).map((a, i) => {
        const x = text(a);
        return (
          <Pressable
            key={`${a.kind}-${a.event_id ?? i}`}
            accessibilityRole="button"
            accessibilityLabel={`${t(`alerts.severity.${a.severity}`)}: ${x.title}`}
            onPress={() => openAlert(a)}
            style={({ pressed }) => [styles.alertRow, i > 0 && styles.upBorder, pressed && { backgroundColor: colors.cream }]}>
            <View style={[styles.dot, { backgroundColor: severityColor[a.severity] }]} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label">{x.title}</Text>
              <Text variant="caption">{x.detail}</Text>
            </View>
            <Text variant="small" color={colors.muted}>{t(`alerts.severity.${a.severity}`)}</Text>
          </Pressable>
        );
      })}
      {alerts.length > limit ? <Text variant="caption" style={{ paddingTop: 8 }}>{t('alerts.more', { count: alerts.length - limit })}</Text> : null}
    </View>
  );
}

export function DataHealth({ data, compact }: { data: Insights; compact?: boolean }) {
  const { t } = useTranslation();
  const h = data.data_health;
  const rows: [string, number | null][] = [
    [t('dataHealth.profiles'), pct(h.profiles, h.total)],
    [t('dataHealth.skills'), pct(h.skills, h.total)],
    [t('dataHealth.languages'), pct(h.languages, h.total)],
    [t('dataHealth.availability'), pct(h.availability, h.total)],
    ...(compact
      ? []
      : ([
          [t('dataHealth.location'), pct(h.location, h.total)],
          [t('dataHealth.courses'), pct(h.courses, h.total)],
          [t('dataHealth.hoursLogged'), pct(h.hours_logged, h.hours_expected)],
        ] as [string, number | null][])),
  ];
  return (
    <View style={{ gap: 14 }}>
      {rows.map(([label, p]) => (
        <Meter key={label} label={label} percent={p} />
      ))}
      <Text variant="small" color={colors.muted}>{t('dataHealth.basis', { count: h.total })}</Text>
    </View>
  );
}

export function MomentumChart({ data }: { data: Insights }) {
  const { t } = useTranslation();
  const L = useLabels();
  return (
    <AreaChart
      label={t('insights.momentum')}
      points={data.monthly_hours.map((m) => ({ key: m.month, value: m.hours }))}
      formatLabel={L.month}
      formatValue={L.hours}
    />
  );
}

export function Panel({ title, sub, action, onAction, children, style }: {
  title: string;
  sub?: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <Card style={[{ gap: 14, padding: 20 }, style ?? {}]}>
      <View style={{ gap: 2 }}>
        <SectionHeader title={title} action={action} onAction={onAction} />
        {sub ? <Text variant="caption">{sub}</Text> : null}
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  upRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  upBorder: { borderTopWidth: 1, borderTopColor: colors.cardBorder },
  dateTile: { width: 46, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.purpleTint },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
