import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Chip } from '@/components/Chip';
import { SearchField } from '@/components/Field';
import { EmptyState, Row, Screen } from '@/components/Layout';
import { Text } from '@/components/Text';
import { useAdminUsers } from '@/features/admin/api';
import { providerLabel, Table, UserBadges } from '@/features/admin/components';
import { formatDay } from '@/lib/format';

type Filter = 'all' | 'blocked' | 'admins';

export default function AdminUsers() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const users = useAdminUsers(q.trim().length >= 2 ? q.trim() : '');
  const rows = (users.data ?? []).filter((u) => (filter === 'blocked' ? !!u.blocked_at : filter === 'admins' ? u.is_platform_admin : true));
  const open = (id: string) => router.push({ pathname: '/admin/users/[id]', params: { id } });

  return (
    <Screen title={t('admin.nav.users')} edges={[]} maxWidth={1200} refreshing={users.isRefetching} onRefresh={() => users.refetch()}>
      <Text variant="h1" style={{ paddingTop: 16 }}>{t('admin.nav.users')}</Text>
      <View style={{ flexDirection: 'row' }}>
        <SearchField value={q} onChangeText={setQ} placeholder={t('admin.search')} />
      </View>
      <Row gap={8} wrap>
        <Chip size="sm" label={`${t('admin.status.all')} · ${(users.data ?? []).length}`} selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip size="sm" label={t('admin.users.blocked')} selected={filter === 'blocked'} onPress={() => setFilter('blocked')} />
        <Chip size="sm" label={t('admin.users.admin')} selected={filter === 'admins'} onPress={() => setFilter('admins')} />
      </Row>
      {users.isPending ? (
        <Text variant="caption">{t('common.loading')}</Text>
      ) : rows.length === 0 ? (
        <EmptyState title={t('admin.users.noUsers')} />
      ) : (
        <Table
          rows={rows}
          keyOf={(u) => u.id}
          onPress={(u) => open(u.id)}
          columns={[
            {
              label: t('admin.users.name'),
              flex: 2.4,
              render: (u) => (
                <View>
                  <Text variant="label" numberOfLines={1}>{u.full_name || '—'}</Text>
                  <Text variant="caption" numberOfLines={1}>{u.email}</Text>
                </View>
              ),
            },
            { label: t('admin.users.method'), flex: 1, render: (u) => <Text variant="bodySm">{providerLabel(u)}</Text> },
            { label: t('admin.users.joined'), flex: 1, render: (u) => <Text variant="bodySm">{formatDay(u.created_at)}</Text> },
            { label: t('admin.users.lastSignIn'), flex: 1, render: (u) => <Text variant="bodySm">{u.last_sign_in_at ? formatDay(u.last_sign_in_at) : t('admin.users.never')}</Text> },
            { label: t('admin.users.seva'), flex: 0.8, render: (u) => <Text variant="bodySm">{u.assignment_count}</Text> },
            { label: t('admin.users.status'), flex: 1.4, render: (u) => <UserBadges admin={u.is_platform_admin} blocked={!!u.blocked_at} /> },
          ]}
          card={(u) => (
            <>
              <Row style={{ justifyContent: 'space-between' }} gap={8}>
                <View style={{ flex: 1 }}>
                  <Text variant="title" numberOfLines={1}>{u.full_name || '—'}</Text>
                  <Text variant="caption" numberOfLines={1}>{u.email}</Text>
                </View>
              </Row>
              <UserBadges admin={u.is_platform_admin} blocked={!!u.blocked_at} />
              <Text variant="caption">
                {providerLabel(u)} · {t('admin.users.joined')} {formatDay(u.created_at)} · {t('admin.users.seva')}: {u.assignment_count}
              </Text>
            </>
          )}
        />
      )}
    </Screen>
  );
}
