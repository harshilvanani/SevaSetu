import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Badge } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { Card, EmptyState, Row, Screen, useLayout } from '@/components/Layout';
import { ProgressBar } from '@/components/ProgressBar';
import { Text } from '@/components/Text';
import { type Team, useOrgTeams } from '@/features/insights/api';
import { useLabels } from '@/features/insights/labels';
import { teamCoverage } from '@/features/insights/teams';
import { TeamForm } from '@/features/insights/TeamForm';
import { OrganizerGate, OrgSwitcher } from '@/features/org/components';
import { colors } from '@/theme/tokens';

export default function TeamsScreen() {
  return <OrganizerGate>{(org) => <Teams orgId={org.id} />}</OrganizerGate>;
}

function Teams({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const { isDesktop } = useLayout();
  const teams = useOrgTeams(orgId);
  const [creating, setCreating] = useState(false);
  const list = teams.data ?? [];
  const totals = list.reduce((acc, tm) => ({ members: acc.members + teamCoverage(tm).active, target: acc.target + tm.target_size }), { members: 0, target: 0 });

  return (
    <Screen title={t('nav.teams')} maxWidth={1240} refreshing={teams.isRefetching} onRefresh={() => teams.refetch()}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 8 }} wrap gap={12}>
        <View style={{ gap: 4, flexShrink: 1 }}>
          <Text variant="overline" color={colors.purple}>{t('teams.overline')}</Text>
          <Text variant="h1">{t('teams.title')}</Text>
          <Text variant="caption">{list.length ? t('teams.summary', { teams: list.length, members: totals.members, target: totals.target }) : t('teams.sub')}</Text>
        </View>
        {!creating ? <Button title={t('teams.new')} icon="plus" onPress={() => setCreating(true)} /> : null}
      </Row>
      <OrgSwitcher />
      {creating ? (
        <TeamForm orgId={orgId} onDone={(id) => { setCreating(false); if (id) router.push({ pathname: '/teams/[id]', params: { id } }); }} />
      ) : null}
      {teams.isPending ? (
        <Text variant="caption">{t('common.loading')}</Text>
      ) : list.length === 0 && !creating ? (
        <EmptyState title={t('teams.emptyTitle')} body={t('teams.emptyBody')}>
          <Button title={t('teams.new')} icon="plus" onPress={() => setCreating(true)} />
        </EmptyState>
      ) : (
        <View style={[{ gap: 12 }, isDesktop && { flexDirection: 'row', flexWrap: 'wrap' }]}>
          {list.map((tm) => (
            <View key={tm.id} style={isDesktop ? { width: '32.5%' } : undefined}>
              <TeamCard team={tm} />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function TeamCard({ team }: { team: Team }) {
  const { t } = useTranslation();
  const L = useLabels();
  const c = teamCoverage(team);
  const fill = team.target_size ? c.active / team.target_size : 0;
  return (
    <Card onPress={() => router.push({ pathname: '/teams/[id]', params: { id: team.id } })} accessibilityLabel={team.name} style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }} gap={8}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title">{team.name}</Text>
          <Text variant="caption">{[team.seva_area ? L.area(team.seva_area) : null, team.centre_name].filter(Boolean).join(' · ')}</Text>
        </View>
        <Badge label={fill >= 1 ? t('teams.fullyStaffed') : t('teams.needs', { count: Math.max(0, team.target_size - c.active) })} tone={fill >= 1 ? 'success' : 'amber'} />
      </Row>
      <View style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="small" color={colors.muted}>{t('teams.staffing')}</Text>
          <Text variant="small">{t('teams.ofTarget', { count: c.active, target: team.target_size })}{c.invited ? ` · ${t('teams.invitedCount', { count: c.invited })}` : ''}</Text>
        </Row>
        <ProgressBar value={fill} color={fill >= 1 ? colors.success : colors.purple} />
      </View>
      <Row gap={6}>
        <Icon name="user" size={14} color={colors.muted} />
        <Text variant="small" color={colors.subtle}>{team.lead_name ? t('teams.ledBy', { name: team.lead_name }) : t('teams.noLead')}</Text>
      </Row>
      {c.covered.length || c.gaps.length ? (
        <Row gap={6} wrap>
          {c.covered.map((s) => <Badge key={s} label={L.skill(s)} tone="success" icon="check" />)}
          {c.gaps.map((s) => <Badge key={s} label={L.skill(s)} tone="amber" icon="alert" />)}
        </Row>
      ) : null}
    </Card>
  );
}
