import { router, usePathname } from 'expo-router';
import { TabSlot, useTabsWithTriggers } from 'expo-router/ui';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { Avatar, useLayout } from '@/components/Layout';
import { Logo } from '@/components/Logo';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useNavBadges } from '@/features/shell/badges';
import { useAppStore } from '@/lib/store';
import { colors, fonts, radius } from '@/theme/tokens';

type Tab = { name: string; href: '/discover' | '/my-seva' | '/availability' | '/profile' | '/dashboard' | '/events' | '/reviews'; label: string; icon: IconName; badge?: number };

const ALL = ['discover', 'my-seva', 'availability', 'profile', 'dashboard', 'events', 'reviews'] as const;

export default function AppShell() {
  const { t } = useTranslation();
  const { isDesktop } = useLayout();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { session, profile, memberships } = useAuth();
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const badges = useNavBadges();
  const canOrganize = memberships.length > 0;
  const organizer = canOrganize && mode === 'organizer';

  const { NavigationContent } = useTabsWithTriggers({
    triggers: ALL.map((name) => ({ type: 'internal' as const, name, href: `/${name}` as Tab['href'] })),
  });

  const tabs: Tab[] = organizer
    ? [
        { name: 'dashboard', href: '/dashboard', label: t('nav.dashboard'), icon: 'grid' },
        { name: 'events', href: '/events', label: t('nav.events'), icon: 'calendar' },
        { name: 'reviews', href: '/reviews', label: t('nav.reviews'), icon: 'clipboard', badge: badges.pendingReviews },
        { name: 'profile', href: '/profile', label: t('nav.profile'), icon: 'user' },
      ]
    : [
        { name: 'discover', href: '/discover', label: t('nav.discover'), icon: 'compass' },
        { name: 'my-seva', href: '/my-seva', label: t('nav.mySeva'), icon: 'clipboard', badge: badges.activeSeva },
        { name: 'availability', href: '/availability', label: t('nav.availability'), icon: 'calendar' },
        { name: 'profile', href: '/profile', label: t('nav.profile'), icon: 'user' },
      ];

  const isActive = (tab: Tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`);

  if (isDesktop) {
    return (
      <NavigationContent>
        <View style={styles.desktop}>
          <View style={styles.sidebar}>
            <Pressable accessibilityRole="link" onPress={() => router.navigate(organizer ? '/dashboard' : '/discover')}>
              <Logo size={40} />
            </Pressable>
            {canOrganize ? (
              <View accessibilityRole="tablist" accessibilityLabel="Mode" style={styles.modeSwitch}>
                {(['volunteer', 'organizer'] as const).map((m) => (
                  <Pressable
                    key={m}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: mode === m }}
                    onPress={() => {
                      setMode(m);
                      router.navigate(m === 'organizer' ? '/dashboard' : '/discover');
                    }}
                    style={[styles.modeTab, mode === m && styles.modeTabActive]}>
                    <Text style={{ fontSize: 13, fontFamily: mode === m ? fonts.semibold : fonts.medium, color: mode === m ? colors.text : colors.muted }}>
                      {m === 'volunteer' ? t('nav.volunteerMode') : t('nav.organizerMode')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View accessibilityRole="tablist" style={{ gap: 4 }}>
              {tabs.map((tab) => {
                const active = isActive(tab);
                return (
                  <Pressable
                    key={tab.name}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => router.navigate(tab.href)}
                    style={({ pressed }) => [styles.sideItem, active && styles.sideItemActive, pressed && !active && { backgroundColor: colors.track }]}>
                    <Icon name={tab.icon} size={20} color={active ? colors.purpleDark : colors.subtle} />
                    <Text style={{ flex: 1, fontSize: 15, fontFamily: active ? fonts.semibold : fonts.medium, color: active ? colors.purpleDark : colors.subtle }}>
                      {tab.label}
                    </Text>
                    {tab.badge ? <CountBadge n={tab.badge} /> : null}
                  </Pressable>
                );
              })}
              {session ? (
                <Pressable accessibilityRole="link" onPress={() => router.push('/notifications')} style={styles.sideItem}>
                  <Icon name="bell" size={20} color={colors.subtle} />
                  <Text style={{ flex: 1, fontSize: 15, fontFamily: fonts.medium, color: colors.subtle }}>{t('nav.notifications')}</Text>
                  {badges.unread ? <CountBadge n={badges.unread} /> : null}
                </Pressable>
              ) : null}
            </View>
            <View style={{ flex: 1 }} />
            {session && profile ? (
              <Pressable accessibilityRole="link" onPress={() => router.navigate('/profile')} style={styles.userBlock}>
                <Avatar name={profile.full_name || profile.email || '?'} size={36} />
                <View style={{ flex: 1 }}>
                  <Text variant="label" numberOfLines={1}>{profile.full_name || profile.email}</Text>
                  <Text variant="small" color={colors.muted}>
                    {canOrganize ? `${t('nav.volunteerMode')} · ${t('nav.organizerMode')}` : t('nav.volunteerMode')}
                  </Text>
                </View>
              </Pressable>
            ) : (
              <Pressable accessibilityRole="link" onPress={() => router.push('/sign-in')} style={styles.userBlock}>
                <Icon name="user" size={20} />
                <Text variant="label">{t('auth.signIn')}</Text>
              </Pressable>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <TabSlot style={{ flex: 1 }} />
          </View>
        </View>
      </NavigationContent>
    );
  }

  return (
    <NavigationContent>
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <TabSlot style={{ flex: 1 }} />
        <View accessibilityRole="tablist" style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {tabs.map((tab) => {
            const active = isActive(tab);
            return (
              <Pressable
                key={tab.name}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tab.badge ? `${tab.label}, ${tab.badge}` : tab.label}
                onPress={() => router.navigate(tab.href)}
                style={styles.bottomItem}>
                <View style={[styles.pill, active && { backgroundColor: colors.purpleTint }]}>
                  <Icon name={tab.icon} size={22} color={active ? colors.purpleDark : colors.subtle} />
                </View>
                <Text style={{ fontSize: 12, lineHeight: 16, fontFamily: active ? fonts.semibold : fonts.medium, color: active ? colors.purpleDark : colors.subtle }}>
                  {tab.label}
                </Text>
                {tab.badge ? (
                  <View style={styles.bottomBadge}>
                    <CountBadge n={tab.badge} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </NavigationContent>
  );
}

function CountBadge({ n }: { n: number }) {
  return (
    <View style={styles.count}>
      <Text style={{ color: colors.white, fontSize: 11, lineHeight: 14, fontFamily: fonts.bold }}>{n > 9 ? '9+' : n}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  desktop: { flex: 1, flexDirection: 'row', backgroundColor: colors.cream },
  sidebar: {
    width: 264,
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 20,
    borderRightWidth: 1,
    borderRightColor: colors.borderSoft,
    backgroundColor: colors.white,
  },
  modeSwitch: { flexDirection: 'row', padding: 4, borderRadius: 12, backgroundColor: colors.track },
  modeTab: { flex: 1, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  modeTabActive: { backgroundColor: colors.white },
  sideItem: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: radius.control },
  sideItemActive: { backgroundColor: colors.purpleTint },
  userBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.control, backgroundColor: colors.cream },
  bottomBar: {
    flexDirection: 'row',
    paddingTop: 6,
    paddingHorizontal: 8,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  bottomItem: { flex: 1, height: 58, alignItems: 'center', justifyContent: 'center', gap: 4 },
  pill: { width: 56, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  bottomBadge: { position: 'absolute', top: 0, left: '55%' },
  count: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
