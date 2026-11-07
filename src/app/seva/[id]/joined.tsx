import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Card, Divider, Row, Screen } from '@/components/Layout';
import { Text } from '@/components/Text';
import { taskEnd, taskStart, useTask } from '@/features/seva/api';
import { useTaskText } from '@/features/seva/components';
import { addToCalendar } from '@/lib/calendar';
import { colors, fonts } from '@/theme/tokens';

export default function JoinedScreen() {
  const { t } = useTranslation();
  const { id, qty } = useLocalSearchParams<{ id: string; qty?: string }>();
  const task = useTask(id);
  const text = useTaskText();
  const [calMsg, setCalMsg] = useState<string | null>(null);

  if (!task.data) return <Screen><Text variant="caption">{t('common.loading')}</Text></Screen>;
  const s = task.data;
  const n = Number(qty ?? 1);
  const start = taskStart(s);
  const isQty = s.type === 'quantity';
  const unit = s.unit ?? '';

  const calendar = async () => {
    if (!start) return;
    const ok = await addToCalendar({
      title: s.title,
      start,
      end: taskEnd(s),
      location: s.mode === 'virtual' ? t('seva.online') : s.events.address,
      notes: `${s.events.title} · SevaSetu`,
    });
    setCalMsg(ok ? null : t('join.calendarDenied'));
  };

  return (
    <Screen
      maxWidth={560}
      edges={['top', 'bottom']}
      footer={
        <>
          <Button title={t('join.viewMySeva')} size="lg" onPress={() => router.replace('/my-seva')} />
          {start ? <Button title={t('join.addToCalendar')} icon="calendar" variant="outline" size="lg" onPress={calendar} /> : null}
          {calMsg ? <Text variant="caption" color={colors.danger} align="center">{calMsg}</Text> : null}
        </>
      }>
      <View style={{ alignItems: 'center', gap: 14, paddingTop: 32 }}>
        <View style={{ width: 76, height: 76, borderRadius: 999, backgroundColor: colors.purpleTint, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 52, height: 52, borderRadius: 999, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={28} color={colors.white} strokeWidth={2.6} />
          </View>
        </View>
        <Text variant="display" align="center" accessibilityLiveRegion="polite">{t('join.youreIn')}</Text>
        <Text variant="body" color={colors.body} align="center">
          {isQty ? t('join.reservedForYou', { count: n, unit }) : t('join.positionForYou')}
        </Text>
      </View>

      <Card style={{ gap: 12 }}>
        <Text variant="title">{s.title}</Text>
        <Row gap={8}>
          <Icon name="calendar" size={16} color={colors.muted} />
          <Text variant="caption">{text.whenRange(s)}</Text>
        </Row>
        {s.mode !== 'virtual' && s.events.address ? (
          <Row gap={8}>
            <Icon name="mapPin" size={16} color={colors.muted} />
            <Text variant="caption">{s.events.address}</Text>
          </Row>
        ) : null}
        {isQty ? (
          <>
            <Divider color={colors.cardBorder} />
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="caption">{t('join.yourQuantity')}</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16 }}>
                {n} {unit}
              </Text>
            </Row>
          </>
        ) : null}
      </Card>

      <View style={{ gap: 12 }}>
        <Text variant="h3">{t('join.whatNext')}</Text>
        {[t('join.next1'), s.mode === 'virtual' ? t('join.next2Virtual') : t('join.next2Onsite'), isQty ? t('join.next3Qty') : t('join.next3Role')].map((line, i) => (
          <Row key={i} gap={12} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 26, height: 26, borderRadius: 999, backgroundColor: colors.amberTint, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.amberText }}>{i + 1}</Text>
            </View>
            <Text variant="bodySm" color={colors.body} style={{ flex: 1, paddingTop: 2 }}>{line}</Text>
          </Row>
        ))}
      </View>
    </Screen>
  );
}
