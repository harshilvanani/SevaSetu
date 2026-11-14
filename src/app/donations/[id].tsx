import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Badge } from '@/components/Chip';
import { useConfirm } from '@/components/ConfirmDialog';
import { Card, Divider, EmptyState, Row, Screen, TopBar } from '@/components/Layout';
import { Text } from '@/components/Text';
import { formatCad } from '@/domain/donations';
import { useCampaign, useCampaignDonations, useDeleteCampaign, useSaveCampaign } from '@/features/donations/api';
import { CampaignForm } from '@/features/donations/CampaignForm';
import { OrganizerGate } from '@/features/org/components';
import { downloadCsv, fileSlug, toCsv } from '@/lib/csv';
import { formatDateTime } from '@/lib/format';
import { colors } from '@/theme/tokens';

export default function CampaignScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const campaign = useCampaign(id);
  const donations = useCampaignDonations(id);
  const save = useSaveCampaign();
  const del = useDeleteCampaign();
  const { ask, dialog } = useConfirm();
  const [saved, setSaved] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/donations'));
  const c = campaign.data;

  const exportCsv = () => {
    const rows = [
      [t('donations.csv.date'), t('donations.csv.name'), t('donations.csv.email'), t('donations.csv.amount'), t('donations.csv.fee'), t('donations.csv.type'), t('donations.csv.status')],
      ...(donations.data ?? []).map((d) => [
        (d.paid_at ?? d.created_at).slice(0, 10),
        d.donor_name ?? '',
        d.donor_email ?? '',
        (d.amount_cents / 100).toFixed(2),
        (d.fee_cents / 100).toFixed(2),
        d.interval === 'month' ? t('donations.monthly') : t('donations.oneTime'),
        t(`donations.donationStatus.${d.status}`),
      ]),
    ];
    downloadCsv(`${fileSlug(c?.title ?? 'donations')}-donations-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  };

  return (
    <OrganizerGate>
      {(org) => (
        <Screen title={c?.title ?? t('nav.donations')} header={<TopBar onBack={back} title={t('nav.donations')} />} maxWidth={900}>
          {dialog}
          {!c ? (
            <Text variant="caption">{t('common.loading')}</Text>
          ) : (
            <View style={{ gap: 20 }}>
              <Row gap={10} wrap style={{ justifyContent: 'space-between' }}>
                <Text variant="h1" style={{ flexShrink: 1 }}>{c.title}</Text>
                {c.status === 'active' ? (
                  <Button title={t('donations.viewPublic')} icon="share" variant="outline" onPress={() => router.push({ pathname: '/give/[id]', params: { id: c.id } })} />
                ) : null}
              </Row>
              <CampaignForm
                key={c.id + c.status}
                initial={c}
                busy={save.isPending}
                onSubmit={async (input) => {
                  await save.mutateAsync({ id: c.id, orgId: org.id, input });
                  setSaved(true);
                }}
              />
              {saved ? <Text variant="caption" color={colors.success}>{t('admin.templates.saved')}</Text> : null}

              <Card style={{ gap: 12, padding: 20 }}>
                <Row gap={10} wrap style={{ justifyContent: 'space-between' }}>
                  <Text variant="h3">{t('donations.received')}</Text>
                  {(donations.data ?? []).length ? <Button title={t('donations.downloadCsv')} icon="inbox" variant="outline" onPress={exportCsv} /> : null}
                </Row>
                <Text variant="caption">
                  {t('donations.raised', { raised: formatCad(Number(c.raised_cents)) })} · {t('donations.donors', { count: c.donors_count })}
                </Text>
                {(donations.data ?? []).length === 0 ? <EmptyState title={t('donations.none')} /> : null}
                {(donations.data ?? []).map((d) => (
                  <View key={d.id} style={{ gap: 6 }}>
                    <Divider color={colors.cardBorder} />
                    <Row gap={10} wrap style={{ justifyContent: 'space-between' }}>
                      <View style={{ flex: 1, minWidth: 180 }}>
                        <Text variant="bodySm" weight="medium">{d.donor_name || '—'}</Text>
                        <Text variant="caption">{[d.donor_email, formatDateTime(d.paid_at ?? d.created_at)].filter(Boolean).join(' · ')}</Text>
                      </View>
                      <Text variant="label">{formatCad(d.amount_cents)}</Text>
                      {d.interval === 'month' ? <Badge label={t('donations.monthly')} tone="purple" /> : null}
                      <Badge label={t(`donations.donationStatus.${d.status}`)} tone={d.status === 'paid' ? 'success' : d.status === 'refunded' ? 'amber' : 'neutral'} />
                    </Row>
                  </View>
                ))}
              </Card>

              {Number(c.raised_cents) === 0 ? (
                <Button
                  title={t('donations.delete')}
                  variant="danger"
                  onPress={() =>
                    ask({
                      title: t('donations.delete'),
                      body: c.title,
                      confirmLabel: t('common.delete'),
                      destructive: true,
                      onConfirm: async () => {
                        await del.mutateAsync(c.id);
                        router.replace('/donations');
                      },
                    })
                  }
                />
              ) : null}
            </View>
          )}
        </Screen>
      )}
    </OrganizerGate>
  );
}
