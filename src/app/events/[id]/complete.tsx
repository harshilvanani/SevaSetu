import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/Field';
import { Card, EmptyState, Row, Screen, TopBar } from '@/components/Layout';
import { Text } from '@/components/Text';
import { type HoursCandidate, useCompleteEvent, useHoursCandidates, useOrgEvent } from '@/features/org/api';
import { OrganizerGate } from '@/features/org/components';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

const parse = (s: string) => {
  const n = Number(s.trim().replace(',', '.'));
  return s.trim() !== '' && Number.isFinite(n) ? n : null;
};

export default function CompleteEventScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useOrgEvent(id);
  const candidates = useHoursCandidates(id);
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/events/[id]', params: { id } }));
  const ready = event.data && candidates.data;
  return (
    <OrganizerGate>
      {() => (
        <Screen title={t('complete.title')} header={<TopBar onBack={back} title={event.data?.event.title} />} maxWidth={860}>
          <Text variant="h1">{t('complete.title')}</Text>
          {ready ? (
            event.data.event.status === 'published' ? (
              <HoursForm eventId={id} candidates={candidates.data!} onDone={() => router.replace({ pathname: '/events/[id]', params: { id } })} />
            ) : (
              <EmptyState title={t('complete.notPublished')} />
            )
          ) : (
            <Text variant="caption">{t('common.loading')}</Text>
          )}
        </Screen>
      )}
    </OrganizerGate>
  );
}

function HoursForm({ eventId, candidates, onDone }: { eventId: string; candidates: HoursCandidate[]; onDone: () => void }) {
  const { t } = useTranslation();
  const complete = useCompleteEvent();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(candidates.map((c) => [c.assignment_id, String(c.logged ?? c.estimate ?? 0)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [reached, setReached] = useState('');

  const groups = candidates.reduce<Record<string, { title: string; rows: HoursCandidate[] }>>((acc, c) => {
    (acc[c.task_id] ??= { title: c.task_title, rows: [] }).rows.push(c);
    return acc;
  }, {});
  const total = candidates.reduce((n, c) => n + (parse(values[c.assignment_id] ?? '') ?? 0), 0);

  const submit = async () => {
    setError(null);
    const hours: { assignment_id: string; hours: number }[] = [];
    for (const c of candidates) {
      const h = parse(values[c.assignment_id] ?? '');
      if (h === null || h < 0 || h > 100) return setError(t('complete.invalid'));
      hours.push({ assignment_id: c.assignment_id, hours: h });
    }
    const people = reached.trim() ? Number(reached.trim()) : null;
    if (people !== null && (!Number.isInteger(people) || people < 0 || people > 1_000_000)) return setError(t('complete.reachedInvalid'));
    try {
      if (people !== null) {
        const { error: rErr } = await supabase.from('events').update({ people_reached: people }).eq('id', eventId);
        if (rErr) throw rErr;
      }
      await complete.mutateAsync({ eventId, hours });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <Text variant="body" color={colors.body}>{candidates.length ? t('complete.intro') : t('complete.noVolunteers')}</Text>
      {Object.entries(groups).map(([taskId, g]) => (
        <Card key={taskId} style={{ gap: 12, padding: 20 }}>
          <Text variant="h3">{g.title}</Text>
          {g.rows.map((c) => (
            <Row key={c.assignment_id} gap={12} style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1, paddingTop: 4 }}>
                <Text variant="bodySm" weight="medium">{c.volunteer_name}</Text>
                <Text variant="caption">{t('complete.estimate', { hours: c.estimate })}</Text>
              </View>
              <View style={{ width: 120 }}>
                <TextField
                  label={t('complete.hours')}
                  value={values[c.assignment_id] ?? ''}
                  onChangeText={(v) => setValues({ ...values, [c.assignment_id]: v })}
                  keyboardType="decimal-pad"
                />
              </View>
            </Row>
          ))}
        </Card>
      ))}
      <Card style={{ gap: 8, padding: 20 }}>
        <TextField label={t('complete.reached')} optional value={reached} onChangeText={(v) => setReached(v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad" hint={t('complete.reachedHint')} placeholder="120" />
      </Card>
      {candidates.length ? <Text variant="label">{t('complete.total', { hours: Math.round(total * 100) / 100 })}</Text> : null}
      {error ? <Text variant="caption" color={colors.danger}>{error}</Text> : null}
      <Button title={t('complete.confirm')} size="lg" loading={complete.isPending} onPress={submit} />
      <Text variant="caption">{t('complete.note')}</Text>
    </View>
  );
}
