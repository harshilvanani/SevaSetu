import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Avatar, Card, EmptyState, Row, Screen, SectionHeader, useLayout } from '@/components/Layout';
import { Text } from '@/components/Text';
import { useCompleteAssignment, useOrgEvents, useProfileNames, useReviewQueue, useTaskAssignments } from '@/features/org/api';
import { OrganizerGate, OrgSwitcher } from '@/features/org/components';
import { ReviewCard } from '@/features/org/ReviewCard';
import { formatDay, formatRange } from '@/lib/format';
import { colors } from '@/theme/tokens';

export default function ReviewsScreen() {
  return <OrganizerGate>{(org) => <Reviews orgId={org.id} />}</OrganizerGate>;
}

function Reviews({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const { isDesktop } = useLayout();
  const queue = useReviewQueue(orgId);
  const events = useOrgEvents(orgId);
  const complete = useCompleteAssignment();

  // Role tasks that have started: confirm who served.
  const [now] = useState(() => Date.now());
  const roleTasks = (events.data ?? [])
    .filter((e) => e.status === 'published' || e.status === 'completed')
    .flatMap((e) => e.seva_tasks.filter((x) => x.type === 'role').map((x) => ({ ...x, event: e })))
    .filter((x) => new Date(x.starts_at ?? x.event.starts_at).getTime() < now);
  const assignments = useTaskAssignments(roleTasks.map((x) => x.id));
  const toConfirm = (assignments.data ?? []).filter((a) => a.status === 'active');
  const names = useProfileNames([...(queue.data ?? []).map((r) => r.assignments.volunteer_id), ...toConfirm.map((a) => a.volunteer_id)]);

  return (
    <Screen title={t('org.reviewsTitle')} maxWidth={1100} refreshing={queue.isRefetching} onRefresh={() => { queue.refetch(); assignments.refetch(); }}>
      <View style={{ gap: 4, paddingTop: 8 }}>
        <Text variant="h1">{t('org.reviewsTitle')}</Text>
        <Text variant="caption">{t('org.tasksNote')}</Text>
      </View>
      <OrgSwitcher />
      {queue.isPending ? (
        <Text variant="caption">{t('common.loading')}</Text>
      ) : queue.data?.length ? (
        <View style={[{ gap: 12 }, isDesktop && { flexDirection: 'row', flexWrap: 'wrap' }]}>
          {queue.data.map((r) => (
            <View key={r.id} style={isDesktop ? { flexBasis: '48%', flexGrow: 1 } : undefined}>
              <ReviewCard item={r} name={names.data?.[r.assignments.volunteer_id] ?? '—'} />
            </View>
          ))}
        </View>
      ) : (
        <EmptyState title={t('org.noReviews')} body={t('org.noReviewsBody')} />
      )}

      {toConfirm.length ? (
        <View style={{ gap: 12 }}>
          <View style={{ gap: 2 }}>
            <SectionHeader title={t('org.attendance')} />
            <Text variant="caption">{t('org.attendanceBody')}</Text>
          </View>
          {toConfirm.map((a) => {
            const task = roleTasks.find((x) => x.id === a.task_id)!;
            const start = task.starts_at ?? task.event.starts_at;
            const name = names.data?.[a.volunteer_id] ?? '—';
            return (
              <Card key={a.id}>
                <Row gap={12}>
                  <Avatar name={name} size={36} color={colors.purpleTint} />
                  <View style={{ flex: 1 }}>
                    <Text variant="label">{name}</Text>
                    <Text variant="caption">
                      {task.title} · {formatDay(start)} · {formatRange(start, task.ends_at ?? task.event.ends_at)}
                    </Text>
                  </View>
                  <Button title={t('org.markServed')} icon="check" variant="outline" onPress={() => complete.mutate(a.id)} loading={complete.isPending && complete.variables === a.id} />
                </Row>
              </Card>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}
