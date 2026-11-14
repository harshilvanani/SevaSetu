import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Badge } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { Card, Row, SectionHeader } from '@/components/Layout';
import { Text } from '@/components/Text';
import { formatDay } from '@/lib/format';
import { colors } from '@/theme/tokens';

import { usePrivateEvents } from './private';

/** Discover section: private events anyone signed in can see exist, and ask to join. */
export function PrivateEventsSection() {
  const { t } = useTranslation();
  const events = usePrivateEvents();
  const list = events.data ?? [];
  if (!list.length) return null;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <SectionHeader title={t('access.discoverTitle')} />
        <Text variant="caption">{t('access.discoverHint')}</Text>
      </View>
      {list.map((e) => (
        <Card key={e.id} onPress={() => router.push({ pathname: '/private-event/[id]', params: { id: e.id } })} accessibilityLabel={e.title}>
          <Row gap={12}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.amberTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="lock" size={20} color={colors.amberText} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title">{e.title}</Text>
              <Text variant="caption">{e.org_name} · {formatDay(e.starts_at)}</Text>
            </View>
            {e.access === 'requested' ? <Badge label={t('access.pending')} tone="purple" /> : null}
            {e.access === 'approved' ? <Badge label={t('access.approved')} tone="success" /> : null}
            {e.access === 'invited' ? <Badge label={t('access.youAreInvited')} tone="amber" /> : null}
            <Icon name="chevronRight" size={18} color={colors.muted} />
          </Row>
        </Card>
      ))}
    </View>
  );
}
