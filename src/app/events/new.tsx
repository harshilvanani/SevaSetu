import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Screen, TopBar } from '@/components/Layout';
import { Text } from '@/components/Text';
import { useSaveEvent } from '@/features/org/api';
import { OrganizerGate } from '@/features/org/components';
import { EventForm, StepHeader } from '@/features/org/EventForm';
import { colors } from '@/theme/tokens';

export default function NewEventScreen() {
  const { t } = useTranslation();
  const save = useSaveEvent();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/dashboard'));
  return (
    <OrganizerGate>
      {(org) => (
        <Screen title={t('eventForm.newTitle')} header={<TopBar onBack={back} title={t('eventForm.newTitle')} />} maxWidth={1080}>
          <View style={{ gap: 12 }}>
            <Text variant="h1">{t('eventForm.newTitle')}</Text>
            <Text variant="bodySm" color={colors.muted}>{t('eventForm.intro')}</Text>
            <StepHeader step={1} />
          </View>
          <EventForm
            orgName={org.name}
            busy={save.isPending}
            submitLabel={t('eventForm.saveContinue')}
            onSubmit={async (input) => {
              const id = await save.mutateAsync({ orgId: org.id, input });
              router.replace({ pathname: '/events/[id]', params: { id } });
            }}
          />
          {save.error ? <Text variant="caption" color={colors.danger}>{(save.error as Error).message}</Text> : null}
        </Screen>
      )}
    </OrganizerGate>
  );
}
