import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { useConfirm } from '@/components/ConfirmDialog';
import { TextField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Card, Row, Screen } from '@/components/Layout';
import { Text } from '@/components/Text';
import { type Template, useDeleteTemplate, useSaveTemplate, useTemplates } from '@/features/org/templates';
import type { Enums } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

type Line = { name: string; hi: string; fr: string };
const i18n = (m: unknown, k: 'hi' | 'fr') => ((m ?? {}) as Record<string, string>)[k] ?? '';

export default function AdminTemplates() {
  const { t } = useTranslation();
  const templates = useTemplates();
  const [creating, setCreating] = useState(false);
  const list = (templates.data ?? []).filter((x) => x.org_id === null);
  return (
    <Screen title={t('admin.nav.templates')} edges={[]} maxWidth={1000} refreshing={templates.isRefetching} onRefresh={() => templates.refetch()}>
      <Row style={{ paddingTop: 16, justifyContent: 'space-between' }} gap={12} wrap>
        <Text variant="h1">{t('admin.nav.templates')}</Text>
        {!creating ? <Button title={t('admin.templates.add')} icon="plus" onPress={() => setCreating(true)} /> : null}
      </Row>
      <Text variant="body" color={colors.body}>{t('admin.templates.intro')}</Text>
      {creating ? <Editor key="new" onDone={() => setCreating(false)} /> : null}
      {templates.isPending ? <Text variant="caption">{t('common.loading')}</Text> : null}
      {list.map((tpl) => (
        <Editor key={tpl.id} tpl={tpl} />
      ))}
    </Screen>
  );
}

function Editor({ tpl, onDone }: { tpl?: Template; onDone?: () => void }) {
  const { t } = useTranslation();
  const save = useSaveTemplate();
  const del = useDeleteTemplate();
  const { ask, dialog } = useConfirm();
  const [open, setOpen] = useState(!tpl);
  const [name, setName] = useState(tpl?.name ?? '');
  const [hi, setHi] = useState(i18n(tpl?.name_i18n, 'hi'));
  const [fr, setFr] = useState(i18n(tpl?.name_i18n, 'fr'));
  const [visibility, setVisibility] = useState<Enums<'visibility'>>(tpl?.visibility ?? 'public');
  const [lines, setLines] = useState<Line[]>(
    (tpl?.event_template_tasks ?? []).map((x) => ({ name: x.name, hi: i18n(x.name_i18n, 'hi'), fr: i18n(x.name_i18n, 'fr') })),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const setLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const submit = async () => {
    setError(null);
    setSaved(false);
    if (name.trim().length < 2) return setError(t('taskForm.required'));
    try {
      await save.mutateAsync({
        id: tpl?.id,
        orgId: null,
        name,
        name_i18n: { hi: hi.trim(), fr: fr.trim() },
        visibility,
        tasks: lines.filter((l) => l.name.trim()).map((l) => ({ name: l.name, name_i18n: { hi: l.hi.trim(), fr: l.fr.trim() } })),
      });
      setSaved(true);
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Card style={{ gap: 14, padding: 20 }}>
      {dialog}
      <Pressable accessibilityRole="button" onPress={() => setOpen(!open)}>
        <Row gap={10} style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text variant="title">{tpl ? tpl.name : t('admin.templates.new')}</Text>
            {tpl ? <Text variant="caption">{tpl.event_template_tasks.length} · {tpl.visibility === 'public' ? t('seva.public') : t('seva.private')}</Text> : null}
          </View>
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={18} color={colors.muted} />
        </Row>
      </Pressable>
      {open ? (
        <View style={{ gap: 14 }}>
          <TextField label={t('admin.templates.name')} value={name} onChangeText={setName} />
          <Row gap={12} wrap>
            <View style={{ flex: 1, minWidth: 220 }}><TextField label={t('admin.templates.nameHi')} optional value={hi} onChangeText={setHi} /></View>
            <View style={{ flex: 1, minWidth: 220 }}><TextField label={t('admin.templates.nameFr')} optional value={fr} onChangeText={setFr} /></View>
          </Row>
          <Row gap={8}>
            <Chip size="sm" label={t('seva.public')} selected={visibility === 'public'} onPress={() => setVisibility('public')} />
            <Chip size="sm" label={t('seva.private')} selected={visibility === 'private'} onPress={() => setVisibility('private')} />
          </Row>
          <Text variant="label">{t('admin.templates.seva')}</Text>
          {lines.map((l, i) => (
            <Row key={i} gap={8} wrap style={{ alignItems: 'flex-end' }}>
              <View style={{ flex: 1, minWidth: 180 }}><TextField label="English" value={l.name} onChangeText={(v) => setLine(i, { name: v })} /></View>
              <View style={{ flex: 1, minWidth: 180 }}><TextField label="हिन्दी" optional value={l.hi} onChangeText={(v) => setLine(i, { hi: v })} /></View>
              <View style={{ flex: 1, minWidth: 180 }}><TextField label="Français" optional value={l.fr} onChangeText={(v) => setLine(i, { fr: v })} /></View>
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.delete')} onPress={() => setLines(lines.filter((_, j) => j !== i))} style={{ padding: 10 }}>
                <Icon name="trash" size={18} color={colors.danger} />
              </Pressable>
            </Row>
          ))}
          <View style={{ alignSelf: 'flex-start' }}>
            <Button title={t('admin.templates.addSeva')} icon="plus" variant="secondary" onPress={() => setLines([...lines, { name: '', hi: '', fr: '' }])} />
          </View>
          {error ? <Text variant="caption" color={colors.danger}>{error}</Text> : null}
          {saved ? <Text variant="caption" color={colors.success}>{t('admin.templates.saved')}</Text> : null}
          <Row gap={10} wrap>
            <Button title={t('common.save')} loading={save.isPending} onPress={submit} />
            {tpl ? (
              <Button
                title={t('common.delete')}
                variant="danger"
                onPress={() =>
                  ask({
                    title: t('admin.templates.deleteTitle', { name: tpl.name }),
                    body: t('admin.templates.deleteBody'),
                    confirmLabel: t('common.delete'),
                    destructive: true,
                    onConfirm: async () => {
                      await del.mutateAsync(tpl.id);
                    },
                  })
                }
              />
            ) : (
              <Button title={t('common.cancel')} variant="outline" onPress={onDone ?? (() => {})} />
            )}
          </Row>
        </View>
      ) : null}
    </Card>
  );
}
