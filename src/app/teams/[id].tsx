import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { useConfirm } from '@/components/ConfirmDialog';
import { Badge } from '@/components/Chip';
import { Avatar, Card, EmptyState, Row, Screen, TopBar, useLayout } from '@/components/Layout';
import { ProgressBar } from '@/components/ProgressBar';
import { Text } from '@/components/Text';
import {
  useDeleteTeam,
  useInviteToTeam,
  useOrgTeams,
  useRemoveTeamMember,
  useSetTeamLead,
  useTeamSuggestions,
} from '@/features/insights/api';
import { useLabels } from '@/features/insights/labels';
import { TeamForm } from '@/features/insights/TeamForm';
import { teamCoverage } from '@/features/insights/teams';
import { OrganizerGate } from '@/features/org/components';
import { colors } from '@/theme/tokens';

export default function TeamScreen() {
  return <OrganizerGate>{(org) => <TeamDetail orgId={org.id} />}</OrganizerGate>;
}

function TeamDetail({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const { isDesktop } = useLayout();
  const L = useLabels();
  const { id } = useLocalSearchParams<{ id: string }>();
  const teams = useOrgTeams(orgId);
  const suggestions = useTeamSuggestions(id);
  const invite = useInviteToTeam();
  const remove = useRemoveTeamMember();
  const setLead = useSetTeamLead();
  const del = useDeleteTeam();
  const { ask, dialog } = useConfirm();
  const [editing, setEditing] = useState(false);
  const [invited, setInvited] = useState<string[]>([]);
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/teams'));
  const team = teams.data?.find((x) => x.id === id);

  if (teams.isPending) return <Screen header={<TopBar onBack={back} />}><Text variant="caption">{t('common.loading')}</Text></Screen>;
  if (!team) return <Screen header={<TopBar onBack={back} />}><EmptyState title={t('teams.notFound')} /></Screen>;

  const c = teamCoverage(team);
  const sendInvite = async (userId: string) => {
    await invite.mutateAsync({ teamId: team.id, users: [userId] });
    setInvited((cur) => [...cur, userId]);
  };
  const confirmDelete = () =>
    ask({
      title: t('teams.delete'),
      body: t('teams.deleteConfirm', { name: team.name }),
      confirmLabel: t('common.delete'),
      destructive: true,
      onConfirm: async () => {
        await del.mutateAsync(team.id);
        router.navigate('/teams');
      },
    });

  return (
    <Screen title={team.name} maxWidth={1180} header={<TopBar title={t('teams.title')} onBack={back} />}>
      {dialog}
      {editing ? (
        <TeamForm orgId={orgId} team={team} onDone={() => setEditing(false)} />
      ) : (
        <Card style={{ padding: 20, gap: 14 }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }} wrap gap={12}>
            <View style={{ flex: 1, gap: 4, minWidth: 220 }}>
              <Text variant="h2">{team.name}</Text>
              <Text variant="caption">{[team.seva_area ? L.area(team.seva_area) : null, team.centre_name, team.region ? L.region(team.region) : null].filter(Boolean).join(' · ')}</Text>
              {team.description ? <Text variant="bodySm" color={colors.body}>{team.description}</Text> : null}
            </View>
            <Row gap={8}>
              <Button title={t('common.edit')} icon="edit" variant="outline" onPress={() => setEditing(true)} />
              <Button title={t('common.delete')} icon="trash" variant="danger" onPress={confirmDelete} />
            </Row>
          </Row>
          <View style={{ gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="small" color={colors.muted}>{t('teams.staffing')}</Text>
              <Text variant="small">{t('teams.ofTarget', { count: c.active, target: team.target_size })}</Text>
            </Row>
            <ProgressBar value={team.target_size ? c.active / team.target_size : 0} color={c.active >= team.target_size ? colors.success : colors.purple} />
          </View>
          {c.covered.length || c.gaps.length ? (
            <View style={{ gap: 6 }}>
              <Text variant="small" color={colors.muted}>{t('teams.skillCoverage')}</Text>
              <Row gap={6} wrap>
                {c.covered.map((s) => <Badge key={s} label={L.skill(s)} tone="success" icon="check" />)}
                {c.gaps.map((s) => <Badge key={s} label={t('teams.gap', { skill: L.skill(s) })} tone="amber" icon="alert" />)}
              </Row>
            </View>
          ) : null}
        </Card>
      )}

      <View style={[{ gap: 16 }, isDesktop && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <Card style={{ flex: 1, padding: 20, gap: 4 }}>
          <Text variant="h3" style={{ paddingBottom: 8 }}>{t('teams.members', { count: team.members.length })}</Text>
          {team.members.length === 0 ? <Text variant="caption">{t('teams.noMembers')}</Text> : null}
          {team.members.map((m) => (
            <Row key={m.id} gap={12} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
              <Avatar name={m.full_name || '?'} size={36} color={m.person_type === 'volunteer' ? colors.amber : '#D9C4EA'} />
              <Pressable accessibilityRole="link" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/volunteers/[id]', params: { id: m.id } })}>
                <Row gap={6} wrap>
                  <Text variant="label">{m.full_name}</Text>
                  {team.lead_id === m.id ? <Badge label={t('teams.lead')} tone="purple" /> : null}
                  {m.status === 'invited' ? <Badge label={t('teams.status.invited')} tone="amber" /> : null}
                </Row>
                <Text variant="small" color={colors.muted} numberOfLines={1}>
                  {[L.personType(m.person_type), L.region(m.region), m.skills.slice(0, 2).map(L.skill).join(', ')].filter(Boolean).join(' · ')}
                </Text>
              </Pressable>
              {m.status === 'active' && team.lead_id !== m.id ? (
                <Button title={t('teams.makeLead')} variant="ghost" onPress={() => setLead.mutate({ teamId: team.id, userId: m.id })} />
              ) : null}
              <Button title={t('teams.remove')} variant="ghost" onPress={() => remove.mutate({ teamId: team.id, userId: m.id })} />
            </Row>
          ))}
        </Card>

        <Card style={{ flex: 1, padding: 20, gap: 4 }}>
          <Text variant="h3">{t('teams.builder')}</Text>
          <Text variant="caption" style={{ paddingBottom: 8 }}>{t('teams.builderSub')}</Text>
          {suggestions.isPending ? <Text variant="caption">{t('common.loading')}</Text> : null}
          {suggestions.data?.length === 0 ? <Text variant="caption">{t('teams.noSuggestions')}</Text> : null}
          {suggestions.data?.map((s) => {
            const done = invited.includes(s.id);
            return (
              <Row key={s.id} gap={12} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
                <View style={{ width: 48, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, lineHeight: 22, color: colors.purpleDark }} weight="semibold">{s.score}%</Text>
                </View>
                <Pressable accessibilityRole="link" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/volunteers/[id]', params: { id: s.id } })}>
                  <Text variant="label">{s.full_name}</Text>
                  <Text variant="small" color={colors.muted} numberOfLines={1}>
                    {[s.city ?? L.region(s.region), ...s.reasons.map((r) => t(`teams.reasons.${r}`))].join(' · ')}
                  </Text>
                </Pressable>
                <Button title={done ? t('teams.invitedShort') : t('teams.invite')} icon={done ? 'check' : 'send'} variant={done ? 'secondary' : 'outline'}
                  disabled={done || invite.isPending} onPress={() => sendInvite(s.id)} />
              </Row>
            );
          })}
        </Card>
      </View>
    </Screen>
  );
}
