import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Card, EmptyState, Row, Screen, TopBar } from '@/components/Layout';
import { ProgressBar } from '@/components/ProgressBar';
import { Text } from '@/components/Text';
import { coverFeeCents, formatCad, MIN_DONATION_CENTS, parseDollars } from '@/domain/donations';
import { useAuth } from '@/features/auth/AuthProvider';
import { type CampaignWithOrg, useAcceptsDonations, useCampaign, useStartCheckout } from '@/features/donations/api';
import { colors } from '@/theme/tokens';

export default function GiveCampaignScreen() {
  const { t } = useTranslation();
  const { id, thanks } = useLocalSearchParams<{ id: string; thanks?: string }>();
  const campaign = useCampaign(id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/give'));
  const c = campaign.data;
  return (
    <Screen title={c?.title ?? t('nav.give')} header={<TopBar onBack={back} title={t('nav.give')} />} maxWidth={720}>
      {campaign.isPending ? (
        <Text variant="caption">{t('common.loading')}</Text>
      ) : !c ? (
        <EmptyState title={t('give.notFound')}>
          <Button title={t('give.seeAll')} variant="outline" onPress={() => router.replace('/give')} />
        </EmptyState>
      ) : (
        <View style={{ gap: 16 }}>
          {c.image_url ? <Image source={{ uri: c.image_url }} style={{ width: '100%', aspectRatio: 2, borderRadius: 16, backgroundColor: colors.track }} resizeMode="cover" /> : null}
          <View style={{ gap: 6 }}>
            <Text variant="h1">{c.title}</Text>
            <Text variant="bodySm" color={colors.muted}>{c.organizations.name}</Text>
          </View>
          {c.description ? <Text variant="body" color={colors.body}>{c.description}</Text> : null}
          <Card style={{ gap: 8 }}>
            {c.goal_cents ? <ProgressBar value={Math.min(1, Number(c.raised_cents) / c.goal_cents)} height={8} /> : null}
            <Text variant="label">
              {c.goal_cents
                ? t('donations.raisedOfGoal', { raised: formatCad(Number(c.raised_cents)), goal: formatCad(c.goal_cents) })
                : t('donations.raised', { raised: formatCad(Number(c.raised_cents)) })}
            </Text>
            <Text variant="caption">{t('donations.donors', { count: c.donors_count })}</Text>
          </Card>
          {thanks === '1' ? (
            <Card style={{ gap: 6, backgroundColor: colors.successTint }}>
              <Row gap={8}>
                <Icon name="heart" size={18} color={colors.success} />
                <Text variant="title" color={colors.success}>{t('give.thanksTitle')}</Text>
              </Row>
              <Text variant="bodySm" color={colors.body}>{t('give.thanksBody')}</Text>
            </Card>
          ) : (
            <DonateForm campaign={c} />
          )}
        </View>
      )}
    </Screen>
  );
}

function DonateForm({ campaign }: { campaign: CampaignWithOrg }) {
  const { t } = useTranslation();
  const { profile, session } = useAuth();
  const accepts = useAcceptsDonations(campaign.org_id);
  const checkout = useStartCheckout();
  const presets = campaign.presets?.length ? campaign.presets : [2500, 5000, 10000, 25000];
  const [preset, setPreset] = useState<number | null>(presets[1] ?? presets[0]);
  const [custom, setCustom] = useState('');
  const [monthly, setMonthly] = useState(false);
  const [coverFees, setCoverFees] = useState(true);
  const [name, setName] = useState(profile?.full_name ?? '');
  const [email, setEmail] = useState(profile?.email ?? session?.user.email ?? '');
  const [error, setError] = useState<string | null>(null);

  const amount = custom.trim() ? parseDollars(custom) : preset;
  const fee = amount && coverFees && campaign.allow_cover_fees ? coverFeeCents(amount) : 0;

  const donate = async () => {
    setError(null);
    if (!amount || amount < MIN_DONATION_CENTS) return setError(t('give.minAmount', { min: formatCad(MIN_DONATION_CENTS) }));
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(t('give.needDetails'));
    try {
      await checkout.mutateAsync({ campaignId: campaign.id, amountCents: amount, monthly: monthly && campaign.allow_monthly, coverFees: !!fee, name: name.trim(), email: email.trim() });
    } catch (e) {
      setError(t(`give.errors.${(e as Error).message}`, { defaultValue: t('give.errors.generic') }));
    }
  };

  if (accepts.data === false) {
    return (
      <Card style={{ gap: 6 }}>
        <Text variant="title">{t('give.soonTitle')}</Text>
        <Text variant="bodySm" color={colors.body}>{t('give.soonBody')}</Text>
      </Card>
    );
  }

  return (
    <Card style={{ gap: 16, padding: 20 }}>
      {campaign.allow_monthly ? (
        <Row gap={8}>
          <Chip label={t('donations.oneTime')} selected={!monthly} onPress={() => setMonthly(false)} />
          <Chip label={t('donations.monthly')} selected={monthly} onPress={() => setMonthly(true)} />
        </Row>
      ) : null}
      <View style={{ gap: 8 }}>
        <Text variant="label">{t('give.amount')}</Text>
        <Row gap={8} wrap>
          {presets.map((p) => (
            <Chip key={p} label={formatCad(p)} selected={!custom.trim() && preset === p} onPress={() => { setPreset(p); setCustom(''); }} />
          ))}
        </Row>
        <TextField label={t('give.other')} optional value={custom} onChangeText={setCustom} keyboardType="decimal-pad" placeholder="$" />
      </View>
      {campaign.allow_cover_fees && amount ? (
        <Chip label={t('give.coverFees', { fee: formatCad(coverFeeCents(amount)) })} selected={coverFees} onPress={() => setCoverFees(!coverFees)} />
      ) : null}
      <TextField label={t('give.name')} value={name} onChangeText={setName} autoComplete="name" />
      <TextField label={t('give.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" hint={t('give.emailHint')} />
      {error ? <Text variant="caption" color={colors.danger}>{error}</Text> : null}
      <Button
        title={amount ? (monthly ? t('give.donateMonthly', { amount: formatCad(amount + fee) }) : t('give.donate', { amount: formatCad(amount + fee) })) : t('give.donatePlain')}
        icon="heart"
        size="lg"
        loading={checkout.isPending}
        onPress={donate}
      />
      <Text variant="caption" align="center">{t('give.secure')}</Text>
    </Card>
  );
}
