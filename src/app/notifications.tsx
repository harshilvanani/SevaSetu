import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { EmptyState, Row, Screen, TopBar } from '@/components/Layout';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime } from '@/lib/format';
import { notificationHref } from '@/lib/push';
import { supabase, type Tables } from '@/lib/supabase';
import { colors, radius } from '@/theme/tokens';

const ICONS: Record<string, IconName> = {
  joined: 'check',
  invited: 'mail',
  report_submitted: 'clipboard',
  report_reviewed: 'clipboard',
  assignment_completed: 'heart',
  reminder: 'calendar',
  org_pending: 'shield',
  org_reviewed: 'users',
  event_cancelled: 'calendar',
  account_unblocked: 'check',
  admin_role: 'shield',
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const qc = useQueryClient();
  const uid = session?.user.id;

  const list = useQuery({
    queryKey: ['notifications', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from('notifications').select('*').eq('user_id', uid!).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const markRead = useMutation({
    mutationFn: async (ids: string[] | 'all') => {
      const q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', uid!).is('read_at', null);
      const { error } = ids === 'all' ? await q : await q.in('id', ids);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['nav-badges'] });
    },
  });

  const open = (n: Tables<'notifications'>) => {
    if (!n.read_at) markRead.mutate([n.id]);
    const href = notificationHref(n.type, n.data as Record<string, string>);
    if (href) router.push(href);
  };

  const unread = (list.data ?? []).filter((n) => !n.read_at).length;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen
      header={<TopBar onBack={back} title={t('notifications.title')} />}
      maxWidth={720}
      refreshing={list.isRefetching}
      onRefresh={() => list.refetch()}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="h1">{t('notifications.title')}</Text>
        {unread ? <Button title={t('notifications.markAll')} variant="ghost" onPress={() => markRead.mutate('all')} /> : null}
      </Row>
      {list.isPending ? (
        <Text variant="caption">{t('common.loading')}</Text>
      ) : !list.data?.length ? (
        <EmptyState title={t('notifications.empty')} body={t('notifications.emptyBody')} />
      ) : (
        <View style={{ gap: 8 }}>
          {list.data.map((n) => (
            <Pressable
              key={n.id}
              accessibilityRole="button"
              accessibilityLabel={`${n.read_at ? '' : `${t('notifications.unread')}. `}${n.title}. ${n.body}`}
              onPress={() => open(n)}
              style={({ pressed }) => [styles.item, !n.read_at && styles.unread, pressed && { opacity: 0.85 }]}>
              <View style={[styles.icon, { backgroundColor: n.read_at ? colors.sandSoft : colors.purpleTint }]}>
                <Icon name={ICONS[n.type] ?? 'bell'} size={18} color={n.read_at ? colors.subtle : colors.purpleDark} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="small" color={colors.muted}>{t(`notifications.types.${n.type}`, { defaultValue: '' }) || formatDateTime(n.created_at)}</Text>
                <Text variant="label">{n.title}</Text>
                {n.body ? <Text variant="bodySm" color={colors.body}>{n.body}</Text> : null}
                <Text variant="caption">{formatDateTime(n.created_at)}</Text>
              </View>
              {!n.read_at ? <View style={styles.dot} /> : null}
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  unread: { backgroundColor: '#FBF7FD', borderColor: '#E6D6F0' },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 999, backgroundColor: colors.purple, marginTop: 6 },
});
