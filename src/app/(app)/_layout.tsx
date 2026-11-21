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

type Tab = {
  name: string;
  href: '/discover' | '/my-seva' | '/availability' | '/profile' | '/dashboard' | '/events' | '/reviews' | '/give' | '/donations' | '/volunteers' | '/teams' | '/regions' | '/impact';
  label: string;
  icon: IconName;
  badge?: number;
};

const ALL = ['discover', 'my-seva', 'availability', 'profile', 'dashboard', 'events', 'reviews', 'give', 'donations', 'volunteers', 'teams', 'regions', 'impact'] as const;

// Dark (plum) sidebar on desktop, SevaConnect style.
const side = { text: '#E4D9F1', muted: '#B9A8D0', active: 'rgba(255,255,255,0.13)', hover: 'rgba(255,255,255,0.07)', line: 'rgba(255,255,255,0.12)' };

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
    ? isDesktop
      ? [
          { name: 'dashboard', href: '/dashboard', label: t('nav.dashboard'), icon: 'grid' },
          { name: 'volunteers', href: '/volunteers', label: t('nav.volunteers'), icon: 'users' },
          { name: 'events', href: '/events', label: t('nav.eventsCalendar'), icon: 'calendar' },
          { name: 'teams', href: '/teams', label: t('nav.teams'), icon: 'layers' },
          { name: 'regions', href: '/regions', label: t('nav.regions'), icon: 'globe' },
          { name: 'impact', href: '/impact', label: t('nav.impact'), icon: 'chart' },
          { name: 'reviews', href: '/reviews', label: t('nav.reviews'), icon: 'clipboard', badge: badges.pendingReviews },
          { name: 'donations', href: '/donations', label: t('nav.donations'), icon: 'heart' },
          { name: 'profile', href: '/profile', label: t('nav.profile'), icon: 'user' },
        ]
      : [
          { name: 'dashboard', href: '/dashboard', label: t('nav.dashboard'), icon: 'grid' },
          { name: 'events', href: '/events', label: t('nav.events'), icon: 'calendar' },
          { name: 'volunteers', href: '/volunteers', label: t('nav.volunteers'), icon: 'users' },
          { name: 'reviews', href: '/reviews', label: t('nav.reviews'), icon: 'clipboard', badge: badges.pendingReviews },
          { name: 'profile', href: '/profile', label: t('nav.profile'), icon: 'user' },
        ]
    : [
        { name: 'discover', href: '/discover', label: t('nav.discover'), icon: 'compass' },
        { name: 'my-seva', href: '/my-seva', label: t('nav.mySeva'), icon: 'clipboard', badge: badges.activeSeva },
        { name: 'availability', href: '/availability', label: t('nav.availability'), icon: 'calendar' },
        { name: 'give', href: '/give', label: t('nav.give'), icon: 'heart' },
        { name: 'profile', href: '/profile', label: t('nav.profile'), icon: 'user' },
      ];

  const isActive = (tab: Tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`);

  if (isDesktop) {
    return (
      <NavigationContent>
        <View style={styles.desktop}>
          <View style={styles.sidebar}>
            <Pressable accessibilityRole="link" onPress={() => router.navigate(organizer ? '/dashboard' : '/discover')}>
              <Logo size={40} onDark />
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
                    <Text style={{ fontSize: 13, fontFamily: mode === m ? fonts.semibold : fonts.medium, color: mode === m ? colors.plum : side.text }}>
                      {m === 'volunteer' ? t('nav.volunteerMode') : t('nav.organizerMode')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {profile?.is_platform_admin ? (
              <Pressable accessibilityRole="link" onPress={() => router.push('/admin')} style={({ pressed }) => [styles.adminLink, pressed && { opacity: 0.85 }]}>
                <Icon name="shield" size={18} color={colors.white} />
                <Text style={{ flex: 1, fontSize: 14, fontFamily: fonts.semibold, color: colors.white }}>{t('profile.adminConsole')}</Text>
                {badges.pendingOrgs ? <CountBadge n={badges.pendingOrgs} /> : null}
              </Pressable>
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
                    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                      styles.sideItem,
                      active && styles.sideItemActive,
                      (pressed || hovered) && !active && { backgroundColor: side.hover },
                    ]}>
                    <Icon name={tab.icon} size={20} color={active ? colors.white : side.muted} />
                    <Text style={{ flex: 1, fontSize: 15, fontFamily: active ? fonts.semibold : fonts.medium, color: active ? colors.white : side.text }}>
                      {tab.label}
                    </Text>
                    {tab.badge ? <CountBadge n={tab.badge} /> : null}
                  </Pressable>
                );
              })}
              {session ? (
                <Pressable accessibilityRole="link" onPress={() => router.push('/notifications')} style={styles.sideItem}>
                  <Icon name="bell" size={20} color={side.muted} />
                  <Text style={{ flex: 1, fontSize: 15, fontFamily: fonts.medium, color: side.text }}>{t('nav.notifications')}</Text>
                  {badges.unread ? <CountBadge n={badges.unread} /> : null}
                </Pressable>
              ) : null}
            </View>
            <View style={{ flex: 1 }} />
            {session && profile ? (
              <Pressable accessibilityRole="link" onPress={() => router.navigate('/profile')} style={styles.userBlock}>
                <Avatar name={profile.full_name || profile.email || '?'} size={36} />
                <View style={{ flex: 1 }}>
                  <Text variant="label" numberOfLines={1} color={colors.white}>{profile.full_name || profile.email}</Text>
                  <Text variant="small" color={side.muted}>
                    {canOrganize ? `${t('nav.volunteerMode')} · ${t('nav.organizerMode')}` : t('nav.volunteerMode')}
                  </Text>
                </View>
              </Pressable>
            ) : (
              <Pressable accessibilityRole="link" onPress={() => router.push('/sign-in')} style={styles.userBlock}>
                <Icon name="user" size={20} color={colors.white} />
                <Text variant="label" color={colors.white}>{t('auth.signIn')}</Text>
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
    backgroundColor: colors.plum,
  },
  modeSwitch: { flexDirection: 'row', padding: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.10)' },
  adminLink: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  modeTab: { flex: 1, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  modeTabActive: { backgroundColor: colors.white },
  sideItem: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: radius.control },
  sideItemActive: { backgroundColor: side.active },
  userBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.control, backgroundColor: 'rgba(255,255,255,0.08)' },
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
    backgroundColor: colors.deepOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
