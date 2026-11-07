import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/AuthProvider';
import { LocationEditor, type LocationValue } from '@/features/profile/editors';
import { OnboardingFrame } from '@/features/profile/OnboardingFrame';
import { geocodeCity, useSaveProfile } from '@/features/profile/prefs';

export default function OnboardingLocation() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const save = useSaveProfile();
  const [value, setValue] = useState<LocationValue>({
    city: profile?.city ?? '',
    latitude: profile?.latitude ?? null,
    longitude: profile?.longitude ?? null,
    radius_km: profile?.radius_km ?? 10,
  });

  const next = async () => {
    let { latitude, longitude } = value;
    if (latitude == null && value.city) {
      const hit = await geocodeCity(value.city);
      if (hit) ({ latitude, longitude } = hit);
    }
    await save.mutateAsync({ city: value.city.trim() || null, latitude, longitude, radius_km: value.radius_km });
    router.push('/onboarding/interests');
  };

  return (
    <OnboardingFrame
      step={1}
      title={t('onboarding.locationTitle')}
      body={t('onboarding.locationBody')}
      onPrimary={next}
      onSkip={() => router.push('/onboarding/interests')}
      busy={save.isPending}>
      <LocationEditor value={value} onChange={setValue} />
    </OnboardingFrame>
  );
}
