import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, Row } from '@/components/Layout';
import { Text } from '@/components/Text';
import { formatDay } from '@/lib/format';
import { colors, radius } from '@/theme/tokens';

import type { OrgEvent } from './api';
import { StatusBadge } from './components';

export function EventsTable({ events, compact }: { events: OrgEvent[]; compact: boolean }) {
  const { t } = useTranslation();
  const dates = (e: OrgEvent) => {
    const s = formatDay(e.starts_at);
    const sameDay = new Date(e.starts_at).toDateString() === new Date(e.ends_at).toDateString();
    return sameDay ? s : `${s} – ${formatDay(e.ends_at)}`;
  };
  const volunteers = (e: OrgEvent) => {
    const filled = e.seva_tasks.reduce((n, x) => n + x.volunteers_count, 0);
    const cap = e.seva_tasks.reduce((n, x) => n + (x.type === 'role' ? (x.positions ?? 0) : (x.max_volunteers ?? x.volunteers_count)), 0);
    return cap ? `${filled} / ${cap}` : String(filled);
  };
  const open = (e: OrgEvent) => router.push({ pathname: '/events/[id]', params: { id: e.id } });

  if (compact) {
    return (
      <View style={{ gap: 10 }}>
        {events.map((e) => (
          <Card key={e.id} onPress={() => open(e)} accessibilityLabel={e.title}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="title" style={{ flex: 1 }} numberOfLines={1}>{e.title}</Text>
              <StatusBadge status={e.status} />
            </Row>
            <Text variant="caption">
              {dates(e)} · {t('org.volunteers')} {e.status === 'draft' ? t('org.notPublished') : volunteers(e)}
            </Text>
          </Card>
        ))}
      </View>
    );
  }
  return (
    <Card style={{ padding: 0, gap: 0 }}>
      <View style={[styles.tr, styles.th]}>
        <Text variant="small" color={colors.muted} style={{ flex: 2.4 }}>{t('org.event')}</Text>
        <Text variant="small" color={colors.muted} style={{ flex: 1.4 }}>{t('org.dates')}</Text>
        <Text variant="small" color={colors.muted} style={{ flex: 1 }}>{t('org.status')}</Text>
        <Text variant="small" color={colors.muted} style={{ flex: 1 }}>{t('org.volunteers')}</Text>
        <View style={{ width: 96 }} />
      </View>
      {events.map((e) => (
        <View key={e.id} style={styles.tr}>
          <Text variant="label" style={{ flex: 2.4 }} numberOfLines={1}>{e.title}</Text>
          <Text variant="bodySm" style={{ flex: 1.4 }}>{dates(e)}</Text>
          <View style={{ flex: 1 }}>
            <StatusBadge status={e.status} />
          </View>
          <Text variant="bodySm" style={{ flex: 1 }}>{e.status === 'draft' ? t('org.notPublished') : volunteers(e)}</Text>
          <Button title={e.status === 'draft' ? t('org.continue') : t('org.manage')} variant="outline" onPress={() => open(e)} style={{ width: 96, height: 38, paddingHorizontal: 8 }} />
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  th: { borderTopWidth: 0, paddingVertical: 10, backgroundColor: colors.cream, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
});
