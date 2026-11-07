import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Card, Row } from '@/components/Layout';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { OnboardingFrame } from '@/features/profile/OnboardingFrame';
import { useAvailability, useSaveProfile } from '@/features/profile/prefs';
import { colors } from '@/theme/tokens';

export default function OnboardingReview() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const slots = useAvailability();
  const save = useSaveProfile();

  const finish = async () => {
    await save.mutateAsync({ onboarded_at: new Date().toISOString() });
    router.replace('/discover');
  };

  const interests = [...(profile?.interests ?? []).map((k) => t(`interests.${k}`)), ...(profile?.skills ?? [])];

  return (
    <OnboardingFrame
      step={4}
      title={t('onboarding.reviewTitle')}
      body={t('onboarding.reviewBody')}
      primaryLabel={t('onboarding.reviewDiscover')}
      onPrimary={finish}
      busy={save.isPending}>
      <View style={{ gap: 12 }}>
        <Summary
          icon="mapPin"
          title={t('onboarding.reviewLocation')}
          value={profile?.city ? `${profile.city} · ${t('onboarding.withinKm', { km: profile.radius_km })}` : t('onboarding.notSet')}
          href="/onboarding/location"
        />
        <Summary
          icon="heart"
          title={t('onboarding.reviewInterests')}
          value={interests.length ? interests.join(', ') : t('onboarding.notSet')}
          href="/onboarding/interests"
        />
        <Summary
          icon="calendar"
          title={t('onboarding.reviewAvailability')}
          value={
            slots.data?.length
              ? `${t('onboarding.slotsSelected', { count: slots.data.length })} · ${t(`availability.modes.${profile?.serve_mode ?? 'either'}`)}`
              : t('onboarding.notSet')
          }
          href="/onboarding/availability"
        />
      </View>
    </OnboardingFrame>
  );
}

function Summary({ icon, title, value, href }: { icon: IconName; title: string; value: string; href: '/onboarding/location' | '/onboarding/interests' | '/onboarding/availability' }) {
  const { t } = useTranslation();
  return (
    <Card>
      <Row gap={12} style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.purpleTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={18} color={colors.purpleDark} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">{title}</Text>
          <Text variant="bodySm" color={colors.body}>{value}</Text>
        </View>
        <Pressable accessibilityRole="link" onPress={() => router.navigate(href)} hitSlop={10}>
          <Text variant="label" color={colors.purple}>{t('common.edit')}</Text>
        </Pressable>
      </Row>
    </Card>
  );
}
