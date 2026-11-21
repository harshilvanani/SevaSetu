import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Card, Row } from '@/components/Layout';
import { Text } from '@/components/Text';
import { formatDay } from '@/lib/format';
import { colors } from '@/theme/tokens';

import { useRepeatWeekly } from './api';

/** "Repeat every week" for weekly follow-ups and satsangs: copies the event and its seva for 4, 8 or 12 weeks. */
export function RepeatCard({ eventId, startsAt, seriesId }: { eventId: string; startsAt: string; seriesId: string | null }) {
  const { t } = useTranslation();
  const repeat = useRepeatWeekly();
  const [weeks, setWeeks] = useState(4);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const until = new Date(new Date(startsAt).getTime() + weeks * 7 * 86_400_000);
  const ymd = `${until.getFullYear()}-${String(until.getMonth() + 1).padStart(2, '0')}-${String(until.getDate()).padStart(2, '0')}`;

  const run = async () => {
    setError(null);
    try {
      setDone(await repeat.mutateAsync({ eventId, until: ymd }));
    } catch {
      setError(t('common.somethingWrong'));
    }
  };

  return (
    <Card style={{ gap: 10, padding: 20 }}>
      <Text variant="h3">{t('repeat.title')}</Text>
      <Text variant="caption">{seriesId ? t('repeat.partOfSeries') : t('repeat.body')}</Text>
      {done !== null ? (
        <Text variant="label" color={colors.success}>{t('repeat.done', { count: done })}</Text>
      ) : (
        <>
          <Row gap={8} wrap>
            {[4, 8, 12].map((w) => <Chip key={w} size="sm" label={t('repeat.weeks', { count: w })} selected={weeks === w} onPress={() => setWeeks(w)} />)}
          </Row>
          <Text variant="small" color={colors.muted}>{t('repeat.until', { date: formatDay(until.toISOString()) })}</Text>
          <Button title={t('repeat.action')} icon="calendar" variant="outline" loading={repeat.isPending} onPress={run} />
          {error ? <Text variant="caption" color={colors.danger}>{error}</Text> : null}
        </>
      )}
    </Card>
  );
}
