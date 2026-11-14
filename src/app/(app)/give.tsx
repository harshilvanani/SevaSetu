import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, EmptyState, Row, Screen } from '@/components/Layout';
import { ProgressBar } from '@/components/ProgressBar';
import { Text } from '@/components/Text';
import { formatCad } from '@/domain/donations';
import { useActiveCampaigns } from '@/features/donations/api';
import { colors } from '@/theme/tokens';

export default function GiveScreen() {
  const { t } = useTranslation();
  const campaigns = useActiveCampaigns();
  const list = campaigns.data ?? [];
  return (
    <Screen title={t('nav.give')} maxWidth={960} refreshing={campaigns.isRefetching} onRefresh={() => campaigns.refetch()}>
      <View style={{ gap: 6, paddingTop: 8 }}>
        <Text variant="h1">{t('give.title')}</Text>
        <Text variant="body" color={colors.body}>{t('give.intro')}</Text>
      </View>
      {campaigns.isPending ? <Text variant="caption">{t('common.loading')}</Text> : null}
      {campaigns.data && list.length === 0 ? <EmptyState title={t('give.empty')} /> : null}
      <Row gap={12} wrap style={{ alignItems: 'stretch' }}>
        {list.map((c) => (
          <Card key={c.id} onPress={() => router.push({ pathname: '/give/[id]', params: { id: c.id } })} accessibilityLabel={c.title} style={{ gap: 8, flexBasis: 300, flexGrow: 1 }}>
            <Text variant="title">{c.title}</Text>
            <Text variant="caption">{c.organizations.name}</Text>
            {c.description ? <Text variant="bodySm" color={colors.body} numberOfLines={3}>{c.description}</Text> : null}
            {c.goal_cents ? <ProgressBar value={Math.min(1, Number(c.raised_cents) / c.goal_cents)} /> : null}
            <Text variant="caption">
              {c.goal_cents
                ? t('donations.raisedOfGoal', { raised: formatCad(Number(c.raised_cents)), goal: formatCad(c.goal_cents) })
                : t('donations.raised', { raised: formatCad(Number(c.raised_cents)) })}
            </Text>
          </Card>
        ))}
      </Row>
    </Screen>
  );
}
