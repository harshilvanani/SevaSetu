import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/AuthProvider';
import { InterestsEditor } from '@/features/profile/editors';
import { OnboardingFrame } from '@/features/profile/OnboardingFrame';
import { useSaveProfile } from '@/features/profile/prefs';

export default function OnboardingInterests() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const save = useSaveProfile();
  const [value, setValue] = useState({ interests: profile?.interests ?? [], skills: profile?.skills ?? [] });

  const next = async () => {
    await save.mutateAsync(value);
    router.push('/onboarding/availability');
  };

  return (
    <OnboardingFrame
      step={2}
      title={t('onboarding.interestsTitle')}
      body={t('onboarding.interestsBody')}
      primaryLabel={value.interests.length ? t('onboarding.continueSelected', { count: value.interests.length }) : undefined}
      onPrimary={next}
      onSkip={() => router.push('/onboarding/availability')}
      busy={save.isPending}>
      <InterestsEditor interests={value.interests} skills={value.skills} onChange={setValue} />
    </OnboardingFrame>
  );
}
