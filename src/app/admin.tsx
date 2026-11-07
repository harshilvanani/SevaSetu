import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, EmptyState, Row, Screen, TopBar } from '@/components/Layout';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { StatusBadge } from '@/features/org/components';
import { usePublicNames } from '@/features/seva/progress';
import { formatDateTime } from '@/lib/format';
import { supabase, type Tables } from '@/lib/supabase';
import { colors, fonts, radius } from '@/theme/tokens';

export default function AdminScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const orgs = useQuery({
    queryKey: ['admin-orgs'],
    enabled: !!profile?.is_platform_admin,
    queryFn: async () => {
      const { data, error } = await supabase.from('organizations').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const names = usePublicNames((orgs.data ?? []).map((o) => o.created_by));
  const review = useMutation({
    mutationFn: async (v: { id: string; approve: boolean; note: string }) => {
      const { error } = await supabase.rpc('review_organization', { p_org: v.id, p_approve: v.approve, p_note: v.note });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-orgs'] }),
  });
  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  if (!profile?.is_platform_admin) {
    return (
      <Screen header={<TopBar onBack={back} />} maxWidth={560}>
        <EmptyState title={t('admin.notAdmin')} />
      </Screen>
    );
  }

  const pending = (orgs.data ?? []).filter((o) => o.status === 'pending');
  const reviewed = (orgs.data ?? []).filter((o) => o.status !== 'pending').slice(0, 20);

  return (
    <Screen header={<TopBar onBack={back} title={t('admin.title')} />} maxWidth={820}>
      <Text variant="h1">{t('admin.title')}</Text>
      <Text variant="h3">{t('admin.pending')}</Text>
      {pending.length === 0 ? <EmptyState title={t('admin.none')} /> : null}
      {pending.map((o) => (
        <PendingOrg key={o.id} org={o} requester={names.data?.[o.created_by ?? ''] ?? ''} onReview={(approve, note) => review.mutate({ id: o.id, approve, note })} busy={review.isPending} />
      ))}
      {reviewed.length ? <Text variant="h3">{t('admin.reviewed')}</Text> : null}
      {reviewed.map((o) => (
        <Card key={o.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text variant="title">{o.name}</Text>
              <Text variant="caption">{[o.city, o.reviewed_at ? formatDateTime(o.reviewed_at) : null].filter(Boolean).join(' · ')}</Text>
            </View>
            <StatusBadge status={o.status === 'approved' ? 'published' : 'cancelled'} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}

function PendingOrg({ org, requester, onReview, busy }: { org: Tables<'organizations'>; requester: string; onReview: (approve: boolean, note: string) => void; busy: boolean }) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text variant="title">{org.name}</Text>
        <Text variant="caption">{t('admin.requestedBy', { name: requester || '—', date: formatDateTime(org.created_at) })}</Text>
        {org.city ? <Text variant="caption">{org.city}</Text> : null}
      </View>
      {org.description ? <Text variant="bodySm" color={colors.body}>{org.description}</Text> : null}
      <TextInput
        accessibilityLabel={t('admin.notePlaceholder')}
        placeholder={t('admin.notePlaceholder')}
        placeholderTextColor={colors.muted}
        value={note}
        onChangeText={setNote}
        style={{ minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 15, backgroundColor: colors.white }}
      />
      <Row gap={10}>
        <Button title={t('admin.approve')} icon="check" onPress={() => onReview(true, note)} loading={busy} style={{ flex: 1 }} />
        <Button title={t('admin.reject')} variant="danger" onPress={() => onReview(false, note)} disabled={busy} style={{ flex: 1 }} />
      </Row>
    </Card>
  );
}
