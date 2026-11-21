import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { useConfirm } from '@/components/ConfirmDialog';
import { Badge } from '@/components/Chip';
import { Icon, type IconName } from '@/components/Icon';
import { Card, Divider, Row, Screen } from '@/components/Layout';
import { Text } from '@/components/Text';
import { signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { type PersonType, type Slot, useMyOpenMatches, useMySummary } from '@/features/insights/api';
import { TeamsCard } from '@/features/insights/TeamsCard';
import { InsightCard, Volunteer360 } from '@/features/insights/Volunteer360';
import { useAvailability } from '@/features/profile/prefs';
import { useVolunteerStats } from '@/features/seva/api';
import i18n, { LOCALE_NAMES, type Locale, SUPPORTED_LOCALES } from '@/lib/i18n';
import { useInstallApp } from '@/lib/pwa';
import { useAppStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { colors, fonts, radius } from '@/theme/tokens';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { session, profile, memberships, refreshProfile } = useAuth();
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const { ask, dialog } = useConfirm();
  const install = useInstallApp();

  const stats = useVolunteerStats();
  const summary = useMySummary();
  const slots = useAvailability();
  const matches = useMyOpenMatches();
  const refetchStats = stats.refetch;
  const refetchSummary = summary.refetch;
  // Tabs stay mounted: refresh totals whenever this screen comes back into view.
  useFocusEffect(
    useCallback(() => {
      refetchStats();
      refetchSummary();
    }, [refetchStats, refetchSummary]),
  );

  if (!session || !profile) {
    return (
      <Screen title={t('profile.title')} maxWidth={560}>
        <View style={{ paddingTop: 24, gap: 12 }}>
          <Text variant="h1">{t('profile.guestTitle')}</Text>
          <Text variant="body" color={colors.body}>{t('profile.guestBody')}</Text>
        </View>
        <Button title={t('auth.createAccount')} size="lg" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'create' } })} />
        <Button title={t('auth.signIn')} variant="outline" size="lg" onPress={() => router.push('/sign-in')} />
        <LanguagePicker />
      </Screen>
    );
  }

  const setLocale = async (l: Locale) => {
    i18n.changeLanguage(l);
    await supabase.from('profiles').update({ locale: l }).eq('id', profile.id);
    refreshProfile();
  };

  const switchMode = () => {
    const next = mode === 'organizer' ? 'volunteer' : 'organizer';
    setMode(next);
    router.navigate(next === 'organizer' ? '/dashboard' : '/discover');
  };

  const confirmDelete = () =>
    ask({
      title: t('profile.deleteAccount'),
      body: t('profile.deleteConfirm'),
      confirmLabel: t('common.delete'),
      destructive: true,
      onConfirm: async () => {
        const { error } = await supabase.rpc('delete_my_account');
        if (error) throw new Error(error.message.includes('sole_org_owner') ? t('profile.soleOwner') : t('common.somethingWrong'));
        await signOut();
      },
    });

  return (
    <Screen title={t('profile.title')} maxWidth={1180}>
      {dialog}
      <Volunteer360
        mine
        person={{
          full_name: profile.full_name,
          email: profile.email,
          code: summary.data?.code,
          person_type: (profile.person_type as PersonType) ?? 'volunteer',
          is_active: summary.data?.is_active,
          city: profile.city,
          region: profile.region,
          profession: profile.profession,
          linkedin_url: profile.linkedin_url,
          linkedin_consent: profile.linkedin_consent,
          interests: profile.interests,
          skills: profile.skills,
          skill_levels: (profile.skill_levels ?? {}) as Record<string, string>,
          languages: profile.languages ?? [],
          courses: profile.courses ?? [],
          availability: (slots.data ?? []) as Slot[],
          hours: summary.data?.hours ?? stats.data?.verified_hours ?? 0,
          events_count: summary.data?.events_count ?? 0,
          joined_at: summary.data?.joined_at ?? profile.created_at,
        }}
        insight={
          <>
            <InsightCard
              title={t('v360.insightTitle')}
              body={matches.data ? t('v360.insightBody', { count: matches.data }) : t('v360.insightNone')}
              action={t('v360.viewMatches')}
              onPress={() => router.navigate('/discover')}
            />
            <TeamsCard />
          </>
        }
      />

      <Card style={{ padding: 0, gap: 0 }}>
        <MenuItem icon="user" label={t('v360.editProfile')} hint={t('v360.editProfileHint')} onPress={() => router.push('/profile/edit')} />
        <Divider color={colors.cardBorder} />
        <MenuItem icon="edit" label={t('profile.editDetails')} onPress={() => router.push('/availability')} />
        {memberships.length > 0 ? (
          <>
            <Divider color={colors.cardBorder} />
            <MenuItem
              icon="swap"
              label={mode === 'organizer' ? t('profile.switchToVolunteer') : t('profile.switchToOrganizer')}
              hint={mode === 'organizer' ? undefined : t('profile.organizerHint')}
              onPress={switchMode}
            />
          </>
        ) : null}
        {memberships.map((m) => (
          <View key={m.org_id}>
            <Divider color={colors.cardBorder} />
            <Row style={styles.item}>
              <Icon name="users" size={20} color={colors.subtle} />
              <Text variant="bodySm" weight="medium" style={{ flex: 1 }}>{m.organizations?.name}</Text>
              {m.organizations?.status === 'pending' ? <Badge label={t('profile.orgPending')} tone="amber" /> : null}
              {m.organizations?.status === 'rejected' ? <Badge label={t('profile.orgRejected')} tone="danger" /> : null}
              {m.organizations?.status === 'suspended' ? <Badge label={t('profile.orgSuspended')} tone="danger" /> : null}
            </Row>
            {(m.organizations?.status === 'rejected' || m.organizations?.status === 'suspended') && m.organizations.review_note ? (
              <Text variant="caption" style={{ paddingHorizontal: 16, paddingBottom: 10, marginTop: -4 }}>
                {t('profile.reviewNote', { note: m.organizations.review_note })}
              </Text>
            ) : null}
            {m.organizations?.status === 'rejected' && m.role === 'owner' ? (
              <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                <Button title={t('profile.resubmit')} variant="outline" onPress={() => router.push({ pathname: '/organizations/new', params: { id: m.org_id } })} />
              </View>
            ) : null}
          </View>
        ))}
        <Divider color={colors.cardBorder} />
        <MenuItem icon="plus" label={t('profile.startOrg')} hint={t('profile.startOrgHint')} onPress={() => router.push('/organizations/new')} />
        {profile.is_platform_admin ? (
          <>
            <Divider color={colors.cardBorder} />
            <MenuItem icon="shield" label={t('profile.adminConsole')} onPress={() => router.push('/admin')} />
          </>
        ) : null}
        {install.status !== 'none' ? (
          <>
            <Divider color={colors.cardBorder} />
            <MenuItem
              icon="bookmark"
              label={t('profile.installApp')}
              hint={t('profile.installHint')}
              onPress={() =>
                install.status === 'prompt'
                  ? install.install()
                  : ask({ title: t('profile.installApp'), body: t('profile.installIos'), confirmLabel: t('common.ok'), hideCancel: true, onConfirm: () => {} })
              }
            />
          </>
        ) : null}
      </Card>

      <LanguagePicker value={(profile.locale as Locale) ?? 'en'} onChange={setLocale} />

      <Row gap={16} style={{ justifyContent: 'center' }}>
        <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')} style={{ padding: 6 }}>
          <Text variant="label" color={colors.purple}>{t('auth.privacy')}</Text>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push('/terms')} style={{ padding: 6 }}>
          <Text variant="label" color={colors.purple}>{t('auth.terms')}</Text>
        </Pressable>
      </Row>

      <Button title={t('common.signOut')} icon="logout" variant="outline" onPress={signOut} />
      <Pressable accessibilityRole="button" onPress={confirmDelete} style={{ alignSelf: 'center', padding: 12 }}>
        <Text variant="bodySm" color={colors.danger}>{t('profile.deleteAccount')}</Text>
      </Pressable>
    </Screen>
  );
}

function MenuItem({ icon, label, hint, onPress }: { icon: IconName; label: string; hint?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.cream }]}>
      <Icon name={icon} size={20} color={colors.subtle} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodySm" weight="medium">{label}</Text>
        {hint ? <Text variant="caption">{hint}</Text> : null}
      </View>
      <Icon name="chevronRight" size={18} color={colors.muted} />
    </Pressable>
  );
}

function LanguagePicker({ value, onChange }: { value?: Locale; onChange?: (l: Locale) => void }) {
  const { t } = useTranslation();
  const current = value ?? (i18n.language as Locale);
  return (
    <View style={{ gap: 8 }}>
      <Text variant="label">{t('profile.language')}</Text>
      <View accessibilityRole="radiogroup" style={styles.langRow}>
        {SUPPORTED_LOCALES.map((l) => {
          const active = l === current;
          return (
            <Pressable
              key={l}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => (onChange ? onChange(l) : i18n.changeLanguage(l))}
              style={[styles.lang, active && styles.langActive]}>
              <Text style={{ fontFamily: active ? fonts.semibold : fonts.regular, color: active ? colors.white : colors.text }}>{LOCALE_NAMES[l]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 56, paddingVertical: 10 },
  langRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  lang: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langActive: { backgroundColor: colors.purple, borderColor: colors.purple },
});
