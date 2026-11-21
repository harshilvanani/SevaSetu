import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Badge, Chip } from '@/components/Chip';
import { Card, EmptyState, Row, Screen, TopBar } from '@/components/Layout';
import { Text } from '@/components/Text';
import { useDirectoryPerson, useInviteToTeam, useOrgTeams } from '@/features/insights/api';
import { useLabels } from '@/features/insights/labels';
import { Volunteer360 } from '@/features/insights/Volunteer360';
import { OrganizerGate } from '@/features/org/components';
import { formatDay } from '@/lib/format';
import { colors } from '@/theme/tokens';

export default function VolunteerProfileScreen() {
  return <OrganizerGate>{(org) => <Profile orgId={org.id} />}</OrganizerGate>;
}

function Profile({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const L = useLabels();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useDirectoryPerson(orgId, id);
  const teams = useOrgTeams(orgId);
  const invite = useInviteToTeam();
  const [message, setMessage] = useState<string | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/volunteers'));
  const p = q.data;

  if (q.isPending) return <Screen header={<TopBar onBack={back} />}><Text variant="caption">{t('common.loading')}</Text></Screen>;
  if (!p) {
    return (
      <Screen header={<TopBar onBack={back} />}>
        <EmptyState title={t('directory.notFound')} body={t('directory.notFoundBody')} />
      </Screen>
    );
  }

  const myTeams = (teams.data ?? []).map((tm) => ({ ...tm, status: tm.members.find((m) => m.id === p.id)?.status }));
  const addToTeam = async (teamId: string, name: string) => {
    setMessage(null);
    try {
      await invite.mutateAsync({ teamId, users: [p.id] });
      setMessage(t('teams.invited', { name: p.full_name, team: name }));
    } catch {
      setMessage(t('common.somethingWrong'));
    }
  };

  return (
    <Screen title={p.full_name} maxWidth={1180} header={<TopBar title={t('directory.title')} onBack={back} />}>
      <Volunteer360
        person={{ ...p, linkedin_consent: !!p.linkedin_url, joined_at: null }}
        extra={
          <Card style={{ padding: 20, gap: 12 }}>
            <Text variant="h3">{t('directory.history')}</Text>
            {p.history?.length ? (
              p.history.map((h, i) => (
                <Row key={`${h.event_id}-${i}`} gap={12} style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="label" numberOfLines={1}>{h.task}</Text>
                    <Text variant="caption" numberOfLines={1}>{`${h.event} · ${formatDay(h.starts_at)}`}</Text>
                  </View>
                  {h.hours > 0 ? <Text variant="label">{L.hours(h.hours)}</Text> : <Badge label={t(`directory.assignment.${h.status}`)} tone="amber" />}
                </Row>
              ))
            ) : (
              <Text variant="caption">{p.served_with_org ? t('directory.noHistory') : t('directory.optedInOnly')}</Text>
            )}
          </Card>
        }
        insight={
          <Card style={{ padding: 20, gap: 12 }}>
            <Text variant="h3">{t('teams.addToTeam')}</Text>
            {myTeams.length ? (
              <Row gap={8} wrap>
                {myTeams.map((tm) =>
                  tm.status ? (
                    <Badge key={tm.id} label={`${tm.name} · ${t(`teams.status.${tm.status}`)}`} tone={tm.status === 'active' ? 'success' : 'amber'} />
                  ) : (
                    <Chip key={tm.id} size="sm" icon="plus" label={tm.name} onPress={() => addToTeam(tm.id, tm.name)} />
                  ),
                )}
              </Row>
            ) : (
              <Text variant="caption">{t('teams.noneYet')}</Text>
            )}
            {message ? <Text variant="caption" color={colors.purpleDark}>{message}</Text> : null}
          </Card>
        }
      />
    </Screen>
  );
}
