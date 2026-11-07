import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, Row, Screen, useLayout } from '@/components/Layout';
import { Text } from '@/components/Text';
import type { Slot } from '@/domain/seva';
import { type Profile, useAuth } from '@/features/auth/AuthProvider';
import { AvailabilityGrid, InterestsEditor, LocationEditor, type LocationValue, ServePrefsEditor } from '@/features/profile/editors';
import { geocodeCity, useAvailability, useSaveAvailability, useSaveProfile } from '@/features/profile/prefs';
import { colors } from '@/theme/tokens';

export default function AvailabilityScreen() {
  const { t } = useTranslation();
  const { session, profile } = useAuth();
  const existing = useAvailability();

  if (!session) {
    return (
      <Screen maxWidth={560}>
        <View style={{ paddingTop: 24, gap: 12 }}>
          <Text variant="h1">{t('profile.guestTitle')}</Text>
          <Text variant="body" color={colors.body}>{t('profile.guestBody')}</Text>
        </View>
        <Button title={t('auth.signIn')} size="lg" onPress={() => router.push('/sign-in')} />
      </Screen>
    );
  }
  if (!profile || !existing.data) return <Screen><Text variant="caption">{t('common.loading')}</Text></Screen>;
  return <PreferencesForm profile={profile} initialSlots={existing.data} />;
}

function PreferencesForm({ profile, initialSlots }: { profile: Profile; initialSlots: Slot[] }) {
  const { t } = useTranslation();
  const { isDesktop } = useLayout();
  const saveSlots = useSaveAvailability();
  const saveProfile = useSaveProfile();
  const [saved, setSaved] = useState(false);
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [loc, setLoc] = useState<LocationValue>({
    city: profile.city ?? '',
    latitude: profile.latitude,
    longitude: profile.longitude,
    radius_km: profile.radius_km,
  });
  const [interests, setInterests] = useState({ interests: profile.interests, skills: profile.skills });
  const [prefs, setPrefs] = useState({
    serve_mode: profile.serve_mode,
    hours_per_week: (profile.hours_per_week as '1-2' | '3-5' | '6+' | null) ?? null,
  });

  const save = async () => {
    let { latitude, longitude } = loc;
    if (loc.city !== (profile.city ?? '') && latitude === profile.latitude) {
      const hit = await geocodeCity(loc.city);
      if (hit) ({ latitude, longitude } = hit);
    }
    await Promise.all([
      saveSlots.mutateAsync(slots),
      saveProfile.mutateAsync({ city: loc.city.trim() || null, latitude, longitude, radius_km: loc.radius_km, ...interests, ...prefs }),
    ]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const busy = saveSlots.isPending || saveProfile.isPending;

  return (
    <Screen
      maxWidth={960}
      footer={
        <Button title={saved ? t('availability.saved') : t('common.save')} icon={saved ? 'check' : undefined} size="lg" loading={busy} onPress={save} />
      }>
      <Text variant="h1" style={{ paddingTop: 8 }}>{t('availability.title')}</Text>
      <Card style={{ gap: 18, padding: 20 }}>
        <Text variant="h3">{t('onboarding.availabilityTitle')}</Text>
        <AvailabilityGrid slots={slots} onChange={setSlots} />
        <ServePrefsEditor serveMode={prefs.serve_mode} hours={prefs.hours_per_week} onChange={setPrefs} />
      </Card>
      <Row gap={20} style={isDesktop ? { alignItems: 'flex-start' } : { flexDirection: 'column', alignItems: 'stretch' }}>
        <Card style={{ gap: 18, padding: 20, flex: isDesktop ? 1 : undefined }}>
          <Text variant="h3">{t('onboarding.reviewLocation')}</Text>
          <LocationEditor value={loc} onChange={setLoc} />
        </Card>
        <Card style={{ gap: 18, padding: 20, flex: isDesktop ? 1 : undefined }}>
          <Text variant="h3">{t('onboarding.reviewInterests')}</Text>
          <InterestsEditor interests={interests.interests} skills={interests.skills} onChange={setInterests} />
        </Card>
      </Row>
    </Screen>
  );
}
