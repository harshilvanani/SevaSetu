import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Badge } from '@/components/Chip';
import { Card, EmptyState, Row, Screen } from '@/components/Layout';
import { ProgressBar } from '@/components/ProgressBar';
import { Text } from '@/components/Text';
import { formatCad } from '@/domain/donations';
import { useOrgCampaigns, useOrgPayments, useStripeConnect } from '@/features/donations/api';
import { OrganizerGate, OrgSwitcher } from '@/features/org/components';
import { colors } from '@/theme/tokens';

export default function DonationsScreen() {
  return <OrganizerGate>{(org) => <Donations orgId={org.id} isDemo={!!org.is_demo} />}</OrganizerGate>;
}

function Donations({ orgId, isDemo }: { orgId: string; isDemo: boolean }) {
  const { t } = useTranslation();
  const { stripe } = useLocalSearchParams<{ stripe?: string }>();
  const payments = useOrgPayments(orgId);
  const connect = useStripeConnect();
  const campaigns = useOrgCampaigns(orgId);
  const p = payments.data;

  // Coming back from Stripe's onboarding: refresh whether the account can take payments.
  const refresh = connect.mutate;
  useEffect(() => {
    if (stripe === 'return' || stripe === 'refresh') refresh({ orgId, action: 'status' });
  }, [stripe, orgId, refresh]);

  const errorText = connect.error ? t(`donations.errors.${(connect.error as Error).message}`, { defaultValue: t('donations.errors.generic') }) : null;

  return (
    <Screen title={t('nav.donations')} maxWidth={1100} refreshing={campaigns.isRefetching} onRefresh={() => campaigns.refetch()}>
      <Row style={{ justifyContent: 'space-between', paddingTop: 8 }} gap={12} wrap>
        <Text variant="h1">{t('nav.donations')}</Text>
        <Button title={t('donations.new')} icon="plus" onPress={() => router.push('/donations/new')} />
      </Row>
      <OrgSwitcher />

      <Card style={{ gap: 10, padding: 20 }}>
        <Row gap={8} wrap>
          <Text variant="h3">{t('donations.stripeTitle')}</Text>
          {p?.charges_enabled ? (
            <Badge label={t('donations.connected')} tone="success" icon="check" />
          ) : p?.stripe_account_id ? (
            <Badge label={t('donations.setupIncomplete')} tone="amber" />
          ) : (
            <Badge label={t('donations.notConnected')} tone="neutral" />
          )}
        </Row>
        <Text variant="bodySm" color={colors.body}>
          {isDemo ? t('donations.demoBody') : p?.charges_enabled ? t('donations.connectedBody') : t('donations.connectBody')}
        </Text>
        {!isDemo ? (
          <Row gap={10} wrap>
            {!p?.charges_enabled ? (
              <Button
                title={p?.stripe_account_id ? t('donations.continueSetup') : t('donations.connect')}
                loading={connect.isPending && connect.variables?.action === 'link'}
                onPress={() => connect.mutate({ orgId, action: 'link' })}
              />
            ) : null}
            {p?.stripe_account_id ? (
              <Button title={t('donations.refresh')} variant="outline" loading={connect.isPending && connect.variables?.action === 'status'} onPress={() => connect.mutate({ orgId, action: 'status' })} />
            ) : null}
          </Row>
        ) : null}
        {errorText ? <Text variant="caption" color={colors.danger}>{errorText}</Text> : null}
      </Card>

      <View style={{ gap: 12 }}>
        <Text variant="h3">{t('donations.campaigns')}</Text>
        {campaigns.isPending ? <Text variant="caption">{t('common.loading')}</Text> : null}
        {campaigns.data && campaigns.data.length === 0 ? <EmptyState title={t('donations.noCampaigns')} body={t('donations.noCampaignsBody')} /> : null}
        {(campaigns.data ?? []).map((c) => (
          <Card key={c.id} onPress={() => router.push({ pathname: '/donations/[id]', params: { id: c.id } })} accessibilityLabel={c.title} style={{ gap: 8 }}>
            <Row gap={8} wrap style={{ justifyContent: 'space-between' }}>
              <Text variant="title" style={{ flexShrink: 1 }}>{c.title}</Text>
              <Badge label={t(`donations.statuses.${c.status}`)} tone={c.status === 'active' ? 'success' : 'neutral'} />
            </Row>
            <Text variant="caption">
              {c.goal_cents
                ? t('donations.raisedOfGoal', { raised: formatCad(Number(c.raised_cents)), goal: formatCad(c.goal_cents) })
                : t('donations.raised', { raised: formatCad(Number(c.raised_cents)) })}
              {' · '}
              {t('donations.donors', { count: c.donors_count })}
            </Text>
            {c.goal_cents ? <ProgressBar value={Math.min(1, Number(c.raised_cents) / c.goal_cents)} /> : null}
          </Card>
        ))}
      </View>
    </Screen>
  );
}
