import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState, Row, Screen, useLayout } from '@/components/Layout';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { type CalendarView, SevaCalendar } from '@/features/insights/Calendar';
import { useOrgEvents } from '@/features/org/api';
import { OrganizerGate, OrgSwitcher } from '@/features/org/components';
import { EventsTable } from '@/features/org/EventsTable';

export default function EventsScreen() {
  return <OrganizerGate>{(org) => <EventsList orgId={org.id} />}</OrganizerGate>;
}

type View_ = 'list' | CalendarView;

function EventsList({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const { isPhone } = useLayout();
  const params = useLocalSearchParams<{ view?: string }>();
  const events = useOrgEvents(orgId);
  const [view, setView] = useState<View_>(params.view === 'month' || params.view === 'week' || params.view === 'agenda' ? params.view : 'list');
  const all = [...(events.data ?? [])].sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const items = all
    .filter((e) => e.status !== 'cancelled')
    .map((e) => {
      const positions = e.seva_tasks.filter((x) => x.type === 'role').reduce((n, x) => n + (x.positions ?? 0), 0);
      const filled = e.seva_tasks.filter((x) => x.type === 'role').reduce((n, x) => n + Math.min(x.volunteers_count, x.positions ?? 0), 0);
      return {
        id: e.id,
        title: e.title,
        start: e.starts_at,
        end: e.ends_at,
        sub: [e.city, t(`availability.modes.${e.mode}`)].filter(Boolean).join(' · '),
        meta: positions ? t('insights.filledOf', { filled, total: positions }) : t(`org.statuses.${e.status}`),
        tone: (e.status === 'draft' ? 'plain' : e.status === 'completed' ? 'green' : positions && filled < positions * 0.6 ? 'orange' : 'purple') as 'plain' | 'green' | 'orange' | 'purple',
        onPress: () => router.push({ pathname: '/events/[id]', params: { id: e.id } }),
      };
    });

  return (
    <Screen title={t('org.events')} maxWidth={1180} refreshing={events.isRefetching} onRefresh={() => events.refetch()}>
      <Row style={{ justifyContent: 'space-between', paddingTop: 8 }} wrap gap={12}>
        <Text variant="h1">{t('nav.eventsCalendar')}</Text>
        <Button title={t('org.createEvent')} icon="plus" onPress={() => router.push('/events/new')} />
      </Row>
      <OrgSwitcher />
      <Segmented<'list' | 'calendar'>
        label={t('calendar.view')}
        value={view === 'list' ? 'list' : 'calendar'}
        onChange={(v) => setView(v === 'list' ? 'list' : 'month')}
        options={[
          { value: 'list', label: t('calendar.list') },
          { value: 'calendar', label: t('calendar.calendar') },
        ]}
      />
      {events.isPending ? (
        <Text variant="caption">{t('common.loading')}</Text>
      ) : all.length === 0 ? (
        <EmptyState title={t('org.noEvents')} body={t('org.noEventsBody')} />
      ) : view === 'list' ? (
        <EventsTable events={all} compact={isPhone} />
      ) : (
        <View>
          <SevaCalendar items={items} view={view} onViewChange={setView} emptyText={t('org.noEventsBody')} />
        </View>
      )}
    </Screen>
  );
}
