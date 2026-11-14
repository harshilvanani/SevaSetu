import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Layout';
import { LogoMark } from '@/components/Logo';
import { Text } from '@/components/Text';
import { colors } from '@/theme/tokens';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <Screen title={t('common.notFoundTitle')} maxWidth={520}>
      <View style={{ alignItems: 'center', gap: 16, paddingTop: 80 }}>
        <LogoMark size={64} />
        <Text variant="h1" align="center">{t('common.notFoundTitle')}</Text>
        <Text variant="body" color={colors.body} align="center">{t('common.notFoundBody')}</Text>
        <Button title={t('common.goHome')} size="lg" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}
