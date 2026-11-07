import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/Field';
import { Screen } from '@/components/Layout';
import { Text } from '@/components/Text';
import { exchangeCodeFromUrl, updatePassword } from '@/features/auth/api';
import { colors } from '@/theme/tokens';

// Opened from the password-reset email (deep link on native, URL on web).
export default function ResetPassword() {
  const { t } = useTranslation();
  const url = Linking.useLinkingURL();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // On web the Supabase client exchanges the code itself (detectSessionInUrl).
    if (Platform.OS !== 'web' && url) exchangeCodeFromUrl(url).catch((e) => setError(String(e.message ?? e)));
  }, [url]);

  const submit = async () => {
    if (password.length < 8) return setError(t('auth.errors.passwordShort'));
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen maxWidth={460}>
      <View style={{ gap: 8, paddingTop: 32 }}>
        <Text variant="h1">{t('auth.newPasswordTitle')}</Text>
      </View>
      <TextField
        label={t('auth.newPassword')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint={t('auth.passwordHint')}
        error={error ?? undefined}
        onSubmitEditing={submit}
      />
      <Button title={t('auth.updatePassword')} size="lg" onPress={submit} loading={busy} />
      <Text variant="caption" color={colors.muted}> </Text>
    </Screen>
  );
}
