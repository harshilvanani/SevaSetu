import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Card, EmptyState, Row, Screen, SectionHeader, useLayout } from '@/components/Layout';
import { Text } from '@/components/Text';
import { useAdminOrganizations, useAdminOverview, useAuditLog } from '@/features/admin/api';
import { MetricCard } from '@/features/org/components';
import { usePublicNames } from '@/features/seva/progress';
import { formatDateTime } from '@/lib/format';
import { colors } from '@/theme/tokens';

export default function AdminOverview() {
  const { t } = useTranslation();
  const { isDesktop } = useLayout();
  const overview = useAdminOverview();
  const orgs = useAdminOrganizations();
  const audit = useAuditLog(5);
  const pending = (orgs.data ?? []).filter((o) => o.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at));
  const names = usePublicNames(pending.map((o) => o.created_by));
  const o = overview.data;

  return (
    <Screen edges={[]} maxWidth={1200} refreshing={overview.isRefetching} onRefresh={() => { overview.refetch(); orgs.refetch(); audit.refetch(); }}>
      <Text variant="h1" style={{ paddingTop: 16 }}>{t('admin.nav.overview')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <MetricCard label={t('admin.overview.users')} value={o?.users ?? '—'} sub={o ? t('admin.overview.usersNew', { count: o.users_7d }) : undefined} />
        <MetricCard
          label={t('admin.overview.orgsPending')}
          value={o?.orgs.pending ?? 0}
          sub={o ? t('admin.overview.orgsActive', { count: o.orgs.approved ?? 0, suspended: o.orgs.suspended ?? 0 }) : undefined}
          action={o?.orgs.pending ? t('org.reviewNow') : undefined}
          onAction={() => router.navigate({ pathname: '/admin/organizations', params: { status: 'pending' } })}
        />
        <MetricCard label={t('admin.overview.eventsLive')} value={o?.events_live ?? '—'} sub={o ? t('admin.overview.activeVolunteers', { count: o.active_volunteers }) : undefined} />
        <MetricCard label={t('admin.overview.hours')} value={o?.verified_hours ?? '—'} />
        <MetricCard label={t('admin.overview.blocked')} value={o?.blocked ?? '—'} sub={o ? t('admin.overview.admins', { count: o.admins }) : undefined} />
      </View>

      <View style={[{ gap: 20 }, isDesktop && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1, gap: 12 }}>
          <SectionHeader title={t('admin.overview.attention')} />
          {pending.length === 0 ? (
            <EmptyState title={t('admin.overview.nothing')} />
          ) : (
            pending.map((org) => (
              <Card key={org.id} onPress={() => router.push({ pathname: '/admin/organizations/[id]', params: { id: org.id } })} accessibilityLabel={org.name}>
                <Row style={{ justifyContent: 'space-between' }} gap={10}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="title">{org.name}</Text>
                    <Text variant="caption">
                      {t('admin.requestedBy', { name: names.data?.[org.created_by ?? ''] || '—', date: formatDateTime(org.created_at) })}
                    </Text>
                  </View>
                  <Icon name="chevronRight" size={20} color={colors.muted} />
                </Row>
              </Card>
            ))
          )}
        </View>
        <View style={{ flex: 1, gap: 12 }}>
          <SectionHeader title={t('admin.overview.recent')} action={t('common.seeAll')} onAction={() => router.navigate('/admin/audit')} />
          <Card style={{ gap: 12 }}>
            {(audit.data ?? []).length === 0 ? <Text variant="caption">{t('admin.audit.empty')}</Text> : null}
            {(audit.data ?? []).map((a) => (
              <View key={a.id} style={{ gap: 2 }}>
                <Text variant="label">
                  {t(`admin.audit.actions.${a.action}`, { defaultValue: a.action })}: {a.target_label}
                </Text>
                <Text variant="caption">
                  {formatDateTime(a.created_at)} · {t('admin.audit.by', { name: a.admin_name || '—' })}
                  {a.reason ? ` · “${a.reason}”` : ''}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      </View>
      <Text variant="caption" color={colors.muted}> </Text>
    </Screen>
  );
}
