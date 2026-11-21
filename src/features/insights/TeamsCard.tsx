import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Badge } from '@/components/Chip';
import { Card, Row } from '@/components/Layout';
import { Text } from '@/components/Text';
import { colors } from '@/theme/tokens';

import { useMyTeams, useRespondTeam } from './api';
import { useLabels } from './labels';

/** The volunteer's teams, with accept / decline for invitations. Hidden when there are none. */
export function TeamsCard() {
  const { t } = useTranslation();
  const L = useLabels();
  const teams = useMyTeams();
  const respond = useRespondTeam();
  if (!teams.data?.length) return null;
  return (
    <Card style={{ padding: 20, gap: 14 }}>
      <Text variant="h3">{t('teams.myTeams')}</Text>
      {teams.data.map((tm) => (
        <View key={tm.id} style={{ gap: 8 }}>
          <Row style={{ justifyContent: 'space-between' }} gap={8}>
            <View style={{ flex: 1 }}>
              <Text variant="label">{tm.name}</Text>
              <Text variant="caption">
                {[tm.org_name, tm.seva_area ? L.area(tm.seva_area) : null, t('teams.membersCount', { count: tm.members_count })].filter(Boolean).join(' · ')}
              </Text>
              {tm.lead_name ? <Text variant="small" color={colors.muted}>{t('teams.ledBy', { name: tm.lead_name })}</Text> : null}
            </View>
            <Badge label={t(`teams.status.${tm.status}`)} tone={tm.status === 'active' ? 'success' : 'amber'} />
          </Row>
          {tm.status === 'invited' ? (
            <Row gap={8}>
              <View style={{ flex: 1 }}>
                <Button title={t('teams.accept')} onPress={() => respond.mutate({ teamId: tm.id, accept: true })} loading={respond.isPending} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title={t('teams.decline')} variant="outline" onPress={() => respond.mutate({ teamId: tm.id, accept: false })} />
              </View>
            </Row>
          ) : null}
        </View>
      ))}
    </Card>
  );
}
