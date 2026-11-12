import { router, usePathname } from 'expo-router';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/Chip';
import { Icon, type IconName } from '@/components/Icon';
import { Row, useLayout } from '@/components/Layout';
import { Logo } from '@/components/Logo';
import { Text } from '@/components/Text';
import { colors, fonts, radius } from '@/theme/tokens';

const NAV: { key: 'overview' | 'organizations' | 'users' | 'events' | 'audit'; href: '/admin' | '/admin/organizations' | '/admin/users' | '/admin/events' | '/admin/audit'; icon: IconName }[] = [
  { key: 'overview', href: '/admin', icon: 'grid' },
  { key: 'organizations', href: '/admin/organizations', icon: 'users' },
  { key: 'users', href: '/admin/users', icon: 'user' },
  { key: 'events', href: '/admin/events', icon: 'calendar' },
  { key: 'audit', href: '/admin/audit', icon: 'clipboard' },
];

/** Admin console frame: sidebar on desktop, a scrollable tab strip on phones and tablets. */
export function AdminShell({ children, pendingOrgs }: { children: ReactNode; pendingOrgs?: number }) {
  const { t } = useTranslation();
  const { isDesktop } = useLayout();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const active = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));
  const back = () => router.replace('/profile');

  if (isDesktop) {
    return (
      <View style={styles.desktop}>
        <View style={styles.sidebar}>
          <Logo size={40} />
          <Text variant="overline" color={colors.purple}>{t('admin.title')}</Text>
          <View accessibilityRole="tablist" style={{ gap: 4 }}>
            {NAV.map((n) => (
              <Pressable
                key={n.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active(n.href) }}
                onPress={() => router.navigate(n.href)}
                style={({ pressed }) => [styles.item, active(n.href) && styles.itemActive, pressed && !active(n.href) && { backgroundColor: colors.track }]}>
                <Icon name={n.icon} size={20} color={active(n.href) ? colors.purpleDark : colors.subtle} />
                <Text style={[styles.itemText, active(n.href) && { color: colors.purpleDark, fontFamily: fonts.semibold }]}>{t(`admin.nav.${n.key}`)}</Text>
                {n.key === 'organizations' && pendingOrgs ? <CountPill n={pendingOrgs} /> : null}
              </Pressable>
            ))}
          </View>
          <View style={{ flex: 1 }} />
          <Pressable accessibilityRole="link" onPress={back} style={styles.item}>
            <Icon name="chevronLeft" size={20} color={colors.subtle} />
            <Text style={styles.itemText}>{t('admin.backToApp')}</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 8, paddingTop: 4 }} gap={4}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('admin.backToApp')} onPress={back} style={styles.back}>
          <Icon name="chevronLeft" size={22} />
        </Pressable>
        <Text variant="title">{t('admin.title')}</Text>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.strip}>
        {NAV.map((n) => (
          <Pressable
            key={n.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active(n.href) }}
            onPress={() => router.navigate(n.href)}
            style={[styles.chip, active(n.href) && styles.chipActive]}>
            <Text style={{ fontSize: 14, fontFamily: active(n.href) ? fonts.semibold : fonts.medium, color: active(n.href) ? colors.white : colors.text }}>
              {t(`admin.nav.${n.key}`)}
            </Text>
            {n.key === 'organizations' && pendingOrgs ? <CountPill n={pendingOrgs} light={active(n.href)} /> : null}
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function CountPill({ n, light }: { n: number; light?: boolean }) {
  return (
    <View style={[styles.count, light && { backgroundColor: colors.white }]}>
      <Text style={{ fontSize: 11, lineHeight: 14, fontFamily: fonts.bold, color: light ? colors.purple : colors.white }}>{n}</Text>
    </View>
  );
}

export function providerLabel(u: { providers: string[] }) {
  return u.providers.map((p) => (p === 'email' ? 'Email' : p.charAt(0).toUpperCase() + p.slice(1))).join(', ') || '—';
}

export function OrgStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const tone = status === 'approved' ? 'success' : status === 'pending' ? 'amber' : status === 'suspended' ? 'danger' : 'plain';
  return <Badge label={t(`admin.status.${status}`)} tone={tone} />;
}

export function UserBadges({ admin, blocked }: { admin: boolean; blocked: boolean }) {
  const { t } = useTranslation();
  return (
    <Row gap={6} wrap>
      {blocked ? <Badge label={t('admin.users.blocked')} tone="danger" icon="lock" /> : <Badge label={t('admin.users.active')} tone="success" />}
      {admin ? <Badge label={t('admin.users.admin')} tone="purple" icon="shield" /> : null}
    </Row>
  );
}

/** A simple bordered table that turns into stacked cards on narrow screens. */
export function Table<T>({
  columns,
  rows,
  onPress,
  keyOf,
  card,
}: {
  columns: { label: string; flex?: number; render: (row: T) => ReactNode }[];
  rows: T[];
  onPress?: (row: T) => void;
  keyOf: (row: T) => string;
  card: (row: T) => ReactNode;
}) {
  const { isDesktop } = useLayout();
  if (!isDesktop) {
    return (
      <View style={{ gap: 10 }}>
        {rows.map((r) =>
          onPress ? (
            <Pressable key={keyOf(r)} accessibilityRole="button" onPress={() => onPress(r)} style={({ pressed }) => [styles.card, pressed && { backgroundColor: '#FBF8F3' }]}>
              {card(r)}
            </Pressable>
          ) : (
            <View key={keyOf(r)} style={styles.card}>
              {card(r)}
            </View>
          ),
        )}
      </View>
    );
  }
  return (
    <View style={styles.table}>
      <View style={[styles.tr, styles.th]}>
        {columns.map((c) => (
          <Text key={c.label} variant="small" color={colors.muted} style={{ flex: c.flex ?? 1 }}>{c.label}</Text>
        ))}
      </View>
      {rows.map((r) => {
        const cells = columns.map((c, i) => (
          <View key={`${c.label}-${i}`} style={{ flex: c.flex ?? 1 }}>{c.render(r)}</View>
        ));
        return onPress ? (
          <Pressable key={keyOf(r)} accessibilityRole="button" onPress={() => onPress(r)} style={({ pressed }) => [styles.tr, pressed && { backgroundColor: colors.cream }]}>
            {cells}
          </Pressable>
        ) : (
          <View key={keyOf(r)} style={styles.tr}>{cells}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  desktop: { flex: 1, flexDirection: 'row', backgroundColor: colors.cream },
  sidebar: { width: 264, paddingVertical: 24, paddingHorizontal: 16, gap: 18, backgroundColor: colors.white, borderRightWidth: 1, borderRightColor: colors.borderSoft },
  item: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: radius.control },
  itemActive: { backgroundColor: colors.purpleTint },
  itemText: { flex: 1, fontSize: 15, fontFamily: fonts.medium, color: colors.subtle },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  strip: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  chip: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  count: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 999, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' },
  table: { borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.card, backgroundColor: colors.white, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  th: { borderTopWidth: 0, paddingVertical: 10, backgroundColor: colors.cream },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.card, padding: 14, gap: 6 },
});
