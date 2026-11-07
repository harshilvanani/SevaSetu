import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

import { Icon } from './Icon';

// Quantity stepper with − / + buttons and a typed value, clamped to [min, max].
export function Stepper({
  value,
  onChange,
  min = 1,
  max,
  label,
  size = 'md',
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max: number;
  label: string;
  size?: 'md' | 'lg';
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
  const h = size === 'lg' ? 52 : 48;
  return (
    <View style={[styles.wrap, { height: h }]} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, now: value }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        disabled={value <= min}
        onPress={() => onChange(clamp(value - 1))}
        style={[styles.btn, { width: h }, value <= min && { opacity: 0.35 }]}>
        <Icon name="minus" size={20} />
      </Pressable>
      <TextInput
        accessibilityLabel={label}
        value={String(value)}
        onChangeText={(s) => onChange(clamp(parseInt(s.replace(/\D/g, ''), 10)))}
        keyboardType="number-pad"
        selectTextOnFocus
        style={styles.input}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        disabled={value >= max}
        onPress={() => onChange(clamp(value + 1))}
        style={[styles.btn, { width: h }, value >= max && { opacity: 0.35 }]}>
        <Icon name="plus" size={20} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  btn: { height: '100%', alignItems: 'center', justifyContent: 'center' },
  input: {
    width: 52,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.text,
    paddingHorizontal: 4,
    outlineWidth: 0,
  },
});
