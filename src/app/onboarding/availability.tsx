import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { Slot } from '@/domain/seva';
import { useAuth } from '@/features/auth/AuthProvider';
import { AvailabilityGrid, ServePrefsEditor } from '@/features/profile/editors';
import { OnboardingFrame } from '@/features/profile/OnboardingFrame';
import { useAvailability, useSaveAvailability, useSaveProfile } from '@/features/profile/prefs';

export default function OnboardingAvailability() {
  const existing = useAvailability();
  if (!existing.data) return null;
  return <AvailabilityStep initialSlots={existing.data} />;
}

function AvailabilityStep({ initialSlots }: { initialSlots: Slot[] }) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const saveSlots = useSaveAvailability();
  const saveProfile = useSaveProfile();
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [prefs, setPrefs] = useState({
    serve_mode: (profile?.serve_mode ?? 'either') as 'onsite' | 'virtual' | 'either',
    hours_per_week: (profile?.hours_per_week ?? null) as '1-2' | '3-5' | '6+' | null,
  });

  const next = async () => {
    await Promise.all([saveSlots.mutateAsync(slots), saveProfile.mutateAsync(prefs)]);
    router.push('/onboarding/review');
  };

  return (
    <OnboardingFrame
      step={3}
      title={t('onboarding.availabilityTitle')}
      body={t('onboarding.availabilityBody')}
      onPrimary={next}
      onSkip={() => router.push('/onboarding/review')}
      busy={saveSlots.isPending || saveProfile.isPending}>
      <View style={{ gap: 28 }}>
        <AvailabilityGrid slots={slots} onChange={setSlots} />
        <ServePrefsEditor serveMode={prefs.serve_mode} hours={prefs.hours_per_week} onChange={setPrefs} />
      </View>
    </OnboardingFrame>
  );
}
