import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ConfirmDialog, type ConfirmRequest } from '@/components/ConfirmDialog';
import { SearchField } from '@/components/Field';
import { EmptyState, Row, Screen } from '@/components/Layout';
import { Text } from '@/components/Text';
import { adminErrorKey, useAdminEvents, useCancelEvent } from '@/features/admin/api';
import { Table } from '@/features/admin/components';
import { StatusBadge } from '@/features/org/components';
import { formatDay } from '@/lib/format';
import { colors } from '@/theme/tokens';

type Filter = 'all' | 'published' | 'draft' | 'completed' | 'cancelled';

export default function AdminEvents() {
  const { t } = useTranslation();
  const events = useAdminEvents();
  const cancel = useCancelEvent();
  const [filter, setFilter] = useState<Filter>('published');
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState<ConfirmRequest | null>(null);
  const all = events.data ?? [];
  const rows = all
    .filter((e) => filter === 'all' || e.status === filter)
    .filter((e) => !q.trim() || [e.title, e.organizations?.name].some((s) => s?.toLowerCase().includes(q.trim().toLowerCase())));
  const openOrg = (id: string) => router.push({ pathname: '/admin/organizations/[id]', params: { id } });
  const volunteers = (e: (typeof all)[number]) => e.seva_tasks.reduce((n, x) => n + x.volunteers_count, 0);

  const askCancel = (e: (typeof all)[number]) =>
    setDialog({
      title: t('admin.events.cancelTitle', { name: e.title }),
      body: t('admin.events.cancelBody'),
      confirmLabel: t('admin.events.cancel'),
      destructive: true,
      reason: 'required',
      onConfirm: async (reason) => {
        try {
          await cancel.mutateAsync({ id: e.id, reason });
        } catch (err) {
          throw new Error(t(adminErrorKey(err)));
        }
      },
    });

  const action = (e: (typeof all)[number]) =>
    e.status === 'published' || e.status === 'draft' ? (
      <Button title={t('admin.events.cancel')} variant="danger" onPress={() => askCancel(e)} style={{ height: 38 }} />
    ) : null;

  return (
    <Screen title={t('admin.nav.events')} edges={[]} maxWidth={1200} refreshing={events.isRefetching} onRefresh={() => events.refetch()}>
      <Text variant="h1" style={{ paddingTop: 16 }}>{t('admin.nav.events')}</Text>
      <Row gap={8} wrap>
        {(['published', 'draft', 'completed', 'cancelled', 'all'] as Filter[]).map((f) => (
          <Chip
            key={f}
            size="sm"
            label={`${f === 'all' ? t('admin.status.all') : t(`org.statuses.${f}`)} · ${f === 'all' ? all.length : all.filter((e) => e.status === f).length}`}
            selected={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </Row>
      <View style={{ flexDirection: 'row' }}>
        <SearchField value={q} onChangeText={setQ} placeholder={t('discover.search')} />
      </View>
      {events.isPending ? (
        <Text variant="caption">{t('common.loading')}</Text>
      ) : rows.length === 0 ? (
        <EmptyState title={t('admin.events.noEvents')} />
      ) : (
        <Table
          rows={rows}
          keyOf={(e) => e.id}
          columns={[
            { label: t('org.event'), flex: 2.2, render: (e) => <Text variant="label" numberOfLines={1}>{e.title}</Text> },
            {
              label: t('admin.events.org'),
              flex: 1.6,
              render: (e) => (
                <Text variant="bodySm" weight="semibold" color={colors.purple} numberOfLines={1} accessibilityRole="link" onPress={() => openOrg(e.org_id)}>
                  {e.organizations?.name}
                </Text>
              ),
            },
            { label: t('admin.events.when'), flex: 1, render: (e) => <Text variant="bodySm">{formatDay(e.starts_at)}</Text> },
            { label: t('admin.events.volunteers'), flex: 0.9, render: (e) => <Text variant="bodySm">{volunteers(e)}</Text> },
            { label: t('org.status'), flex: 1, render: (e) => <StatusBadge status={e.status} /> },
            { label: '', flex: 1.3, render: (e) => action(e) },
          ]}
          card={(e) => (
            <>
              <Row style={{ justifyContent: 'space-between' }} gap={8}>
                <Text variant="title" style={{ flex: 1 }}>{e.title}</Text>
                <StatusBadge status={e.status} />
              </Row>
              <Text variant="caption">
                <Text variant="caption" weight="semibold" color={colors.purple} accessibilityRole="link" onPress={() => openOrg(e.org_id)}>
                  {e.organizations?.name}
                </Text>{' '}
                · {formatDay(e.starts_at)} · {volunteers(e)} {t('admin.events.volunteers').toLowerCase()}
              </Text>
              {action(e)}
            </>
          )}
        />
      )}
      <ConfirmDialog request={dialog} onClose={() => setDialog(null)} />
    </Screen>
  );
}
