import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Badge } from '@/components/Chip';
import { SearchField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Avatar, Card, Divider, Row } from '@/components/Layout';
import { Text } from '@/components/Text';
import { formatDay } from '@/lib/format';
import { colors } from '@/theme/tokens';

import { type EventAccessRow, useEventAccess, useInviteToEvent, useRespondRequest, useRevokeAccess, useSearchVolunteers } from './api';

/** Organizer's view of who asked to join a private event, who is invited, and a way to invite more people. */
export function AccessCard({ eventId, orgId, isPrivate }: { eventId: string; orgId: string; isPrivate: boolean }) {
  const { t } = useTranslation();
  const access = useEventAccess(eventId);
  const respond = useRespondRequest();
  const invite = useInviteToEvent();
  const revoke = useRevokeAccess();
  const [q, setQ] = useState('');
  const search = useSearchVolunteers(orgId, q);
  const [error, setError] = useState<string | null>(null);

  const rows = access.data ?? [];
  const requests = rows.filter((r) => r.status === 'requested');
  const people = rows.filter((r) => r.status === 'approved' || r.status === 'invited');
  const invitedIds = new Set(rows.filter((r) => r.status !== 'declined' && r.status !== 'revoked' && r.status !== 'expired').map((r) => r.user_id));

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const statusBadge = (r: EventAccessRow) =>
    r.status === 'approved' ? (
      <Badge label={t('access.approved')} tone="success" />
    ) : (
      <Badge label={t('access.invitedUntil', { date: r.expires_at ? formatDay(r.expires_at) : '—' })} tone="amber" />
    );

  return (
    <Card style={{ gap: 12, padding: 20 }}>
      <Text variant="h3">{isPrivate ? t('access.title') : t('access.invitesTitle')}</Text>
      {isPrivate ? <Text variant="caption">{t('access.privateBody')}</Text> : null}

      {requests.length ? (
        <View style={{ gap: 10 }}>
          <Text variant="label">{t('access.requests', { count: requests.length })}</Text>
          {requests.map((r) => (
            <View key={r.user_id} style={{ gap: 8 }}>
              <Row gap={10}>
                <Avatar name={r.name} size={36} color={colors.purpleTint} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodySm" weight="medium">{r.name}</Text>
                  {r.note ? <Text variant="caption">“{r.note}”</Text> : null}
                </View>
              </Row>
              <Row gap={8}>
                <Button title={t('access.approve')} onPress={() => run(() => respond.mutateAsync({ eventId, userId: r.user_id, approve: true }))} loading={respond.isPending} style={{ height: 40, flex: 1 }} />
                <Button title={t('access.decline')} variant="outline" onPress={() => run(() => respond.mutateAsync({ eventId, userId: r.user_id, approve: false }))} disabled={respond.isPending} style={{ height: 40, flex: 1 }} />
              </Row>
            </View>
          ))}
          <Divider color={colors.cardBorder} />
        </View>
      ) : null}

      {people.length ? (
        <View style={{ gap: 8 }}>
          <Text variant="label">{t('access.people', { count: people.length })}</Text>
          {people.map((r) => (
            <Row key={r.user_id} gap={10} style={{ justifyContent: 'space-between' }}>
              <Row gap={10} style={{ flex: 1 }}>
                <Avatar name={r.name} size={32} color={colors.purpleTint} />
                <Text variant="bodySm" style={{ flexShrink: 1 }}>{r.name}</Text>
              </Row>
              {statusBadge(r)}
              <Pressable accessibilityRole="button" accessibilityLabel={t('access.revoke')} onPress={() => run(() => revoke.mutateAsync({ eventId, userId: r.user_id }))} style={{ padding: 6 }}>
                <Icon name="x" size={16} color={colors.muted} />
              </Pressable>
            </Row>
          ))}
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text variant="label">{t('access.invite')}</Text>
        <SearchField value={q} onChangeText={setQ} placeholder={t('taskForm.inviteSearch')} />
        {q.trim().length >= 2 ? (
          <View style={{ gap: 6 }}>
            {(search.data ?? []).length === 0 && !search.isPending ? <Text variant="caption">{t('taskForm.inviteNone')}</Text> : null}
            {(search.data ?? [])
              .filter((p) => !invitedIds.has(p.id))
              .map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  onPress={() => run(async () => { await invite.mutateAsync({ eventId, userIds: [p.id] }); setQ(''); })}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: pressed ? colors.track : colors.cream })}>
                  <Avatar name={p.full_name || p.email} size={32} color={colors.purpleTint} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodySm" weight="medium">{p.full_name || '—'}</Text>
                    <Text variant="caption">{[p.email, p.city].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Icon name="plus" size={18} color={colors.purple} />
                </Pressable>
              ))}
          </View>
        ) : null}
        <Button title={t('find.open')} icon="search" variant="outline" onPress={() => router.push({ pathname: '/events/[id]/find', params: { id: eventId } })} />
      </View>
      {error ? <Text variant="caption" color={colors.danger}>{error}</Text> : null}
    </Card>
  );
}
