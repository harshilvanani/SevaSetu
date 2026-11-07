import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { breakpoints, colors, fonts, radius, shadow } from '@/theme/tokens';

import { Icon } from './Icon';
import { Text } from './Text';

export function useLayout() {
  const { width } = useWindowDimensions();
  return {
    width,
    isPhone: width < breakpoints.tablet,
    isTablet: width >= breakpoints.tablet && width < breakpoints.desktop,
    isDesktop: width >= breakpoints.desktop,
  };
}

// Scrollable page with cream background, safe areas and a centered max-width column.
export function Screen({
  children,
  scroll = true,
  maxWidth = 1120,
  padded = true,
  footer,
  header,
  contentStyle,
  edges = ['top'],
}: {
  children: ReactNode;
  scroll?: boolean;
  maxWidth?: number;
  padded?: boolean;
  footer?: ReactNode;
  header?: ReactNode;
  contentStyle?: ViewStyle;
  edges?: ('top' | 'bottom')[];
}) {
  const insets = useSafeAreaInsets();
  const { isPhone } = useLayout();
  const pad = padded ? (isPhone ? 16 : 32) : 0;
  const inner = (
    <View style={[{ width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: pad, gap: 20 }, contentStyle]}>
      {children}
    </View>
  );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { paddingTop: edges.includes('top') ? insets.top : 0 }]}>
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingTop: 8, paddingBottom: (edges.includes('bottom') ? insets.bottom : 0) + 32 }}
          keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{inner}</View>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', gap: 10 }}>{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.card, style, pressed && { backgroundColor: '#FBF8F3' }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, gap = 8, style, wrap }: { children: ReactNode; gap?: number; style?: ViewStyle; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, wrap && { flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Divider({ color = colors.divider }: { color?: string }) {
  return <View style={{ height: 1, backgroundColor: color, alignSelf: 'stretch' }} />;
}

export function SectionHeader({ title, action, onAction, count }: { title: string; action?: string; onAction?: () => void; count?: number }) {
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Text variant="h3" accessibilityRole="header">{title}</Text>
      {action ? (
        <Pressable accessibilityRole="link" onPress={onAction} hitSlop={10}>
          <Text variant="label" color={colors.purple}>{action}</Text>
        </Pressable>
      ) : count !== undefined ? (
        <Text variant="caption">{count}</Text>
      ) : null}
    </Row>
  );
}

// Back button + title header for stack screens.
export function TopBar({ title, onBack, right }: { title?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={styles.topBar}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}>
          <Icon name="chevronLeft" size={22} />
        </Pressable>
      ) : (
        <View style={{ width: 44 }} />
      )}
      <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 15, color: colors.subtle }} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function Avatar({ name, size = 40, color = colors.amber }: { name: string; size?: number; color?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '·';
  return (
    <View style={{ width: size, height: size, borderRadius: 999, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.33, color: colors.text }}>{initials}</Text>
    </View>
  );
}

export function EmptyState({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <View style={[styles.card, { alignItems: 'center', paddingVertical: 32, gap: 10 }]}>
      <Text variant="h3" align="center">{title}</Text>
      {body ? <Text variant="bodySm" color={colors.muted} align="center" style={{ maxWidth: 420 }}>{body}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.card,
    padding: 16,
    gap: 10,
    ...shadow,
  },
  footer: {
    paddingTop: 16,
    paddingHorizontal: 24,
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control },
});
