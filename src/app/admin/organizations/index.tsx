import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Chip } from '@/components/Chip';
import { SearchField } from '@/components/Field';
import { EmptyState, Row, Screen } from '@/components/Layout';
import { Text } from '@/components/Text';
import { useAdminOrganizations } from '@/features/admin/api';
import { OrgStatusBadge, Table } from '@/features/admin/components';
import { usePublicNames } from '@/features/seva/progress';
import { formatDay } from '@/lib/format';

type Filter = 'all' | 'pending' | 'approved' | 'rejected' | 'suspended';
const FILTERS: Filter[] = ['pending', 'approved', 'suspended', 'rejected', 'all'];

export default function AdminOrganizations() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ status?: Filter }>();
  const orgs = useAdminOrganizations();
  const [filter, setFilter] = useState<Filter>(params.status ?? 'all');
  const [q, setQ] = useState('');
  const all = orgs.data ?? [];
  const names = usePublicNames(all.map((o) => o.created_by));
  const rows = all
    .filter((o) => filter === 'all' || o.status === filter)
    .filter((o) => !q.trim() || [o.name, o.city].some((s) => s?.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || b.created_at.localeCompare(a.created_at));
  const count = (f: Filter) => (f === 'all' ? all.length : all.filter((o) => o.status === f).length);
  const open = (id: string) => router.push({ pathname: '/admin/organizations/[id]', params: { id } });

  return (
    <Screen title={t('admin.nav.organizations')} edges={[]} maxWidth={1200} refreshing={orgs.isRefetching} onRefresh={() => orgs.refetch()}>
      <Text variant="h1" style={{ paddingTop: 16 }}>{t('admin.nav.organizations')}</Text>
      <Row gap={8} wrap>
        {FILTERS.map((f) => (
          <Chip key={f} size="sm" label={`${t(`admin.status.${f}`)} · ${count(f)}`} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </Row>
      <View style={{ flexDirection: 'row' }}>
        <SearchField value={q} onChangeText={setQ} placeholder={t('admin.searchOrgs')} />
      </View>
      {orgs.isPending ? (
        <Text variant="caption">{t('common.loading')}</Text>
      ) : rows.length === 0 ? (
        <EmptyState title={t('admin.noOrgs')} />
      ) : (
        <Table
          rows={rows}
          keyOf={(o) => o.id}
          onPress={(o) => open(o.id)}
          columns={[
            { label: t('org.name'), flex: 2.2, render: (o) => <Text variant="label">{o.name}</Text> },
            { label: t('org.city'), flex: 1.2, render: (o) => <Text variant="bodySm">{o.city ?? '—'}</Text> },
            { label: t('admin.org.requester'), flex: 1.6, render: (o) => <Text variant="bodySm" numberOfLines={1}>{names.data?.[o.created_by ?? ''] || '—'}</Text> },
            { label: t('admin.users.joined'), flex: 1, render: (o) => <Text variant="bodySm">{formatDay(o.created_at)}</Text> },
            { label: t('org.status'), flex: 1, render: (o) => <OrgStatusBadge status={o.status} /> },
          ]}
          card={(o) => (
            <>
              <Row style={{ justifyContent: 'space-between' }} gap={8}>
                <Text variant="title" style={{ flex: 1 }}>{o.name}</Text>
                <OrgStatusBadge status={o.status} />
              </Row>
              <Text variant="caption">
                {[o.city, t('admin.requestedBy', { name: names.data?.[o.created_by ?? ''] || '—', date: formatDay(o.created_at) })].filter(Boolean).join(' · ')}
              </Text>
            </>
          )}
        />
      )}
    </Screen>
  );
}
