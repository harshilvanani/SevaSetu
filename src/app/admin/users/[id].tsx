import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Badge } from '@/components/Chip';
import { ConfirmDialog, type ConfirmRequest } from '@/components/ConfirmDialog';
import { Avatar, Card, EmptyState, Row, Screen, TopBar, useLayout } from '@/components/Layout';
import { Text } from '@/components/Text';
import { adminErrorKey, useAdminUserDetail, useAdminUsers, useSetPlatformAdmin, useSetUserBlocked } from '@/features/admin/api';
import { OrgStatusBadge, providerLabel, UserBadges } from '@/features/admin/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateTime, formatDay } from '@/lib/format';
import { colors } from '@/theme/tokens';

export default function AdminUser() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDesktop } = useLayout();
  const { session } = useAuth();
  const users = useAdminUsers('');
  const detail = useAdminUserDetail(id);
  const block = useSetUserBlocked();
  const setAdmin = useSetPlatformAdmin();
  const [dialog, setDialog] = useState<ConfirmRequest | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/admin/users'));
  const user = users.data?.find((u) => u.id === id);

  if (!user) {
    return (
      <Screen edges={[]} header={<TopBar onBack={back} />}>
        {users.isPending ? <Text variant="caption">{t('common.loading')}</Text> : <EmptyState title={t('admin.users.noUsers')} />}
      </Screen>
    );
  }
  const name = user.full_name || user.email || '—';
  const isSelf = user.id === session?.user.id;

  const wrap = (fn: () => Promise<unknown>, success?: (r: unknown) => string | null) => async () => {
    setNotice(null);
    try {
      const r = await fn();
      const msg = success?.(r);
      if (msg) setNotice({ ok: true, text: msg });
    } catch (e) {
      throw new Error(t(adminErrorKey(e)));
    }
  };

  const askBlock = () =>
    setDialog({
      title: t('admin.users.blockTitle', { name }),
      body: t('admin.users.blockBody'),
      confirmLabel: t('admin.users.block'),
      destructive: true,
      reason: 'required',
      onConfirm: (reason) =>
        wrap(
          () => block.mutateAsync({ id: user.id, blocked: true, reason }),
          (r) => t('admin.users.released', { count: (r as { cancelled: number }).cancelled }),
        )(),
    });
  const askUnblock = () =>
    setDialog({
      title: t('admin.users.unblockTitle', { name }),
      body: t('admin.users.unblockBody'),
      confirmLabel: t('admin.users.unblock'),
      reason: 'optional',
      onConfirm: (reason) => wrap(() => block.mutateAsync({ id: user.id, blocked: false, reason }))(),
    });
  const askAdmin = (makeAdmin: boolean) =>
    setDialog({
      title: makeAdmin ? t('admin.users.makeAdminTitle', { name }) : t('admin.users.removeAdminTitle', { name }),
      body: makeAdmin ? t('admin.users.makeAdminBody') : undefined,
      confirmLabel: makeAdmin ? t('admin.users.makeAdmin') : t('admin.users.removeAdmin'),
      destructive: !makeAdmin,
      onConfirm: () => wrap(() => setAdmin.mutateAsync({ id: user.id, admin: makeAdmin }))(),
    });

  return (
    <Screen edges={[]} header={<TopBar onBack={back} title={isDesktop ? undefined : name} />} maxWidth={1100} refreshing={detail.isRefetching} onRefresh={() => { users.refetch(); detail.refetch(); }}>
      <Row gap={14} style={{ alignItems: 'flex-start' }}>
        <Avatar name={name} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <Row gap={8} wrap>
            <Text variant="h2">{name}</Text>
            {isSelf ? <Badge label={t('admin.users.you')} tone="neutral" /> : null}
          </Row>
          <Text variant="caption">{user.email}</Text>
          <UserBadges admin={user.is_platform_admin} blocked={!!user.blocked_at} />
        </View>
      </Row>

      {user.blocked_at ? (
        <View style={{ padding: 14, borderRadius: 12, backgroundColor: colors.dangerTint }}>
          <Text variant="bodySm" color={colors.danger}>{t('admin.users.blockedSince', { date: formatDay(user.blocked_at), reason: user.blocked_reason ?? '' })}</Text>
        </View>
      ) : null}

      <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {[
          [t('admin.users.method'), providerLabel(user)],
          [t('admin.users.joined'), formatDay(user.created_at)],
          [t('admin.users.lastSignIn'), user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : t('admin.users.never')],
          [t('org.city'), user.city ?? '—'],
          [t('admin.users.seva'), String(user.assignment_count)],
        ].map(([label, value]) => (
          <View key={label} style={{ minWidth: 140, gap: 2 }}>
            <Text variant="small" color={colors.muted}>{label}</Text>
            <Text variant="bodySm" weight="medium">{value}</Text>
          </View>
        ))}
      </Card>

      {!isSelf ? (
        <Row gap={10} wrap>
          {user.blocked_at ? (
            <Button title={t('admin.users.unblock')} onPress={askUnblock} />
          ) : (
            <Button title={t('admin.users.block')} icon="lock" variant="danger" onPress={askBlock} disabled={user.is_platform_admin} />
          )}
          {user.is_platform_admin ? (
            <Button title={t('admin.users.removeAdmin')} variant="outline" onPress={() => askAdmin(false)} />
          ) : (
            <Button title={t('admin.users.makeAdmin')} icon="shield" variant="outline" onPress={() => askAdmin(true)} disabled={!!user.blocked_at} />
          )}
        </Row>
      ) : null}
      {user.is_platform_admin && !isSelf && !user.blocked_at ? <Text variant="caption">{t('admin.errors.cannot_block_admin')}</Text> : null}
      {notice ? <Text variant="caption" color={notice.ok ? colors.purpleDark : colors.danger}>{notice.text}</Text> : null}

      <View style={[{ gap: 16 }, isDesktop && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1, gap: 10 }}>
          <Text variant="h3">{t('admin.users.organizations')}</Text>
          {(detail.data?.memberships ?? []).length === 0 ? <Text variant="caption">—</Text> : null}
          {(detail.data?.memberships ?? []).map((m) => (
            <Card key={m.organizations.id} onPress={() => router.push({ pathname: '/admin/organizations/[id]', params: { id: m.organizations.id } })}>
              <Row style={{ justifyContent: 'space-between' }} gap={8}>
                <View style={{ flex: 1 }}>
                  <Text variant="label">{m.organizations.name}</Text>
                  <Text variant="caption">{m.role === 'owner' ? t('admin.org.owner') : t('admin.org.organizer')}</Text>
                </View>
                <OrgStatusBadge status={m.organizations.status} />
              </Row>
            </Card>
          ))}
        </View>
        <View style={{ flex: 1.4, gap: 10 }}>
          <Text variant="h3">{t('admin.users.sevaHistory')}</Text>
          {(detail.data?.assignments ?? []).length === 0 ? <Text variant="caption">{t('admin.users.noSeva')}</Text> : null}
          {(detail.data?.assignments ?? []).map((a) => (
            <Card key={a.id} style={{ gap: 2 }}>
              <Row style={{ justifyContent: 'space-between' }} gap={8}>
                <Text variant="label" style={{ flex: 1 }}>{a.seva_tasks.title}</Text>
                <Badge
                  label={a.status === 'cancelled' ? t('org.statuses.cancelled') : a.status === 'completed' ? t('mySeva.completed') : t('mySeva.active')}
                  tone={a.status === 'cancelled' ? 'plain' : a.status === 'completed' ? 'success' : 'purple'}
                />
              </Row>
              <Text variant="caption">
                {a.seva_tasks.events.title} · {formatDay(a.joined_at)}
                {a.seva_tasks.type === 'quantity' ? ` · ${a.claimed_qty} ${a.seva_tasks.unit}` : ''}
              </Text>
            </Card>
          ))}
        </View>
      </View>
      <ConfirmDialog request={dialog} onClose={() => setDialog(null)} />
    </Screen>
  );
}
