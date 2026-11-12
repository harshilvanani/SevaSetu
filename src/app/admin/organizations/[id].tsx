import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { ConfirmDialog, type ConfirmRequest } from '@/components/ConfirmDialog';
import { Avatar, Card, EmptyState, Row, Screen, TopBar, useLayout } from '@/components/Layout';
import { Text } from '@/components/Text';
import { adminErrorKey, type OrgAction, useAdminOrganization, useReviewOrganization } from '@/features/admin/api';
import { OrgStatusBadge } from '@/features/admin/components';
import { StatusBadge } from '@/features/org/components';
import { formatDateTime, formatDay } from '@/lib/format';
import { colors } from '@/theme/tokens';

export default function AdminOrganization() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDesktop } = useLayout();
  const detail = useAdminOrganization(id);
  const review = useReviewOrganization();
  const [dialog, setDialog] = useState<ConfirmRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/admin/organizations'));

  if (!detail.data?.org) {
    return (
      <Screen title={t('admin.nav.organizations')} edges={[]} header={<TopBar onBack={back} />}>
        {detail.isPending ? <Text variant="caption">{t('common.loading')}</Text> : <EmptyState title={t('admin.noOrgs')} />}
      </Screen>
    );
  }
  const { org, members, events, people } = detail.data;
  const requester = people[org.created_by ?? ''];
  const reviewer = people[org.reviewed_by ?? ''];

  const run = async (action: OrgAction, reason?: string) => {
    setError(null);
    try {
      await review.mutateAsync({ id: org.id, action, reason });
    } catch (e) {
      setError(t(adminErrorKey(e)));
      throw new Error(t(adminErrorKey(e)));
    }
  };

  const actions: { action: OrgAction; label: string; variant: 'primary' | 'danger' | 'outline' }[] = [];
  if (org.status === 'pending' || org.status === 'rejected') actions.push({ action: 'approve', label: t('admin.org.approve'), variant: 'primary' });
  if (org.status === 'pending') actions.push({ action: 'reject', label: t('admin.org.reject'), variant: 'danger' });
  if (org.status === 'approved') actions.push({ action: 'suspend', label: t('admin.org.suspend'), variant: 'danger' });
  if (org.status === 'suspended') actions.push({ action: 'reinstate', label: t('admin.org.reinstate'), variant: 'primary' });

  const ask = (action: OrgAction) => {
    if (action === 'approve' || action === 'reinstate') return run(action).catch(() => undefined);
    setDialog({
      title: t(action === 'reject' ? 'admin.org.rejectTitle' : 'admin.org.suspendTitle', { name: org.name }),
      body: t(action === 'reject' ? 'admin.org.rejectBody' : 'admin.org.suspendBody'),
      confirmLabel: action === 'reject' ? t('admin.org.reject') : t('admin.org.suspend'),
      destructive: true,
      reason: 'required',
      onConfirm: (reason) => run(action, reason),
    });
  };

  return (
    <Screen title={t('admin.nav.organizations')} edges={[]} header={<TopBar onBack={back} title={isDesktop ? undefined : org.name} />} maxWidth={1100} refreshing={detail.isRefetching} onRefresh={() => detail.refetch()}>
      <View style={{ gap: 8 }}>
        <Row gap={10} wrap>
          <Text variant="h1" style={{ flexShrink: 1 }}>{org.name}</Text>
          <OrgStatusBadge status={org.status} />
        </Row>
        <Text variant="caption">{[org.city, t('admin.requestedBy', { name: requester?.full_name || requester?.email || '—', date: formatDateTime(org.created_at) })].filter(Boolean).join(' · ')}</Text>
      </View>

      {actions.length ? (
        <Row gap={10} wrap>
          {actions.map((a) => (
            <Button key={a.action} title={a.label} variant={a.variant} loading={review.isPending && review.variables?.action === a.action} onPress={() => ask(a.action)} />
          ))}
        </Row>
      ) : null}
      {error ? <Text variant="caption" color={colors.danger}>{error}</Text> : null}

      <View style={[{ gap: 16 }, isDesktop && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1, gap: 16 }}>
          <Card style={{ gap: 8 }}>
            <Text variant="h3">{t('admin.org.about')}</Text>
            <Text variant="bodySm" color={org.description ? colors.body : colors.muted}>{org.description || '—'}</Text>
          </Card>
          {org.reviewed_at ? (
            <Card style={{ gap: 4, backgroundColor: colors.cream }}>
              <Text variant="label">{t('admin.org.lastReview')}</Text>
              <Text variant="caption">
                {formatDateTime(org.reviewed_at)} · {reviewer?.full_name || reviewer?.email || '—'}
              </Text>
              {org.review_note ? <Text variant="bodySm" color={colors.body}>“{org.review_note}”</Text> : null}
            </Card>
          ) : null}
          <Card style={{ gap: 10 }}>
            <Text variant="h3">{t('admin.org.members')}</Text>
            {members.map((m) => {
              const p = people[m.user_id];
              return (
                <Row key={m.user_id} gap={10}>
                  <Avatar name={p?.full_name || p?.email || '?'} size={32} color={colors.purpleTint} />
                  <View style={{ flex: 1 }}>
                    <Text variant="label">{p?.full_name || '—'}</Text>
                    <Text variant="caption">{p?.email}</Text>
                  </View>
                  <Text variant="caption">{m.role === 'owner' ? t('admin.org.owner') : t('admin.org.organizer')}</Text>
                  <Button title={t('common.view')} variant="ghost" onPress={() => router.push({ pathname: '/admin/users/[id]', params: { id: m.user_id } })} />
                </Row>
              );
            })}
          </Card>
        </View>
        <View style={{ flex: 1, gap: 10 }}>
          <Text variant="h3">{t('admin.org.events')}</Text>
          {events.length === 0 ? <Text variant="caption">{t('admin.org.noEvents')}</Text> : null}
          {events.map((e) => (
            <Card key={e.id} style={{ gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }} gap={8}>
                <Text variant="label" style={{ flex: 1 }}>{e.title}</Text>
                <StatusBadge status={e.status} />
              </Row>
              <Text variant="caption">
                {formatDay(e.starts_at)} · {e.seva_tasks.reduce((n, x) => n + x.volunteers_count, 0)} {t('admin.events.volunteers').toLowerCase()}
              </Text>
            </Card>
          ))}
        </View>
      </View>
      <ConfirmDialog request={dialog} onClose={() => setDialog(null)} />
    </Screen>
  );
}
