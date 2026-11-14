import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/features/auth/AuthProvider';
import { View } from 'react-native';

import { Text } from '@/components/Text';
import { CoursesPicker, InterestsEditor } from '@/features/profile/editors';
import { OnboardingFrame } from '@/features/profile/OnboardingFrame';
import { useSaveProfile } from '@/features/profile/prefs';

export default function OnboardingInterests() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const save = useSaveProfile();
  const [value, setValue] = useState({ interests: profile?.interests ?? [], skills: profile?.skills ?? [] });
  const [courses, setCourses] = useState<string[]>(profile?.courses ?? []);

  const next = async () => {
    await save.mutateAsync({ ...value, courses });
    router.push('/onboarding/availability');
  };

  return (
    <OnboardingFrame
      step={2}
      title={t('onboarding.interestsTitle')}
      body={t('onboarding.interestsBody')}
      primaryLabel={value.interests.length ? t('onboarding.continueSelected', { count: value.interests.length }) : courses.length ? t('common.continue', { defaultValue: 'Continue' }) : undefined}
      onPrimary={next}
      onSkip={async () => {
        if (courses.length) await save.mutateAsync({ courses });
        router.push('/onboarding/availability');
      }}
      busy={save.isPending}>
      <InterestsEditor interests={value.interests} skills={value.skills} onChange={setValue} />
      <View style={{ gap: 10, paddingTop: 12 }}>
        <Text variant="h3">{t('courses.title')}</Text>
        <CoursesPicker value={courses} onChange={setCourses} hint={t('courses.hint')} />
      </View>
    </OnboardingFrame>
  );
}
