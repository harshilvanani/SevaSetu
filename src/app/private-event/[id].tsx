import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Badge } from '@/components/Chip';
import { TextField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Card, EmptyState, Row, Screen, TopBar } from '@/components/Layout';
import { Text } from '@/components/Text';
import { formatDay } from '@/lib/format';
import { accessErrorKey, useDeclineEventInvite, usePrivateEvents, usePrivateEventTasks, useRequestAccess } from '@/features/seva/private';
import { colors } from '@/theme/tokens';

export default function PrivateEventScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const events = usePrivateEvents();
  const event = events.data?.find((e) => e.id === id);
  const request = useRequestAccess();
  const decline = useDeclineEventInvite();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const hasAccess = event?.access === 'approved' || event?.access === 'invited';
  const tasks = usePrivateEventTasks(id, hasAccess);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/discover'));

  const send = async () => {
    setError(null);
    try {
      await request.mutateAsync({ eventId: id, note: note.trim() });
    } catch (e) {
      setError(t(accessErrorKey(e)));
    }
  };

  return (
    <Screen title={event?.title ?? t('access.privateEvent')} header={<TopBar onBack={back} title={t('access.privateEvent')} />} maxWidth={720}>
      {events.isPending ? (
        <Text variant="caption">{t('common.loading')}</Text>
      ) : !event ? (
        <EmptyState title={t('access.notFound')}>
          <Button title={t('common.goHome')} variant="outline" onPress={() => router.replace('/discover')} />
        </EmptyState>
      ) : (
        <View style={{ gap: 16 }}>
          <View style={{ gap: 6 }}>
            <Row gap={8} wrap>
              <Badge label={t('seva.private')} tone="amber" icon="lock" />
              {event.access === 'requested' ? <Badge label={t('access.pending')} tone="purple" /> : null}
              {event.access === 'approved' ? <Badge label={t('access.approved')} tone="success" /> : null}
              {event.access === 'invited' ? <Badge label={t('access.youAreInvited')} tone="amber" /> : null}
            </Row>
            <Text variant="h1">{event.title}</Text>
            <Text variant="bodySm" color={colors.muted}>{event.org_name} · {formatDay(event.starts_at)}</Text>
          </View>

          {hasAccess ? (
            <View style={{ gap: 10 }}>
              <Text variant="h3">{t('access.seva')}</Text>
              {(tasks.data ?? []).map((task) => (
                <Card key={task.id} onPress={() => router.push(`/seva/${task.id}`)} accessibilityLabel={task.title}>
                  <Row gap={10} style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="title">{task.title}</Text>
                      {task.starts_at ? <Text variant="caption">{formatDay(task.starts_at)}</Text> : null}
                    </View>
                    <Icon name="chevronRight" size={18} color={colors.muted} />
                  </Row>
                </Card>
              ))}
              {tasks.data && tasks.data.length === 0 ? <Text variant="caption">{t('access.noSeva')}</Text> : null}
              {event.access === 'invited' ? (
                <Pressable accessibilityRole="button" onPress={() => decline.mutate(id, { onSuccess: () => router.replace('/discover') })} style={{ alignSelf: 'center', padding: 6 }}>
                  <Text variant="label" color={colors.danger}>{t('access.declineInvite')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : event.access === 'requested' ? (
            <Card style={{ gap: 6 }}>
              <Text variant="title">{t('access.requestSent')}</Text>
              <Text variant="bodySm" color={colors.body}>{t('access.requestSentBody')}</Text>
            </Card>
          ) : (
            <Card style={{ gap: 12, padding: 20 }}>
              <Text variant="title">{t('access.requestTitle')}</Text>
              <Text variant="bodySm" color={colors.body}>
                {event.access === 'declined' || event.access === 'revoked' ? t('access.requestAgain') : t('access.requestBody')}
              </Text>
              <TextField label={t('access.note')} optional value={note} onChangeText={setNote} multiline maxLength={300} />
              {error ? <Text variant="caption" color={colors.danger}>{error}</Text> : null}
              <Button title={t('access.request')} size="lg" loading={request.isPending} onPress={send} />
            </Card>
          )}
        </View>
      )}
    </Screen>
  );
}
