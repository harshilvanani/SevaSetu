import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Badge } from '@/components/Chip';
import { defaultDate, DateTimeField } from '@/components/DateTimeField';
import { TextField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Card, Row, useLayout } from '@/components/Layout';
import { OptionCards } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { geocodeCity } from '@/features/profile/prefs';
import { formatDay, formatRange } from '@/lib/format';
import type { Enums, Tables } from '@/lib/supabase';
import { colors, fonts } from '@/theme/tokens';

import type { EventInput } from './api';

export function StepHeader({ step }: { step: 1 | 2 | 3 }) {
  const { t } = useTranslation();
  const steps = [t('eventForm.step1'), t('eventForm.step2'), t('eventForm.step3')];
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 3, now: step }} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <Row key={label} gap={8}>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: done || current ? colors.purple : colors.white,
                borderWidth: 1.5,
                borderColor: done || current ? colors.purple : colors.border,
              }}>
              {done ? (
                <Icon name="check" size={13} color={colors.white} strokeWidth={2.6} />
              ) : (
                <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: current ? colors.white : colors.muted }}>{n}</Text>
              )}
            </View>
            <Text style={{ fontFamily: current ? fonts.semibold : fonts.medium, fontSize: 14, color: current ? colors.text : colors.subtle }}>{label}</Text>
            {n < 3 ? <View style={{ width: 24, height: 1, backgroundColor: colors.border }} /> : null}
          </Row>
        );
      })}
    </View>
  );
}

export function EventForm({
  orgName,
  initial,
  defaults,
  details,
  onSubmit,
  busy,
  submitLabel,
}: {
  orgName: string;
  initial?: Tables<'events'>;
  /** Starting values for a new event (from a template). */
  defaults?: { title: string; visibility: Enums<'visibility'> };
  details?: Tables<'event_private_details'> | null;
  onSubmit: (v: EventInput) => Promise<void>;
  busy: boolean;
  submitLabel: string;
}) {
  const { t } = useTranslation();
  const { isDesktop } = useLayout();
  const [title, setTitle] = useState(initial?.title ?? defaults?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [start, setStart] = useState<Date | null>(initial ? new Date(initial.starts_at) : defaultDate());
  const [end, setEnd] = useState<Date | null>(initial ? new Date(initial.ends_at) : new Date(defaultDate().getTime() + 3 * 3_600_000));
  const [mode, setMode] = useState<Enums<'participation_mode'>>(initial?.mode ?? 'onsite');
  const [venue, setVenue] = useState(initial?.venue_name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [online, setOnline] = useState(details?.online_details ?? '');
  const [contact, setContact] = useState(details?.contact_info ?? '');
  const [visibility, setVisibility] = useState<Enums<'visibility'>>(initial?.visibility ?? defaults?.visibility ?? 'public');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const needsVenue = mode !== 'virtual';
  const timeError = start && end && end <= start ? t('eventForm.endAfterStart') : undefined;

  const submit = async () => {
    const e: Record<string, string> = {};
    if (title.trim().length < 2) e.title = t('taskForm.required');
    if (!start) e.start = t('taskForm.required');
    if (!end) e.end = t('taskForm.required');
    if (timeError) e.end = timeError;
    if (needsVenue && !address.trim()) e.address = t('eventForm.addressRequired');
    setErrors(e);
    if (Object.keys(e).length) return;
    const coords = needsVenue && address.trim() !== (initial?.address ?? '') ? await geocodeCity(address) : null;
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      starts_at: start!.toISOString(),
      ends_at: end!.toISOString(),
      mode,
      venue_name: needsVenue ? venue.trim() || null : null,
      address: needsVenue ? address.trim() || null : null,
      city: city.trim() || null,
      ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
      visibility,
      online_details: mode !== 'onsite' ? online.trim() || null : null,
      contact_info: contact.trim() || null,
    });
  };

  const form = (
    <View style={{ gap: 20, flex: 1 }}>
      <Card style={{ gap: 16, padding: 20 }}>
        <Text variant="h3">{t('eventForm.basics')}</Text>
        <TextField label={t('eventForm.title')} value={title} onChangeText={setTitle} error={errors.title} placeholder="Winter Care Kit Drive" />
        <TextField
          label={t('eventForm.description')}
          optional
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={1000}
          hint={`${description.length} / 1000`}
        />
        <View style={{ gap: 4 }}>
          <Text variant="small" color={colors.muted}>{t('eventForm.organizer')}</Text>
          <Text variant="bodySm" weight="medium">{orgName}</Text>
        </View>
      </Card>

      <Card style={{ gap: 16, padding: 20 }}>
        <Text variant="h3">{t('eventForm.dateTime')}</Text>
        <View style={[{ gap: 16 }, isDesktop && { flexDirection: 'row' }]}>
          <View style={{ flex: 1 }}>
            <DateTimeField label={t('eventForm.starts')} value={start} onChange={setStart} error={errors.start} />
          </View>
          <View style={{ flex: 1 }}>
            <DateTimeField label={t('eventForm.ends')} value={end} onChange={setEnd} error={errors.end ?? timeError} />
          </View>
        </View>
      </Card>

      <Card style={{ gap: 16, padding: 20 }}>
        <Text variant="h3">{t('eventForm.mode')}</Text>
        <OptionCards
          label={t('eventForm.mode')}
          value={mode}
          onChange={setMode}
          columns={3}
          options={[
            { value: 'onsite', title: t('availability.modes.onsite'), body: t('eventForm.modeOnsite') },
            { value: 'virtual', title: t('availability.modes.virtual'), body: t('eventForm.modeVirtual') },
            { value: 'hybrid', title: t('availability.modes.hybrid'), body: t('eventForm.modeHybrid') },
          ]}
        />
        {needsVenue ? (
          <>
            <TextField label={t('eventForm.venue')} value={venue} onChangeText={setVenue} placeholder="Community Hall" />
            <TextField label={t('eventForm.address')} value={address} onChangeText={setAddress} error={errors.address} placeholder="50 Maple Ave, Toronto, ON" />
          </>
        ) : null}
        <TextField label={t('eventForm.city')} value={city} onChangeText={setCity} placeholder="Toronto, ON" />
        {mode !== 'onsite' ? (
          <TextField label={t('eventForm.online')} value={online} onChangeText={setOnline} hint={t('eventForm.onlineHint')} placeholder="meet.example.com/…" />
        ) : null}
        <TextField label={t('eventForm.contact')} optional value={contact} onChangeText={setContact} hint={t('eventForm.contactHint')} />
      </Card>

      <Card style={{ gap: 16, padding: 20 }}>
        <Text variant="h3">{t('eventForm.visibility')}</Text>
        <OptionCards
          label={t('eventForm.visibility')}
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: 'public', title: t('seva.public'), body: t('eventForm.publicBody') },
            { value: 'private', title: t('seva.private'), body: t('eventForm.privateBody') },
          ]}
        />
        <Text variant="caption">{t('eventForm.visibilityNote')}</Text>
      </Card>

      <Button title={submitLabel} size="lg" onPress={submit} loading={busy} />
    </View>
  );

  if (!isDesktop) return form;

  return (
    <Row gap={32} style={{ alignItems: 'flex-start' }}>
      {form}
      <View style={{ width: 340, gap: 12 }}>
        <Text variant="label">{t('eventForm.preview')}</Text>
        <Card style={{ gap: 8 }}>
          <Row gap={6}>
            <Badge label={t(`availability.modes.${mode}`)} tone="purple" />
            <Badge label={visibility === 'public' ? t('seva.public') : t('seva.private')} tone={visibility === 'public' ? 'neutral' : 'amber'} />
          </Row>
          <Text variant="title">{title || t('eventForm.title')}</Text>
          <Text variant="caption">{orgName}</Text>
          {start ? (
            <Text variant="caption">
              {formatDay(start.toISOString())} · {formatRange(start.toISOString(), end && !timeError ? end.toISOString() : null)}
            </Text>
          ) : null}
          <Text variant="caption">{mode === 'virtual' ? t('seva.online') : venue || address || '—'}</Text>
        </Card>
      </View>
    </Row>
  );
}
