import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { SearchField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Avatar, EmptyState, Row, Screen, SectionHeader, useLayout } from '@/components/Layout';
import { Logo } from '@/components/Logo';
import { Text } from '@/components/Text';
import { fitsAvailability, joinState, slotOf } from '@/domain/seva';
import { useAuth } from '@/features/auth/AuthProvider';
import { INTERESTS, useAvailability } from '@/features/profile/prefs';
import {
  type TaskWithEvent,
  taskDistance,
  taskStart,
  useDiscoverTasks,
  useMyAssignments,
  useMyInvitations,
} from '@/features/seva/api';
import { ActiveSevaCard, SevaCard, SevaDateRow, SevaRow } from '@/features/seva/components';
import { useMyMatchScores } from '@/features/insights/api';
import { PrivateEventsSection } from '@/features/seva/PrivateEvents';
import { useNavBadges } from '@/features/shell/badges';
import { firstName, greetingKey } from '@/lib/format';
import { colors, fonts, radius } from '@/theme/tokens';

type Filters = {
  q: string;
  fitsWeek: boolean;
  weekend: boolean;
  virtual: boolean;
  nearby: boolean;
  categories: string[];
  modes: ('onsite' | 'virtual' | 'hybrid')[];
  maxKm: number | null;
};

const EMPTY: Filters = { q: '', fitsWeek: false, weekend: false, virtual: false, nearby: false, categories: [], modes: [], maxKm: null };

function isThisWeekend(iso: string | null, now = new Date()) {
  if (!iso) return false;
  const d = new Date(iso);
  const days = (d.getTime() - now.getTime()) / 86_400_000;
  const { weekday } = slotOf(d);
  return days >= -0.5 && days <= 7 && weekday >= 5;
}

export default function DiscoverScreen() {
  const { t } = useTranslation();
  const { isPhone, isDesktop } = useLayout();
  const { session, profile } = useAuth();
  const tasks = useDiscoverTasks();
  const assignments = useMyAssignments();
  const invitations = useMyInvitations();
  const slots = useAvailability();
  const badges = useNavBadges();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sheet, setSheet] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // Two rows of public seva, then private events, then the rest on request.
  const firstCount = (isPhone ? 1 : isDesktop ? 3 : 2) * 2;

  const nearKm = profile?.radius_km && profile.radius_km <= 10 ? profile.radius_km : 5;
  const origin = profile ? { latitude: profile.latitude, longitude: profile.longitude } : null;
  const joinedIds = useMemo(
    () => new Set((assignments.data ?? []).filter((a) => a.status !== 'cancelled').map((a) => a.task_id)),
    [assignments.data],
  );

  const all = useMemo(() => tasks.data ?? [], [tasks.data]);
  const matchScores = useMyMatchScores(session ? all.map((x) => x.id) : []);
  const matchOf = (id: string) => matchScores.data?.[id]?.score;
  const dist = (task: TaskWithEvent) => taskDistance(task, origin);

  const matches = (task: TaskWithEvent, f: Filters) => {
    const q = f.q.trim().toLowerCase();
    if (q && ![task.title, task.description, task.events.title, task.events.organizations?.name, task.category ? t(`interests.${task.category}`) : '']
      .some((s) => s?.toLowerCase().includes(q))) return false;
    if (f.fitsWeek && !fitsAvailability(taskStart(task), slots.data ?? [])) return false;
    if (f.weekend && !isThisWeekend(taskStart(task))) return false;
    if (f.virtual && task.mode === 'onsite') return false;
    const km = dist(task);
    if (f.nearby && task.mode !== 'virtual' && (km == null || km > nearKm)) return false;
    if (f.maxKm != null && task.mode !== 'virtual' && (km == null || km > f.maxKm)) return false;
    if (f.categories.length && !f.categories.includes(task.category ?? '')) return false;
    if (f.modes.length && !f.modes.includes(task.mode)) return false;
    return true;
  };

  const filtered = all.filter((task) => matches(task, filters));
  const activeCount =
    [filters.fitsWeek, filters.weekend, filters.virtual, filters.nearby, filters.maxKm != null].filter(Boolean).length +
    filters.categories.length +
    filters.modes.length;
  const filtering = activeCount > 0 || filters.q.trim().length > 0;

  const interests = profile?.interests ?? [];
  const recommended = all
    .filter((task) => !joinedIds.has(task.id) && joinState(task) === 'open' && task.visibility === 'public')
    .map((task) => ({
      task,
      score: matchScores.data?.[task.id]?.score ?? (interests.includes(task.category ?? '') ? 3 : 0) +
        (fitsAvailability(taskStart(task), slots.data ?? []) && taskStart(task) ? 2 : 0) +
        (profile?.serve_mode === 'virtual' && task.mode !== 'onsite' ? 1 : 0) +
        (profile?.serve_mode === 'onsite' && task.mode !== 'virtual' ? 1 : 0),
    }))
    .filter((x) => x.score > 0 || interests.length === 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, isDesktop ? 3 : 6)
    .map((x) => x.task);

  const publicList = filtered.filter((task) => task.visibility === 'public');
  const hasHistory = (assignments.data ?? []).length > 0;
  const hasActive = (assignments.data ?? []).some((a) => a.status === 'active');
  const goodFirst = all.filter((task) => joinState(task) === 'open' && task.visibility === 'public').slice(0, 3);

  const name = firstName(profile?.full_name);
  const greeting = !session ? t('discover.welcomeGuest') : !hasHistory ? t('discover.welcome', { name }) : t(greetingKey(), { name });
  const city = profile?.city;

  const toggle = (key: 'fitsWeek' | 'weekend' | 'virtual' | 'nearby') => setFilters((f) => ({ ...f, [key]: !f[key] }));

  const refreshing = tasks.isRefetching || assignments.isRefetching;
  const refresh = () => {
    tasks.refetch();
    assignments.refetch();
    invitations.refetch();
  };

  return (
    <Screen title={t('nav.discover')} refreshing={refreshing} onRefresh={refresh}>
      <Row style={{ justifyContent: 'space-between' }}>
        {session ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${city ?? t('onboarding.cityLabel')}. ${t('discover.changeLocation')}`}
            onPress={() => router.push('/availability')}
            style={styles.locBtn}>
            <Icon name="mapPin" size={18} color={colors.purple} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15 }} numberOfLines={1}>{city ?? t('discover.changeLocation')}</Text>
            <Icon name="chevronDown" size={16} />
          </Pressable>
        ) : (
          <Logo size={34} subtitle={false} />
        )}
        {session && !isDesktop ? (
          <Row gap={6}>
            <IconButton icon="bell" label={t('discover.notifications', { count: badges.unread })} badge={badges.unread > 0} onPress={() => router.push('/notifications')} />
            <Pressable accessibilityRole="button" accessibilityLabel={t('nav.profile')} onPress={() => router.navigate('/profile')}>
              <Avatar name={profile?.full_name || profile?.email || '?'} size={40} />
            </Pressable>
          </Row>
        ) : !session ? (
          <Button title={t('auth.signIn')} variant="outline" onPress={() => router.push('/sign-in')} />
        ) : null}
      </Row>

      <Row gap={8}>
        <SearchField value={filters.q} onChangeText={(q) => setFilters((f) => ({ ...f, q }))} placeholder={t('discover.search')} />
        <View>
          <IconButton
            icon="filter"
            bordered
            size={48}
            label={activeCount ? t('discover.filtersActive', { count: activeCount }) : t('discover.filters')}
            badge={activeCount}
            onPress={() => setSheet(true)}
          />
        </View>
      </Row>

      <Text variant="h2">{greeting}</Text>

      {!session ? (
        <Pressable accessibilityRole="link" onPress={() => router.push('/sign-in')} style={styles.guest}>
          <Icon name="info" size={18} color={colors.amberText} />
          <Text variant="bodySm" color={colors.amberText} style={{ flex: 1 }}>{t('discover.guestBanner')}</Text>
          <Icon name="chevronRight" size={16} color={colors.amberText} />
        </Pressable>
      ) : null}

      {hasActive ? (
        <ActiveSevaCard assignments={assignments.data ?? []} />
      ) : session && !hasHistory && !assignments.isPending ? (
        <View style={styles.welcome}>
          <Text variant="h3">{t('discover.noJoinsTitle')}</Text>
          <Text variant="bodySm" color={colors.body}>{t('discover.noJoinsBody')}</Text>
          <Button title={t('discover.explore')} onPress={() => setFilters(EMPTY)} style={isPhone ? undefined : { alignSelf: 'flex-start' }} />
          {!profile?.interests.length ? (
            <Pressable accessibilityRole="link" onPress={() => router.push('/availability')} style={{ alignSelf: 'center', padding: 6 }}>
              <Text variant="label" color={colors.purple}>{t('discover.finishProfile')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }} style={isPhone ? { marginHorizontal: -16, paddingLeft: 16 } : undefined}>
        {session ? <Chip size="sm" label={t('discover.fitsWeek')} selected={filters.fitsWeek} onPress={() => toggle('fitsWeek')} /> : null}
        <Chip size="sm" label={t('discover.thisWeekend')} selected={filters.weekend} onPress={() => toggle('weekend')} />
        <Chip size="sm" label={t('discover.virtual')} selected={filters.virtual} onPress={() => toggle('virtual')} />
        {origin?.latitude != null ? (
          <Chip size="sm" label={t('discover.nearby', { km: nearKm })} selected={filters.nearby} onPress={() => toggle('nearby')} />
        ) : null}
      </ScrollView>

      {(invitations.data ?? []).length > 0 && !filtering ? (
        <View style={{ gap: 12 }}>
          <SectionHeader title={t('discover.invitedToYou')} />
          <Grid>
            {invitations.data!.map((inv) => (
              <SevaCard key={inv.id} task={inv.seva_tasks} km={dist(inv.seva_tasks)} />
            ))}
          </Grid>
        </View>
      ) : null}

      {session && !hasHistory && !filtering && goodFirst.length ? (
        <View style={{ gap: 12 }}>
          <View style={{ gap: 2 }}>
            <SectionHeader title={t('discover.goodFirst')} />
            <Text variant="caption">{t('discover.goodFirstHint')}</Text>
          </View>
          {goodFirst.map((task) => (
            <SevaDateRow key={task.id} task={task} km={dist(task)} />
          ))}
        </View>
      ) : null}

      {!filtering && recommended.length > 0 && session && hasHistory ? (
        <View style={{ gap: 12 }}>
          <SectionHeader title={t('discover.recommended')} />
          {isPhone ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 4 }}>
              {recommended.map((task) => (
                <SevaCard key={task.id} task={task} km={dist(task)} width={272} match={matchOf(task.id)} />
              ))}
            </ScrollView>
          ) : (
            <Grid>
              {recommended.map((task) => (
                <SevaCard key={task.id} task={task} km={dist(task)} match={matchOf(task.id)} />
              ))}
            </Grid>
          )}
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <SectionHeader title={t('discover.allPublic')} count={publicList.length} />
        {tasks.isPending ? (
          <Text variant="caption">{t('common.loading')}</Text>
        ) : tasks.isError ? (
          <EmptyState title={t('common.somethingWrong')} body={t('common.offline')}>
            <Button title={t('common.retry')} variant="outline" onPress={() => tasks.refetch()} />
          </EmptyState>
        ) : publicList.length === 0 ? (
          filtering ? (
            <EmptyState title={t('discover.noResultsTitle')} body={t('discover.noResultsBody')}>
              <Button title={t('discover.clearFilters')} variant="outline" onPress={() => setFilters(EMPTY)} />
            </EmptyState>
          ) : (
            <EmptyState title={t('discover.emptyTitle')} body={t('discover.emptyBody')} />
          )
        ) : (
          <PublicList list={filtering ? publicList : publicList.slice(0, firstCount)} dist={dist} matchOf={matchOf} />
        )}
      </View>

      {session && !filtering ? <PrivateEventsSection /> : null}

      {!filtering && publicList.length > firstCount ? (
        showAll ? (
          <View style={{ gap: 12 }}>
            <PublicList list={publicList.slice(firstCount)} dist={dist} matchOf={matchOf} />
          </View>
        ) : (
          <Button title={t('discover.showAll', { count: publicList.length })} variant="outline" onPress={() => setShowAll(true)} />
        )
      ) : null}

      <FilterSheet
        visible={sheet}
        filters={filters}
        onChange={setFilters}
        onClose={() => setSheet(false)}
        hasLocation={origin?.latitude != null}
        count={(f) => all.filter((task) => task.visibility === 'public' && matches(task, f)).length}
      />
    </Screen>
  );
}

function PublicList({ list, dist, matchOf }: { list: TaskWithEvent[]; dist: (t: TaskWithEvent) => number | null; matchOf: (id: string) => number | undefined }) {
  const { isPhone } = useLayout();
  if (isPhone) return <>{list.map((task) => <SevaRow key={task.id} task={task} km={dist(task)} />)}</>;
  return (
    <Grid>
      {list.map((task) => (
        <SevaCard key={task.id} task={task} km={dist(task)} match={matchOf(task.id)} />
      ))}
    </Grid>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  const { isDesktop } = useLayout();
  const cols = isDesktop ? 3 : 2;
  const items = Array.isArray(children) ? children : [children];
  const rows: React.ReactNode[][] = [];
  items.forEach((c, i) => {
    if (i % cols === 0) rows.push([]);
    rows[rows.length - 1].push(c);
  });
  return (
    <View style={{ gap: 12 }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
          {r}
          {Array.from({ length: cols - r.length }).map((_, j) => (
            <View key={`pad-${j}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

function FilterSheet({
  visible,
  filters,
  onChange,
  onClose,
  hasLocation,
  count,
}: {
  visible: boolean;
  filters: Filters;
  onChange: (f: Filters) => void;
  onClose: () => void;
  hasLocation: boolean;
  count: (f: Filters) => number;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isPhone } = useLayout();
  const toggleIn = <K extends 'categories' | 'modes'>(key: K, v: Filters[K][number]) => {
    const list = filters[key] as string[];
    onChange({ ...filters, [key]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] });
  };

  return (
    <Modal visible={visible} transparent animationType={isPhone ? 'slide' : 'fade'} onRequestClose={onClose}>
      <Pressable accessibilityLabel={t('common.close')} style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, isPhone ? { paddingBottom: insets.bottom + 16 } : styles.sheetCentered]}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="h2">{t('discover.filterTitle')}</Text>
          <IconButton icon="x" label={t('common.close')} onPress={onClose} />
        </Row>
        <ScrollView contentContainerStyle={{ gap: 20, paddingBottom: 8 }}>
          <View style={{ gap: 10 }}>
            <Text variant="label">{t('discover.category')}</Text>
            <Row gap={8} wrap>
              {INTERESTS.map((k) => (
                <Chip key={k} size="sm" label={t(`interests.${k}`)} selected={filters.categories.includes(k)} onPress={() => toggleIn('categories', k)} />
              ))}
            </Row>
          </View>
          <View style={{ gap: 10 }}>
            <Text variant="label">{t('discover.mode')}</Text>
            <Row gap={8} wrap>
              {(['onsite', 'virtual', 'hybrid'] as const).map((m) => (
                <Chip key={m} size="sm" label={t(`availability.modes.${m}`)} selected={filters.modes.includes(m)} onPress={() => toggleIn('modes', m)} />
              ))}
            </Row>
          </View>
          {hasLocation ? (
            <View style={{ gap: 10 }}>
              <Text variant="label">{t('discover.distance')}</Text>
              <Row gap={8} wrap>
                <Chip size="sm" label={t('discover.anyDistance')} selected={filters.maxKm == null} onPress={() => onChange({ ...filters, maxKm: null })} />
                {[5, 10, 25, 50].map((km) => (
                  <Chip key={km} size="sm" label={t('onboarding.withinKm', { km })} selected={filters.maxKm === km} onPress={() => onChange({ ...filters, maxKm: km })} />
                ))}
              </Row>
            </View>
          ) : null}
        </ScrollView>
        <Row gap={10}>
          <Button title={t('discover.clearFilters')} variant="outline" onPress={() => onChange({ ...EMPTY, q: filters.q })} />
          <Button title={t('discover.showResults', { count: count(filters) })} style={{ flex: 1 }} onPress={onClose} />
        </Row>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  locBtn: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8, flexShrink: 1 },
  guest: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, backgroundColor: colors.amberTint },
  welcome: { backgroundColor: colors.peach, borderRadius: 20, padding: 20, gap: 12 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(34,34,34,0.35)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: 20,
    gap: 16,
  },
  sheetCentered: {
    top: '10%',
    bottom: undefined,
    left: '50%',
    right: undefined,
    width: 560,
    marginLeft: -280,
    borderRadius: radius.sheet,
  },
});
