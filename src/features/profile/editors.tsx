import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TagInput, TextField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Row } from '@/components/Layout';
import { Text } from '@/components/Text';
import type { Period, Slot } from '@/domain/seva';
import { colors, fonts, radius } from '@/theme/tokens';

import { detectLocation, INTERESTS, PERIODS, RADII } from './prefs';

export type LocationValue = { city: string; latitude: number | null; longitude: number | null; radius_km: number };

export function LocationEditor({ value, onChange }: { value: LocationValue; onChange: (v: LocationValue) => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const locate = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const loc = await detectLocation();
      if (!loc) setMessage(t('onboarding.locationDenied'));
      else onChange({ ...value, latitude: loc.latitude, longitude: loc.longitude, city: loc.city ?? value.city });
    } catch {
      setMessage(t('onboarding.locationDenied'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 18 }}>
      <TextField
        label={t('onboarding.cityLabel')}
        value={value.city}
        placeholder={t('onboarding.cityPlaceholder')}
        onChangeText={(city) => onChange({ ...value, city })}
        autoComplete="postal-address-locality"
      />
      <Button
        title={busy ? t('onboarding.locating') : t('onboarding.useLocation')}
        icon="mapPin"
        variant="secondary"
        onPress={locate}
        loading={busy}
      />
      {value.latitude != null && !message ? (
        <Row gap={6}>
          <Icon name="check" size={16} color={colors.purple} />
          <Text variant="caption" color={colors.purpleDark}>
            {value.latitude.toFixed(3)}, {value.longitude?.toFixed(3)}
          </Text>
        </Row>
      ) : null}
      {message ? <Text variant="caption" color={colors.danger}>{message}</Text> : null}
      <View style={{ gap: 10 }}>
        <Text variant="label">{t('onboarding.radiusLabel')}</Text>
        <Row gap={8} wrap>
          {RADII.map((km) => (
            <Chip key={km} label={t('onboarding.withinKm', { km })} selected={value.radius_km === km} onPress={() => onChange({ ...value, radius_km: km })} />
          ))}
        </Row>
      </View>
    </View>
  );
}

export function InterestsEditor({
  interests,
  skills,
  onChange,
}: {
  interests: string[];
  skills: string[];
  onChange: (v: { interests: string[]; skills: string[] }) => void;
}) {
  const { t } = useTranslation();
  const toggle = (k: string) =>
    onChange({ skills, interests: interests.includes(k) ? interests.filter((x) => x !== k) : [...interests, k] });
  return (
    <View style={{ gap: 24 }}>
      <View accessibilityRole="none" accessibilityLabel="Interests" style={styles.wrap}>
        {INTERESTS.map((k) => (
          <Chip key={k} label={t(`interests.${k}`)} selected={interests.includes(k)} onPress={() => toggle(k)} />
        ))}
      </View>
      <TagInput
        label={t('onboarding.skillsLabel')}
        placeholder={t('onboarding.skillsPlaceholder')}
        hint={t('onboarding.skillsHint')}
        values={skills}
        onChange={(s) => onChange({ interests, skills: s })}
      />
    </View>
  );
}

// 7 x 3 grid of toggles (weekday x period).
export function AvailabilityGrid({ slots, onChange }: { slots: Slot[]; onChange: (s: Slot[]) => void }) {
  const { t } = useTranslation();
  const has = (d: number, p: Period) => slots.some((s) => s.weekday === d && s.period === p);
  const toggle = (d: number, p: Period) =>
    onChange(has(d, p) ? slots.filter((s) => !(s.weekday === d && s.period === p)) : [...slots, { weekday: d, period: p }]);
  const days = [0, 1, 2, 3, 4, 5, 6];

  return (
    <View style={styles.grid}>
      <View style={styles.gridRow}>
        <View style={styles.periodCol} />
        {days.map((d) => (
          <Text key={d} style={styles.dayHead}>{t(`availability.days.${d}`)}</Text>
        ))}
      </View>
      {PERIODS.map((p) => (
        <View key={p} style={styles.gridRow}>
          <View style={styles.periodCol}>
            <Text variant="label">{t(`availability.periods.${p}`)}</Text>
            <Text variant="small" color={colors.muted}>{t(`availability.periods.${p}Hours`)}</Text>
          </View>
          {days.map((d) => {
            const on = has(d, p);
            return (
              <Pressable
                key={d}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${t(`availability.days.${d}`)} ${t(`availability.periods.${p}`)}`}
                onPress={() => toggle(d, p)}
                style={[styles.cell, on && styles.cellOn]}>
                {on ? <Icon name="check" size={16} color={colors.white} strokeWidth={2.4} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function ServePrefsEditor({
  serveMode,
  hours,
  onChange,
}: {
  serveMode: 'onsite' | 'virtual' | 'either';
  hours: string | null;
  onChange: (v: { serve_mode: 'onsite' | 'virtual' | 'either'; hours_per_week: '1-2' | '3-5' | '6+' | null }) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 10 }}>
        <Text variant="label">{t('onboarding.serveModeLabel')}</Text>
        <Row gap={8} wrap>
          {(['onsite', 'virtual', 'either'] as const).map((m) => (
            <Chip key={m} label={t(`availability.modes.${m}`)} selected={serveMode === m} onPress={() => onChange({ serve_mode: m, hours_per_week: hours as never })} />
          ))}
        </Row>
      </View>
      <View style={{ gap: 10 }}>
        <Text variant="label">
          {t('onboarding.hoursLabel')} <Text variant="label" weight="regular" color={colors.muted}>{t('common.optional')}</Text>
        </Text>
        <Row gap={8} wrap>
          {(['1-2', '3-5', '6+'] as const).map((h) => (
            <Chip
              key={h}
              label={t(`availability.hours.${h}`)}
              selected={hours === h}
              onPress={() => onChange({ serve_mode: serveMode, hours_per_week: hours === h ? null : h })}
            />
          ))}
        </Row>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  grid: { gap: 8 },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  periodCol: { width: 92 },
  dayHead: { flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 13, color: colors.subtle },
  cell: {
    flex: 1,
    height: 44,
    borderRadius: radius.control - 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellOn: { backgroundColor: colors.purple, borderColor: colors.purple },
});
