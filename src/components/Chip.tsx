import { Pressable, StyleSheet, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

// Toggle chip (interests, quick filters).
export function Chip({
  label,
  selected,
  onPress,
  icon,
  dashed,
  size = 'md',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  dashed?: boolean;
  size?: 'sm' | 'md';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { height: size === 'sm' ? 40 : 44 },
        selected ? styles.selected : null,
        dashed ? styles.dashed : null,
        pressed && { opacity: 0.85 },
      ]}>
      {selected ? <Icon name="check" size={size === 'sm' ? 14 : 16} color={colors.white} /> : icon ? <Icon name={icon} size={16} /> : null}
      <Text
        style={{
          fontSize: size === 'sm' ? 14 : 15,
          lineHeight: 20,
          fontFamily: selected ? fonts.medium : fonts.regular,
          color: selected ? colors.white : colors.text,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

export type BadgeTone = 'purple' | 'amber' | 'neutral' | 'danger' | 'success' | 'plain';

const tones: Record<BadgeTone, { bg: string; fg: string }> = {
  purple: { bg: colors.purpleTint, fg: colors.purpleDark },
  amber: { bg: colors.amberTint, fg: colors.amberTextDark },
  neutral: { bg: colors.sandSoft, fg: colors.subtle },
  danger: { bg: colors.dangerTint, fg: colors.danger },
  success: { bg: colors.successTint, fg: colors.success },
  plain: { bg: colors.track, fg: colors.subtle },
};

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: BadgeTone; icon?: IconName }) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {icon ? <Icon name={icon} size={12} color={t.fg} strokeWidth={2.2} /> : null}
      <Text style={{ fontSize: 12, lineHeight: 16, fontFamily: fonts.semibold, color: t.fg }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  selected: { backgroundColor: colors.purple, borderColor: colors.purple, paddingLeft: 12 },
  dashed: { borderStyle: 'dashed', borderColor: '#BDB6AB', backgroundColor: 'transparent' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
});
