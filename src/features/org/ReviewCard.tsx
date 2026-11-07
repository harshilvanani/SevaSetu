import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/Field';
import { Avatar, Card, Row } from '@/components/Layout';
import { Stepper } from '@/components/Stepper';
import { Text } from '@/components/Text';
import { formatDateTime } from '@/lib/format';
import { colors } from '@/theme/tokens';

import { type ReviewItem, useReviewProgress } from './api';

export function ReviewCard({ item, name }: { item: ReviewItem; name: string }) {
  const { t } = useTranslation();
  const review = useReviewProgress();
  const [mode, setMode] = useState<'idle' | 'adjust' | 'reject'>('idle');
  const [qty, setQty] = useState(Math.max(0, item.reported_qty - 1));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const task = item.assignments.seva_tasks;
  const unit = task.unit ?? '';

  const run = async (decision: 'approve' | 'adjust' | 'reject') => {
    if (decision !== 'approve' && !reason.trim()) return setError(t('org.reasonRequired'));
    setError(null);
    try {
      await review.mutateAsync({ reportId: item.id, decision, verifiedQty: decision === 'adjust' ? qty : undefined, reason: reason.trim() || undefined });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Card style={{ gap: 12 }}>
      <Row gap={12} style={{ alignItems: 'flex-start' }}>
        <Avatar name={name} size={40} color={colors.purpleTint} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">{t('org.reportLine', { name, count: item.reported_qty, unit })}</Text>
          <Text variant="caption">
            {task.title} · {formatDateTime(item.created_at)}
          </Text>
        </View>
      </Row>
      {item.note ? <Text variant="bodySm" color={colors.body}>“{item.note}”</Text> : null}

      {mode === 'idle' ? (
        <Row gap={8} wrap>
          <Button title={t('org.approve')} icon="check" onPress={() => run('approve')} loading={review.isPending} style={{ flexGrow: 1 }} />
          <Button title={t('org.adjust')} variant="outline" onPress={() => setMode('adjust')} style={{ flexGrow: 1 }} />
          <Button title={t('org.reject')} variant="danger" onPress={() => setMode('reject')} style={{ flexGrow: 1 }} />
        </Row>
      ) : (
        <View style={{ gap: 12, padding: 12, borderRadius: 12, backgroundColor: colors.cream }}>
          {mode === 'adjust' ? (
            <View style={{ gap: 6 }}>
              <Text variant="label">{t('org.adjustTo')}</Text>
              <Row gap={10}>
                <Stepper value={qty} onChange={setQty} min={0} max={item.reported_qty - 1} label={unit} />
                <Text variant="bodySm" color={colors.muted}>
                  / {item.reported_qty} {unit}
                </Text>
              </Row>
            </View>
          ) : null}
          <TextField label={t('org.reason')} value={reason} onChangeText={setReason} hint={t('org.reasonHint', { name })} error={error ?? undefined} />
          <Row gap={8}>
            <Button
              title={mode === 'adjust' ? t('org.saveCorrection') : t('org.confirmReject')}
              variant={mode === 'adjust' ? 'primary' : 'danger'}
              onPress={() => run(mode)}
              loading={review.isPending}
              style={{ flex: 1 }}
            />
            <Button title={t('common.cancel')} variant="ghost" onPress={() => { setMode('idle'); setError(null); }} />
          </Row>
        </View>
      )}
      {error && mode === 'idle' ? <Text variant="caption" color={colors.danger}>{error}</Text> : null}
    </Card>
  );
}
