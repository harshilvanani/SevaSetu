import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { EmptyState, Row, Screen, useLayout } from '@/components/Layout';
import { Text } from '@/components/Text';
import { useOrgEvents } from '@/features/org/api';
import { OrganizerGate, OrgSwitcher } from '@/features/org/components';
import { EventsTable } from '@/features/org/EventsTable';

export default function EventsScreen() {
  return <OrganizerGate>{(org) => <EventsList orgId={org.id} />}</OrganizerGate>;
}

function EventsList({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const { isPhone } = useLayout();
  const events = useOrgEvents(orgId);
  const all = [...(events.data ?? [])].sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return (
    <Screen title={t('org.events')} maxWidth={1100} refreshing={events.isRefetching} onRefresh={() => events.refetch()}>
      <Row style={{ justifyContent: 'space-between', paddingTop: 8 }}>
        <Text variant="h1">{t('org.events')}</Text>
        <Button title={t('org.createEvent')} icon="plus" onPress={() => router.push('/events/new')} />
      </Row>
      <OrgSwitcher />
      {events.isPending ? (
        <Text variant="caption">{t('common.loading')}</Text>
      ) : all.length === 0 ? (
        <EmptyState title={t('org.noEvents')} body={t('org.noEventsBody')} />
      ) : (
        <EventsTable events={all} compact={isPhone} />
      )}
    </Screen>
  );
}
