import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Row, Screen, useLayout } from '@/components/Layout';
import { Text } from '@/components/Text';
import { useOrgInsights } from '@/features/insights/api';
import { BarList, Outcome, StatTile } from '@/features/insights/charts';
import { useLabels } from '@/features/insights/labels';
import { DataHealth, MomentumChart, Panel } from '@/features/insights/sections';
import { OrganizerGate, OrgSwitcher } from '@/features/org/components';
import { colors } from '@/theme/tokens';

export default function ImpactScreen() {
  return <OrganizerGate>{(org) => <Impact orgId={org.id} orgName={org.name} />}</OrganizerGate>;
}

function Impact({ orgId, orgName }: { orgId: string; orgName: string }) {
  const { t } = useTranslation();
  const { isDesktop } = useLayout();
  const L = useLabels();
  const q = useOrgInsights(orgId);
  const d = q.data;
  const k = d?.kpis;
  const totalAreaHours = d?.hours_by_area.reduce((n, r) => n + r.hours, 0) ?? 0;
  const twoCol = isDesktop ? { flexDirection: 'row' as const, alignItems: 'flex-start' as const } : undefined;

  return (
    <Screen title={t('nav.impact')} maxWidth={1240} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <View style={{ gap: 4, paddingTop: 8 }}>
        <Text variant="overline" color={colors.purple}>{orgName}</Text>
        <Text variant="h1">{t('impact.title')}</Text>
        <Text variant="caption">{t('impact.sub')}</Text>
      </View>
      <OrgSwitcher />
      {!d || !k ? (
        <Text variant="caption">{q.isError ? t('common.somethingWrong') : t('common.loading')}</Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <StatTile icon="clock" tone="orange" label={t('impact.hours')} value={L.num(Math.round(k.hours_total))}
              sub={k.hours_month > 0 ? t('insights.thisMonth', { hours: L.num(Math.round(k.hours_month)) }) : undefined} />
            <StatTile icon="users" tone="green" label={t('impact.peopleReached')} value={L.num(k.people_reached)} />
            <StatTile icon="check" label={t('impact.completedEvents')} value={k.completed_events} />
            <StatTile icon="globe" tone="plum" label={t('insights.activeRegions')} value={k.active_regions} />
          </View>
          <View style={[{ gap: 16 }, twoCol]}>
            <Panel title={t('impact.growth')} sub={t('impact.growthSub')} style={{ flex: 3 }}>
              <MomentumChart data={d} />
            </Panel>
            <Panel title={t('impact.byArea')} sub={t('impact.byAreaSub')} style={{ flex: 2 }}>
              {d.hours_by_area.length ? (
                <BarList
                  rows={d.hours_by_area.slice(0, 7).map((r) => ({
                    key: r.area,
                    label: L.area(r.area),
                    value: r.hours,
                    sub: totalAreaHours ? t('impact.share', { percent: Math.round((100 * r.hours) / totalAreaHours) }) : undefined,
                  }))}
                  formatValue={L.hours}
                />
              ) : (
                <Text variant="caption">{t('impact.noHours')}</Text>
              )}
            </Panel>
          </View>
          <View style={[{ gap: 16 }, twoCol]}>
            <Panel title={t('impact.outcomes')} sub={t('impact.outcomesSub')} style={{ flex: 3 }}>
              <Row gap={12} wrap style={{ alignItems: 'stretch' }}>
                <Outcome value={L.num(k.people_reached)} label={t('impact.peopleSupported')} note={t('impact.peopleSupportedNote')} />
                <Outcome value={k.retention === null ? '—' : `${k.retention}%`} label={t('impact.retention')} note={t('impact.retentionNote')} />
                <Outcome value={k.teacher_coverage === null ? '—' : `${k.teacher_coverage}%`} label={t('impact.teacherCoverage')} note={t('impact.teacherCoverageNote')} />
              </Row>
            </Panel>
            <Panel title={t('dataHealth.title')} sub={t('dataHealth.sub')} style={{ flex: 2 }}>
              <DataHealth data={d} />
            </Panel>
          </View>
        </>
      )}
    </Screen>
  );
}
