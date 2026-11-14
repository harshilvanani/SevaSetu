import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/Field';
import { Card, Row } from '@/components/Layout';
import { Text } from '@/components/Text';
import { parseDollars } from '@/domain/donations';
import { colors } from '@/theme/tokens';

import type { Campaign, CampaignInput } from './api';

const dollars = (cents: number | null | undefined) => (cents ? String(cents / 100) : '');

export function CampaignForm({ initial, busy, onSubmit }: { initial?: Campaign; busy: boolean; onSubmit: (v: CampaignInput) => Promise<void> }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [goal, setGoal] = useState(dollars(initial?.goal_cents));
  const [image, setImage] = useState(initial?.image_url ?? '');
  const [presets, setPresets] = useState((initial?.presets ?? [2500, 5000, 10000, 25000]).map((c) => c / 100).join(', '));
  const [monthly, setMonthly] = useState(initial?.allow_monthly ?? true);
  const [coverFees, setCoverFees] = useState(initial?.allow_cover_fees ?? true);
  const [status, setStatus] = useState<'draft' | 'active' | 'closed'>((initial?.status as 'draft' | 'active' | 'closed') ?? 'draft');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    const e: Record<string, string> = {};
    if (title.trim().length < 2) e.title = t('taskForm.required');
    const goalCents = goal.trim() ? parseDollars(goal) : null;
    if (goal.trim() && !goalCents) e.goal = t('donations.invalidAmount');
    const presetCents = presets.split(/[,\s]+/).filter(Boolean).map(parseDollars);
    if (presetCents.some((x) => !x || x < 200) || presetCents.length === 0 || presetCents.length > 6) e.presets = t('donations.invalidPresets');
    if (image.trim() && !/^https:\/\//.test(image.trim())) e.image = t('donations.invalidImage');
    setErrors(e);
    if (Object.keys(e).length) return;
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      image_url: image.trim() || null,
      goal_cents: goalCents,
      presets: presetCents as number[],
      allow_monthly: monthly,
      allow_cover_fees: coverFees,
      status,
    });
  };

  return (
    <View style={{ gap: 16 }}>
      <Card style={{ gap: 16, padding: 20 }}>
        <TextField label={t('donations.campaignTitle')} value={title} onChangeText={setTitle} error={errors.title} placeholder="Support the 2026 Hackathon" />
        <TextField label={t('donations.description')} optional value={description} onChangeText={setDescription} multiline maxLength={2000} />
        <Row gap={16} wrap>
          <View style={{ flex: 1, minWidth: 200 }}>
            <TextField label={t('donations.goal')} optional value={goal} onChangeText={setGoal} keyboardType="decimal-pad" error={errors.goal} hint="CAD" />
          </View>
          <View style={{ flex: 1, minWidth: 200 }}>
            <TextField label={t('donations.presets')} value={presets} onChangeText={setPresets} error={errors.presets} hint={t('donations.presetsHint')} />
          </View>
        </Row>
        <TextField label={t('donations.image')} optional value={image} onChangeText={setImage} error={errors.image} placeholder="https://…" autoCapitalize="none" />
      </Card>
      <Card style={{ gap: 12, padding: 20 }}>
        <Text variant="label">{t('donations.options')}</Text>
        <Row gap={8} wrap>
          <Chip size="sm" label={t('donations.allowMonthly')} selected={monthly} onPress={() => setMonthly(!monthly)} />
          <Chip size="sm" label={t('donations.allowCoverFees')} selected={coverFees} onPress={() => setCoverFees(!coverFees)} />
        </Row>
        <Text variant="label">{t('donations.status')}</Text>
        <Row gap={8} wrap>
          {(['draft', 'active', 'closed'] as const).map((s) => (
            <Chip key={s} size="sm" label={t(`donations.statuses.${s}`)} selected={status === s} onPress={() => setStatus(s)} />
          ))}
        </Row>
        <Text variant="caption" color={colors.muted}>{t('donations.statusHint')}</Text>
      </Card>
      <Button title={t('common.save')} size="lg" loading={busy} onPress={submit} />
    </View>
  );
}
