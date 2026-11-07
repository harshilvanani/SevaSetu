import { ActivityIndicator, Pressable, type PressableProps, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'light' | 'outlineLight' | 'danger';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: Variant;
  size?: 'md' | 'lg';
  icon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
};

const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.charcoal, fg: colors.white },
  secondary: { bg: colors.sand, fg: colors.text },
  outline: { bg: colors.white, fg: colors.text, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.purple },
  light: { bg: colors.cream, fg: colors.purpleDark },
  outlineLight: { bg: 'transparent', fg: colors.cream, border: 'rgba(253,251,247,0.55)' },
  danger: { bg: colors.white, fg: colors.danger, border: colors.border },
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  fullWidth,
  style,
  ...rest
}: Props) {
  const p = palette[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { height: size === 'lg' ? 52 : 46, backgroundColor: p.bg },
        p.border ? { borderWidth: 1, borderColor: p.border } : null,
        fullWidth ? { alignSelf: 'stretch' } : null,
        pressed && { opacity: 0.85 },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={18} color={p.fg} /> : null}
          <Text style={{ color: p.fg, fontFamily: fonts.semibold, fontSize: size === 'lg' ? 16 : 15 }}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.control,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

export function IconButton({
  icon,
  label,
  onPress,
  badge,
  color = colors.text,
  size = 44,
  bordered,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  badge?: number | boolean;
  color?: string;
  size?: number;
  bordered?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: radius.control,
          alignItems: 'center',
          justifyContent: 'center',
        },
        bordered && { borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.white },
        pressed && { backgroundColor: colors.track },
      ]}>
      <Icon name={icon} size={22} color={color} />
      {typeof badge === 'number' && badge > 0 ? (
        <View style={badgeStyles.count}>
          <Text style={badgeStyles.countText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : badge ? (
        <View style={badgeStyles.dot} />
      ) : null}
    </Pressable>
  );
}

const badgeStyles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.amber,
    borderWidth: 2,
    borderColor: colors.cream,
  },
  count: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: colors.white, fontSize: 11, lineHeight: 14, fontFamily: fonts.bold },
});
