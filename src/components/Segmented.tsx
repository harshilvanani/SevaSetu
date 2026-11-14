import { Pressable, StyleSheet, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

import { Icon } from './Icon';
import { Text } from './Text';

// Pill tabs (Sign in / Create account, Active / Upcoming / Completed).
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.wrap}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.tab, active && styles.active]}>
            <Text style={{ fontSize: 14, fontFamily: active ? fonts.semibold : fonts.medium, color: active ? colors.text : colors.muted }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Large selectable option cards (task type, participation mode, visibility).
export function OptionCards<T extends string>({
  options,
  value,
  onChange,
  label,
  columns = 2,
}: {
  options: { value: T; title: string; body?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
  columns?: number;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.cards}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => onChange(o.value)}
            style={[styles.card, { flexBasis: `${100 / columns - 3}%` }, active && styles.cardActive]}>
            <View style={styles.cardHead}>
              <Text variant="title" style={{ flex: 1 }}>{o.title}</Text>
              <View style={[styles.radio, active && styles.radioActive]}>
                {active ? <Icon name="check" size={12} color={colors.white} strokeWidth={3} /> : null}
              </View>
            </View>
            {o.body ? <Text variant="caption">{o.body}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', padding: 4, borderRadius: 12, backgroundColor: colors.track },
  tab: { flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  active: {
    backgroundColor: colors.white,
    shadowColor: '#222',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    flexGrow: 1,
    minWidth: 140,
    padding: 14,
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  cardActive: { borderColor: colors.purple, borderWidth: 2, padding: 13, backgroundColor: '#FBF7FD' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radio: { width: 20, height: 20, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { backgroundColor: colors.purple, borderColor: colors.purple },
});
