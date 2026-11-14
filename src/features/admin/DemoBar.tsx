import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors } from '@/theme/tokens';

import { enterDemo, exitDemo, getDemoStash, type DemoPersona } from './demo';

/** Banner shown while viewing the app as a demo person (set up by an admin from the Demo mode page). */
export function DemoBar() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (!profile?.is_demo) return null;

  const stash = getDemoStash();
  const others = (stash?.accounts ?? []).filter((a) => a.user_id !== profile.id && a.persona !== 'volunteer2');
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(false);
    try {
      await fn();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View accessibilityRole="alert" style={[styles.bar, { paddingTop: Platform.OS === 'web' ? 8 : insets.top + 8 }]}>
      <Text variant="label" color={colors.white} style={{ flexShrink: 1 }}>
        {t('admin.demo.banner', { name: profile.full_name })}
      </Text>
      <View style={styles.actions}>
        {error ? <Text variant="caption" color={colors.white}>{t('admin.demo.signInFailed')}</Text> : null}
        {others.map((a) => (
          <Button
            key={a.persona}
            variant="outlineLight"
            disabled={busy}
            title={t('admin.demo.switchTo', { who: t(`admin.demo.${a.persona as DemoPersona}`) })}
            onPress={() => run(() => enterDemo(stash!.accounts, a.persona, qc))}
          />
        ))}
        {stash ? <Button variant="light" disabled={busy} title={t('admin.demo.backToAdmin')} onPress={() => run(() => exitDemo(qc))} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.plum,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
});
