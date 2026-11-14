import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/Field';
import { Screen, TopBar } from '@/components/Layout';
import { Text } from '@/components/Text';
import { sendPasswordReset } from '@/features/auth/api';
import { colors } from '@/theme/tokens';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t('auth.errors.invalidEmail'));
    setError(null);
    setBusy(true);
    try {
      await sendPasswordReset(email);
    } catch {
      // Don't reveal whether the account exists.
    } finally {
      setBusy(false);
      setSent(true);
    }
  };

  return (
    <Screen title={t('auth.resetTitle')} maxWidth={460} header={<TopBar onBack={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))} />}>
      <View style={{ gap: 8, paddingTop: 12 }}>
        <Text variant="h1">{t('auth.resetTitle')}</Text>
        <Text variant="bodySm" color={colors.muted}>{t('auth.resetBody')}</Text>
      </View>
      {sent ? (
        <View style={{ padding: 14, borderRadius: 12, backgroundColor: colors.purpleTint }}>
          <Text variant="bodySm" color={colors.purpleDark}>{t('auth.resetSent')}</Text>
        </View>
      ) : (
        <>
          <TextField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            error={error ?? undefined}
            onSubmitEditing={submit}
          />
          <Button title={t('auth.resetSend')} size="lg" onPress={submit} loading={busy} />
        </>
      )}
    </Screen>
  );
}
