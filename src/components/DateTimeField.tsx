import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { formatDayYear, formatTime } from '@/lib/format';
import { colors, fonts, radius } from '@/theme/tokens';

import { Icon } from './Icon';
import { Text } from './Text';

export type DateTimeFieldProps = {
  label: string;
  value: Date | null;
  onChange: (d: Date) => void;
  error?: string;
  hint?: string;
  optional?: boolean;
  placeholder?: string;
};

// Native implementation (web version lives in DateTimeField.web.tsx).
export function DateTimeField({ label, value, onChange, error, hint, optional, placeholder }: DateTimeFieldProps) {
  const current = value ?? defaultDate();

  const openAndroid = () => {
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      onValueChange: (_e, date) => {
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          minuteInterval: 5,
          onValueChange: (_e2, time) => onChange(time),
        });
      },
    });
  };

  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">
        {label}
        {optional ? <Text variant="label" weight="regular" color={colors.muted}> (optional)</Text> : null}
      </Text>
      {Platform.OS === 'ios' ? (
        <View style={[styles.box, error ? { borderColor: colors.danger } : null]}>
          <Icon name="calendar" size={18} color={colors.muted} />
          {value ? (
            <DateTimePicker value={current} mode="datetime" display="compact" minuteInterval={5} onValueChange={(_e, d) => onChange(d)} accessibilityLabel={label} />
          ) : (
            <Pressable accessibilityRole="button" onPress={() => onChange(current)} style={{ flex: 1 }}>
              <Text variant="bodySm" color={colors.muted}>{placeholder ?? 'Select date & time'}</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={openAndroid} style={[styles.box, error ? { borderColor: colors.danger } : null]}>
          <Icon name="calendar" size={18} color={colors.muted} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 16, color: value ? colors.text : colors.muted }}>
            {value ? `${formatDayYear(value.toISOString())} · ${formatTime(value.toISOString())}` : (placeholder ?? 'Select date & time')}
          </Text>
        </Pressable>
      )}
      {error ? <Text variant="caption" color={colors.danger}>{error}</Text> : hint ? <Text variant="caption">{hint}</Text> : null}
    </View>
  );
}

export function defaultDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(10, 0, 0, 0);
  return d;
}

const styles = StyleSheet.create({
  box: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.white,
  },
});
