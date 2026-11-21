import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen, TopBar } from '@/components/Layout';
import { Text } from '@/components/Text';
import { useOrgEvent, useSaveEvent } from '@/features/org/api';
import { OrganizerGate } from '@/features/org/components';
import { EventForm, StepHeader } from '@/features/org/EventForm';
import { colors } from '@/theme/tokens';

export default function EditEventScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useOrgEvent(id);
  const save = useSaveEvent();
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/events/[id]', params: { id } }));
  return (
    <OrganizerGate>
      {(org) => (
        <Screen title={t('eventForm.editTitle')} header={<TopBar onBack={back} title={t('eventForm.editTitle')} />} maxWidth={1080}>
          <Text variant="h1">{t('eventForm.editTitle')}</Text>
          {event.data?.event.status === 'draft' ? <StepHeader step={1} /> : null}
          {event.data ? (
            <EventForm
              orgId={org.id}
                  orgName={org.name}
              initial={event.data.event}
              details={event.data.details}
              busy={save.isPending}
              submitLabel={t('common.save')}
              onSubmit={async (input) => {
                await save.mutateAsync({ id, orgId: org.id, input });
                back();
              }}
            />
          ) : (
            <Text variant="caption">{t('common.loading')}</Text>
          )}
          {save.error ? <Text variant="caption" color={colors.danger}>{(save.error as Error).message}</Text> : null}
        </Screen>
      )}
    </OrganizerGate>
  );
}
