import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen, TopBar } from '@/components/Layout';
import { Text } from '@/components/Text';
import { useSaveCampaign } from '@/features/donations/api';
import { CampaignForm } from '@/features/donations/CampaignForm';
import { OrganizerGate } from '@/features/org/components';
import { colors } from '@/theme/tokens';

export default function NewCampaignScreen() {
  const { t } = useTranslation();
  const save = useSaveCampaign();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/donations'));
  return (
    <OrganizerGate>
      {(org) => (
        <Screen title={t('donations.new')} header={<TopBar onBack={back} title={t('donations.new')} />} maxWidth={760}>
          <Text variant="h1">{t('donations.new')}</Text>
          <CampaignForm
            busy={save.isPending}
            onSubmit={async (input) => {
              const id = await save.mutateAsync({ orgId: org.id, input });
              router.replace({ pathname: '/donations/[id]', params: { id } });
            }}
          />
          {save.error ? <Text variant="caption" color={colors.danger}>{(save.error as Error).message}</Text> : null}
        </Screen>
      )}
    </OrganizerGate>
  );
}
