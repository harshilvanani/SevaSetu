import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Badge, Chip } from '@/components/Chip';
import { TagInput } from '@/components/Field';
import { EmptyState, Card, Row, Screen, TopBar } from '@/components/Layout';
import { Text } from '@/components/Text';
import { type FoundVolunteer, useFindVolunteers, useInviteToEvent, useOrgEvent } from '@/features/org/api';
import { OrganizerGate } from '@/features/org/components';
import { COURSES } from '@/features/profile/prefs';
import { colors } from '@/theme/tokens';

export default function FindVolunteersScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useOrgEvent(id);
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/events/[id]', params: { id } }));
  return (
    <OrganizerGate>
      {() => (
        <Screen title={t('find.title')} header={<TopBar onBack={back} title={event.data?.event.title} />} maxWidth={860}>
          <Text variant="h1">{t('find.title')}</Text>
          {event.data ? <Finder eventId={id} tasks={event.data.event.seva_tasks.map((x) => ({ id: x.id, title: x.title }))} /> : <Text variant="caption">{t('common.loading')}</Text>}
        </Screen>
      )}
    </OrganizerGate>
  );
}

function Finder({ eventId, tasks }: { eventId: string; tasks: { id: string; title: string }[] }) {
  const { t } = useTranslation();
  const [taskId, setTaskId] = useState<string | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [courses, setCourses] = useState<string[]>([]);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyNear, setOnlyNear] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const found = useFindVolunteers({ eventId, taskId, skills, courses, onlyAvailable, onlyNear });
  const invite = useInviteToEvent();

  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  const sendInvites = async () => {
    setMsg(null);
    try {
      const n = await invite.mutateAsync({ eventId, userIds: picked });
      setPicked([]);
      setMsg(t('find.invited', { count: n }));
      found.refetch();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <Text variant="body" color={colors.body}>{t('find.intro')}</Text>
      <Card style={{ gap: 14, padding: 20 }}>
        <View style={{ gap: 8 }}>
          <Text variant="label">{t('find.forSeva')}</Text>
          <Row gap={8} wrap>
            <Chip size="sm" label={t('find.wholeEvent')} selected={taskId === null} onPress={() => setTaskId(null)} />
            {tasks.map((x) => (
              <Chip key={x.id} size="sm" label={x.title} selected={taskId === x.id} onPress={() => setTaskId(x.id)} />
            ))}
          </Row>
        </View>
        <TagInput label={t('find.skills')} hint={t('find.skillsHint')} placeholder={t('onboarding.skillsPlaceholder')} values={skills} onChange={setSkills} />
        <View style={{ gap: 8 }}>
          <Text variant="label">{t('find.courses')}</Text>
          <Row gap={8} wrap>
            {COURSES.map((k) => (
              <Chip key={k} size="sm" label={t(`courses.${k}`)} selected={courses.includes(k)} onPress={() => setCourses(courses.includes(k) ? courses.filter((x) => x !== k) : [...courses, k])} />
            ))}
          </Row>
        </View>
        <Row gap={8} wrap>
          <Chip size="sm" label={t('find.onlyAvailable')} selected={onlyAvailable} onPress={() => setOnlyAvailable(!onlyAvailable)} />
          <Chip size="sm" label={t('find.onlyNear')} selected={onlyNear} onPress={() => setOnlyNear(!onlyNear)} />
        </Row>
      </Card>

      {found.isPending ? <Text variant="caption">{t('common.loading')}</Text> : null}
      {found.error ? <Text variant="caption" color={colors.danger}>{(found.error as Error).message}</Text> : null}
      {found.data && found.data.length === 0 ? <EmptyState title={t('find.none')} body={t('find.noneBody')} /> : null}
      {(found.data ?? []).map((v) => (
        <VolunteerCard key={v.id} v={v} picked={picked.includes(v.id)} onToggle={() => toggle(v.id)} />
      ))}

      {msg ? <Text variant="bodySm" color={colors.success}>{msg}</Text> : null}
      {picked.length ? <Button title={t('find.invite', { count: picked.length })} size="lg" loading={invite.isPending} onPress={sendInvites} /> : null}
      <Text variant="caption">{t('find.privacy')}</Text>
    </View>
  );
}

function VolunteerCard({ v, picked, onToggle }: { v: FoundVolunteer; picked: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: picked }} onPress={onToggle}>
      <Card style={{ gap: 8, borderColor: picked ? colors.purple : undefined, borderWidth: picked ? 2 : 1 }}>
        <Row gap={8} wrap style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text variant="title">{v.full_name || '—'}</Text>
            <Text variant="caption">
              {[v.city, v.distance_km != null ? t('find.km', { km: v.distance_km }) : null, t(`availability.modes.${v.serve_mode}`)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Row gap={6}>
            {!v.onboarded ? <Badge label={t('find.profileIncomplete')} tone="amber" /> : null}
            <Badge label={picked ? t('find.selected') : t('find.select')} tone={picked ? 'purple' : 'neutral'} />
          </Row>
        </Row>
        {v.reasons.length ? (
          <Row gap={6} wrap>
            {v.reasons.map((r) => (
              <Badge key={r} label={t(`find.reasons.${r}`)} tone="success" icon="check" />
            ))}
          </Row>
        ) : null}
        {v.interests.length ? <Text variant="caption">{t('find.interests')}: {v.interests.map((k) => t(`interests.${k}`, { defaultValue: k })).join(', ')}</Text> : null}
        {v.skills.length ? <Text variant="caption">{t('find.skills')}: {v.skills.join(', ')}</Text> : null}
        {v.courses.length ? <Text variant="caption">{t('find.courses')}: {v.courses.map((k) => t(`courses.${k}`)).join(', ')}</Text> : null}
        {!v.onboarded ? <Text variant="caption" color={colors.muted}>{t('find.unfinished')}</Text> : null}
      </Card>
    </Pressable>
  );
}
