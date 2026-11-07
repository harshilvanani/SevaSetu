import * as Linking from 'expo-linking';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { Text } from '@/components/Text';
import { exchangeCodeFromUrl } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors } from '@/theme/tokens';

// OAuth / email-confirmation landing route.
export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  const { session } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' && url) exchangeCodeFromUrl(url).catch((e) => setError(String(e.message ?? e)));
  }, [url]);

  if (session) return <Redirect href="/" />;
  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <Text variant="h3">Sign-in didn&apos;t complete</Text>
        <Text variant="bodySm" color={colors.muted} align="center">{error}</Text>
        <Redirect href="/sign-in" />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.purple} />
    </View>
  );
}
