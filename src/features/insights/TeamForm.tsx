import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/Field';
import { Card, Row } from '@/components/Layout';
import { Stepper } from '@/components/Stepper';
import { Text } from '@/components/Text';
import { INTERESTS } from '@/features/profile/prefs';
import { colors } from '@/theme/tokens';

import { type Team, useCentres, useSaveTeam } from './api';
import { useLabels } from './labels';

/** Create or edit a team: name, seva area, centre, target size. */
export function TeamForm({ orgId, team, onDone }: { orgId: string; team?: Team; onDone: (id?: string) => void }) {
  const { t } = useTranslation();
  const L = useLabels();
  const centres = useCentres(orgId);
  const save = useSaveTeam();
  const [name, setName] = useState(team?.name ?? '');
  const [description, setDescription] = useState(team?.description ?? '');
  const [area, setArea] = useState<string | null>(team?.seva_area ?? null);
  const [centre, setCentre] = useState<string | null>(team?.centre_id ?? null);
  const [size, setSize] = useState(team?.target_size ?? 8);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (name.trim().length < 2) {
      setError(t('teams.nameRequired'));
      return;
    }
    setError(null);
    try {
      const id = await save.mutateAsync({ id: team?.id, org_id: orgId, name: name.trim(), description: description.trim(), seva_area: area, centre_id: centre, target_size: size });
      onDone(id);
    } catch {
      setError(t('common.somethingWrong'));
    }
  };

  return (
    <Card style={{ gap: 16, padding: 20 }}>
      <Text variant="h3">{team ? t('teams.edit') : t('teams.new')}</Text>
      <TextField label={t('teams.name')} value={name} onChangeText={setName} placeholder={t('teams.namePlaceholder')} maxLength={80} />
      <TextField label={t('teams.description')} optional value={description} onChangeText={setDescription} multiline maxLength={500} />
      <View style={{ gap: 8 }}>
        <Text variant="label">{t('teams.area')}</Text>
        <Row gap={8} wrap>
          {INTERESTS.map((k) => <Chip key={k} size="sm" label={L.area(k)} selected={area === k} onPress={() => setArea(area === k ? null : k)} />)}
        </Row>
      </View>
      {centres.data?.length ? (
        <View style={{ gap: 8 }}>
          <Text variant="label">{t('teams.centre')}</Text>
          <Row gap={8} wrap>
            {centres.data.map((c) => <Chip key={c.id} size="sm" label={c.name} selected={centre === c.id} onPress={() => setCentre(centre === c.id ? null : c.id)} />)}
          </Row>
        </View>
      ) : null}
      <View style={{ gap: 8 }}>
        <Text variant="label">{t('teams.targetSize')}</Text>
        <Stepper value={size} onChange={setSize} min={1} max={200} label={t('teams.targetSize')} />
      </View>
      {error ? <Text variant="caption" color={colors.danger}>{error}</Text> : null}
      <Row gap={8}>
        <Button title={t('common.save')} onPress={submit} loading={save.isPending} />
        <Button title={t('common.cancel')} variant="outline" onPress={() => onDone()} />
      </Row>
    </Card>
  );
}
