import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Badge } from '@/components/Chip';
import { useConfirm } from '@/components/ConfirmDialog';
import { Card, Row, Screen, TopBar } from '@/components/Layout';
import { Text } from '@/components/Text';
import { useSaveEvent } from '@/features/org/api';
import { OrganizerGate } from '@/features/org/components';
import { EventForm, StepHeader } from '@/features/org/EventForm';
import { type Template, useDeleteTemplate, useLocalized, useTemplates } from '@/features/org/templates';
import { colors } from '@/theme/tokens';

export default function NewEventScreen() {
  const { t } = useTranslation();
  const save = useSaveEvent();
  const templates = useTemplates();
  const localized = useLocalized();
  const del = useDeleteTemplate();
  const { ask, dialog } = useConfirm();
  // undefined = still choosing, null = blank event
  const [chosen, setChosen] = useState<Template | null | undefined>(undefined);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/dashboard'));

  return (
    <OrganizerGate>
      {(org) => {
        const all = templates.data ?? [];
        const ready = all.filter((x) => x.org_id === null);
        const mine = all.filter((x) => x.org_id === org.id);

        const card = (tpl: Template) => (
          <Card key={tpl.id} onPress={() => setChosen(tpl)} accessibilityLabel={localized(tpl)} style={{ gap: 8, flexBasis: 300, flexGrow: 1 }}>
            <Row gap={8} wrap>
              <Text variant="title" style={{ flexShrink: 1 }}>{localized(tpl)}</Text>
              <Badge label={tpl.visibility === 'public' ? t('seva.public') : t('seva.private')} tone={tpl.visibility === 'public' ? 'neutral' : 'amber'} />
            </Row>
            <Text variant="caption" numberOfLines={3}>
              {tpl.event_template_tasks.length
                ? tpl.event_template_tasks.map((x) => localized(x).trim()).join(' · ')
                : t('eventForm.templateNoSeva')}
            </Text>
            {tpl.org_id ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  ask({
                    title: t('eventForm.removeTemplate'),
                    body: localized(tpl),
                    confirmLabel: t('common.delete'),
                    destructive: true,
                    onConfirm: async () => {
                      await del.mutateAsync(tpl.id);
                    },
                  })
                }
                style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
                <Text variant="label" color={colors.danger}>{t('eventForm.removeTemplate')}</Text>
              </Pressable>
            ) : null}
          </Card>
        );

        return (
          <Screen title={t('eventForm.newTitle')} header={<TopBar onBack={chosen === undefined ? back : () => setChosen(undefined)} title={t('eventForm.newTitle')} />} maxWidth={1080}>
            {dialog}
            <View style={{ gap: 12 }}>
              <Text variant="h1">{t('eventForm.newTitle')}</Text>
              <Text variant="bodySm" color={colors.muted}>{chosen === undefined ? t('eventForm.startFromBody') : t('eventForm.intro')}</Text>
              {chosen !== undefined ? <StepHeader step={1} /> : null}
            </View>

            {chosen === undefined ? (
              <View style={{ gap: 20 }}>
                <Card onPress={() => setChosen(null)} accessibilityLabel={t('eventForm.blank')} style={{ gap: 4 }}>
                  <Text variant="title">{t('eventForm.blank')}</Text>
                  <Text variant="caption">{t('eventForm.blankBody')}</Text>
                </Card>
                {mine.length ? (
                  <View style={{ gap: 10 }}>
                    <Text variant="h3">{t('eventForm.yourTemplates')}</Text>
                    <Row gap={12} wrap style={{ alignItems: 'stretch' }}>{mine.map(card)}</Row>
                  </View>
                ) : null}
                <View style={{ gap: 10 }}>
                  <Text variant="h3">{t('eventForm.readyMade')}</Text>
                  {templates.isPending ? <Text variant="caption">{t('common.loading')}</Text> : null}
                  <Row gap={12} wrap style={{ alignItems: 'stretch' }}>{ready.map(card)}</Row>
                </View>
              </View>
            ) : (
              <>
                <EventForm
                  key={chosen?.id ?? 'blank'}
                  orgName={org.name}
                  busy={save.isPending}
                  submitLabel={t('eventForm.saveContinue')}
                  defaults={chosen ? { title: localized(chosen), visibility: chosen.visibility } : undefined}
                  onSubmit={async (input) => {
                    const id = await save.mutateAsync({ orgId: org.id, input: { ...input, template_id: chosen?.id ?? null } });
                    router.replace({ pathname: '/events/[id]', params: { id } });
                  }}
                />
                {save.error ? <Text variant="caption" color={colors.danger}>{(save.error as Error).message}</Text> : null}
              </>
            )}
          </Screen>
        );
      }}
    </OrganizerGate>
  );
}
