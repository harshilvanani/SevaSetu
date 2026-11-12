import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Screen, useLayout } from '@/components/Layout';
import { Text } from '@/components/Text';
import { colors, fonts } from '@/theme/tokens';

const STEPS = [
  { key: 'navLocation', href: '/onboarding/location' },
  { key: 'navInterests', href: '/onboarding/interests' },
  { key: 'navAvailability', href: '/onboarding/availability' },
  { key: 'navReview', href: '/onboarding/review' },
] as const;

export function OnboardingFrame({
  step,
  title,
  body,
  children,
  primaryLabel,
  onPrimary,
  onSkip,
  busy,
  footerNote,
}: {
  step: 1 | 2 | 3 | 4;
  title: string;
  body: string;
  children: ReactNode;
  primaryLabel?: string;
  onPrimary: () => void;
  onSkip?: () => void;
  busy?: boolean;
  footerNote?: string;
}) {
  const { t } = useTranslation();
  const { isDesktop } = useLayout();

  const header = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {step > 1 ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.iconBtn}>
            <Icon name="chevronLeft" size={22} />
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.subtle }}>{t('onboarding.step', { n: step })}</Text>
        {onSkip ? (
          <Pressable accessibilityRole="button" onPress={onSkip} style={[styles.iconBtn, { alignItems: 'flex-end', paddingRight: 8 }]}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.purple }}>{t('common.skip')}</Text>
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Onboarding progress"
        accessibilityValue={{ min: 1, max: 4, now: step }}
        style={styles.progress}>
        {[1, 2, 3, 4].map((n) => (
          <View key={n} style={[styles.seg, { backgroundColor: n <= step ? colors.purple : colors.divider }]} />
        ))}
      </View>
    </View>
  );

  return (
    <Screen title={title}
      maxWidth={isDesktop ? 1040 : 640}
      header={header}
      footer={
        <>
          <Button title={primaryLabel ?? t('common.continue')} size="lg" onPress={onPrimary} loading={busy} />
          <Text variant="caption" align="center">{footerNote ?? t('onboarding.changeLater')}</Text>
        </>
      }>
      <View style={[{ gap: 24 }, isDesktop && { flexDirection: 'row', gap: 48, alignItems: 'flex-start' }]}>
        {isDesktop ? (
          <View style={styles.stepList}>
            {STEPS.map((s, i) => {
              const n = i + 1;
              const done = n < step;
              const current = n === step;
              return (
                <View key={s.key} style={styles.stepItem}>
                  <View style={[styles.stepDot, (done || current) && { backgroundColor: colors.purple, borderColor: colors.purple }]}>
                    {done ? (
                      <Icon name="check" size={14} color={colors.white} strokeWidth={2.6} />
                    ) : (
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: current ? colors.white : colors.muted }}>{n}</Text>
                    )}
                  </View>
                  <Text style={{ fontFamily: current ? fonts.semibold : fonts.medium, fontSize: 15, color: current ? colors.text : colors.subtle }}>
                    {t(`onboarding.${s.key}`)}
                  </Text>
                </View>
              );
            })}
            <Text variant="caption" style={{ marginTop: 12 }}>{t('onboarding.optionalNote')}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 24 }}>
          <View style={{ gap: 8 }}>
            <Text variant="h1">{title}</Text>
            <Text variant="bodySm" color={colors.muted} style={{ lineHeight: 22 }}>{body}</Text>
          </View>
          {children}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { minWidth: 56, height: 44, justifyContent: 'center' },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 8, maxWidth: 640, width: '100%', alignSelf: 'center' },
  seg: { flex: 1, height: 4, borderRadius: 999 },
  stepList: { width: 280, gap: 18, paddingTop: 8 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
});
