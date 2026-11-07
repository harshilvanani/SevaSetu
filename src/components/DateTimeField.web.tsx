import { createElement } from 'react';
import { View } from 'react-native';

import { colors } from '@/theme/tokens';

import type { DateTimeFieldProps } from './DateTimeField';
import { Text } from './Text';

export type { DateTimeFieldProps } from './DateTimeField';

// "YYYY-MM-DDTHH:mm" in local time for <input type="datetime-local">.
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DateTimeField({ label, value, onChange, error, hint, optional }: DateTimeFieldProps) {
  const id = `dt-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <View style={{ gap: 6 }}>
      {createElement(
        'label',
        { htmlFor: id, style: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, lineHeight: '20px', color: colors.text } },
        label,
        optional ? createElement('span', { style: { fontFamily: 'Poppins_400Regular', color: colors.muted } }, ' (optional)') : null,
      )}
      {createElement('input', {
        id,
        type: 'datetime-local',
        step: 300,
        value: value ? toLocalInput(value) : '',
        onChange: (e: { target: { value: string } }) => {
          if (e.target.value) onChange(new Date(e.target.value));
        },
        'aria-invalid': !!error,
        style: {
          height: 50,
          padding: '0 14px',
          border: `1px solid ${error ? colors.danger : colors.border}`,
          borderRadius: 12,
          background: colors.white,
          fontFamily: 'Poppins_400Regular',
          fontSize: 16,
          color: colors.text,
          boxSizing: 'border-box',
          width: '100%',
        },
      })}
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
