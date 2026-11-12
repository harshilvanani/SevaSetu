import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/components/Layout';
import { Text } from '@/components/Text';
import { useAuditLog } from '@/features/admin/api';
import { Table } from '@/features/admin/components';
import { formatDateTime } from '@/lib/format';
import { colors } from '@/theme/tokens';

export default function AdminAudit() {
  const { t } = useTranslation();
  const audit = useAuditLog();
  const rows = audit.data ?? [];
  const open = (a: (typeof rows)[number]) => {
    if (a.target_type === 'organization') router.push({ pathname: '/admin/organizations/[id]', params: { id: a.target_id } });
    else if (a.target_type === 'user') router.push({ pathname: '/admin/users/[id]', params: { id: a.target_id } });
    else router.navigate('/admin/events');
  };
  const label = (action: string) => t(`admin.audit.actions.${action}`, { defaultValue: action });

  return (
    <Screen title={t('admin.nav.audit')} edges={[]} maxWidth={1200} refreshing={audit.isRefetching} onRefresh={() => audit.refetch()}>
      <Text variant="h1" style={{ paddingTop: 16 }}>{t('admin.nav.audit')}</Text>
      {audit.isPending ? (
        <Text variant="caption">{t('common.loading')}</Text>
      ) : rows.length === 0 ? (
        <EmptyState title={t('admin.audit.empty')} />
      ) : (
        <Table
          rows={rows}
          keyOf={(a) => a.id}
          onPress={open}
          columns={[
            { label: t('admin.events.when'), flex: 1.2, render: (a) => <Text variant="bodySm">{formatDateTime(a.created_at)}</Text> },
            { label: t('admin.audit.action'), flex: 1.4, render: (a) => <Text variant="label">{label(a.action)}</Text> },
            { label: t('admin.users.name'), flex: 1.6, render: (a) => <Text variant="bodySm" numberOfLines={1}>{a.target_label}</Text> },
            { label: t('admin.reason'), flex: 2, render: (a) => <Text variant="bodySm" color={colors.body} numberOfLines={2}>{a.reason ?? '—'}</Text> },
            { label: t('nav.admin'), flex: 1.2, render: (a) => <Text variant="bodySm" numberOfLines={1}>{a.admin_name || '—'}</Text> },
          ]}
          card={(a) => (
            <>
              <Text variant="label">
                {label(a.action)}: {a.target_label}
              </Text>
              <Text variant="caption">
                {formatDateTime(a.created_at)} · {t('admin.audit.by', { name: a.admin_name || '—' })}
              </Text>
              {a.reason ? <Text variant="bodySm" color={colors.body}>“{a.reason}”</Text> : null}
            </>
          )}
        />
      )}
    </Screen>
  );
}
