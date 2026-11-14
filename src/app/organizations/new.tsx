import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Screen, TopBar } from '@/components/Layout';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCreateOrganization, useResubmitOrganization } from '@/features/org/api';
import { colors } from '@/theme/tokens';

export default function NewOrganization() {
  const { t } = useTranslation();
  const { profile, memberships } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  // Resubmitting a rejected organization (owner only) reuses this form, prefilled.
  const existing = id ? memberships.find((m) => m.org_id === id && m.role === 'owner' && m.organizations.status === 'rejected') : undefined;
  const create = useCreateOrganization();
  const resubmit = useResubmitOrganization();
  const [name, setName] = useState(existing?.organizations.name ?? '');
  const [city, setCity] = useState(existing?.organizations.city ?? profile?.city ?? '');
  const [description, setDescription] = useState(existing?.organizations.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  const submit = async () => {
    if (name.trim().length < 2) return setError(t('taskForm.required'));
    setError(null);
    try {
      if (existing) await resubmit.mutateAsync({ id: existing.org_id, name, city, description });
      else await create.mutateAsync({ name, city, description });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (done) {
    return (
      <Screen title={t('org.newTitle')} maxWidth={560} header={<TopBar onBack={back} />}>
        <View style={{ alignItems: 'center', gap: 14, paddingTop: 32 }}>
          <View style={{ width: 64, height: 64, borderRadius: 999, backgroundColor: colors.amberTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="clock" size={28} color={colors.amberText} />
          </View>
          <Text variant="h1" align="center">{t('org.submittedTitle')}</Text>
          <Text variant="body" color={colors.body} align="center">{t('org.submittedBody')}</Text>
          <Button title={t('common.done')} onPress={() => router.replace('/profile')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title={t('org.newTitle')}
      maxWidth={560}
      header={<TopBar onBack={back} title={existing ? t('org.resubmitTitle') : t('org.newTitle')} />}
      footer={<Button title={existing ? t('org.resubmit') : t('org.submit')} size="lg" loading={create.isPending || resubmit.isPending} onPress={submit} />}>
      <View style={{ gap: 8, paddingTop: 8 }}>
        <Text variant="h1">{existing ? t('org.resubmitTitle') : t('org.newTitle')}</Text>
        <Text variant="bodySm" color={colors.muted}>{existing ? t('org.resubmitBody') : t('org.newBody')}</Text>
      </View>
      {existing?.organizations.review_note ? (
        <View style={{ padding: 14, borderRadius: 12, backgroundColor: colors.amberTint }}>
          <Text variant="bodySm" color={colors.amberText}>{t('profile.reviewNote', { note: existing.organizations.review_note })}</Text>
        </View>
      ) : null}
      <TextField label={t('org.name')} value={name} onChangeText={setName} placeholder="Art of Living Toronto" error={error ?? undefined} />
      <TextField label={t('org.city')} value={city} onChangeText={setCity} placeholder="Toronto, ON" />
      <TextField label={t('org.description')} optional value={description} onChangeText={setDescription} multiline maxLength={500} />
    </Screen>
  );
}
