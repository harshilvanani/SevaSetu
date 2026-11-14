import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { EmptyState, Screen } from '@/components/Layout';
import { useAdminOrganizations } from '@/features/admin/api';
import { AdminShell } from '@/features/admin/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { colors } from '@/theme/tokens';

export default function AdminLayout() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const isAdmin = !!profile?.is_platform_admin && !profile.blocked_at;
  const orgs = useAdminOrganizations();

  if (!isAdmin) {
    return (
      <Screen maxWidth={560}>
        <EmptyState title={t('admin.notAdmin')}>
          <Button title={t('admin.backToApp')} variant="outline" onPress={() => router.replace('/')} />
        </EmptyState>
      </Screen>
    );
  }

  const pending = (orgs.data ?? []).filter((o) => o.status === 'pending').length;
  return (
    <AdminShell pendingOrgs={pending}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }} />
    </AdminShell>
  );
}
