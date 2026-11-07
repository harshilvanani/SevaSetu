import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/Button';
import { Badge, type BadgeTone, Chip } from '@/components/Chip';
import { EmptyState, Row, Screen } from '@/components/Layout';
import { Text } from '@/components/Text';
import { remaining } from '@/domain/seva';
import { type Membership, useAuth } from '@/features/auth/AuthProvider';
import type { Tables } from '@/lib/supabase';
import { colors, fonts, radius, shadow } from '@/theme/tokens';

import { useActiveOrg } from './api';

/** Renders children only for organizers of an approved organization. */
export function OrganizerGate({ children }: { children: (org: Membership['organizations']) => ReactNode }) {
  const { t } = useTranslation();
  const { memberships } = useAuth();
  const { org } = useActiveOrg();
  if (org) return <>{children(org)}</>;
  const pending = memberships.find((m) => m.organizations?.status === 'pending');
  return (
    <Screen maxWidth={640}>
      <View style={{ paddingTop: 24 }}>
        {pending ? (
          <EmptyState title={t('org.pendingTitle', { name: pending.organizations.name })} body={t('org.pendingBody')}>
            <Button title={t('profile.switchToVolunteer')} variant="outline" onPress={() => router.navigate('/profile')} />
          </EmptyState>
        ) : (
          <EmptyState title={t('org.noOrgTitle')} body={t('org.noOrgBody')}>
            <Button title={t('profile.startOrg')} onPress={() => router.push('/organizations/new')} />
          </EmptyState>
        )}
      </View>
    </Screen>
  );
}

export function OrgSwitcher() {
  const { t } = useTranslation();
  const { org, orgs, setActiveOrgId } = useActiveOrg();
  if (orgs.length < 2) return null;
  return (
    <View style={{ gap: 6 }}>
      <Text variant="small" color={colors.muted}>{t('org.switchOrg')}</Text>
      <Row gap={8} wrap>
        {orgs.map((m) => (
          <Chip key={m.org_id} size="sm" label={m.organizations.name} selected={m.org_id === org?.id} onPress={() => setActiveOrgId(m.org_id)} />
        ))}
      </Row>
    </View>
  );
}

const statusTone: Record<string, BadgeTone> = {
  draft: 'plain',
  published: 'success',
  completed: 'purple',
  cancelled: 'danger',
  open: 'success',
  full: 'amber',
  closed: 'plain',
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return <Badge label={t(`org.statuses.${status}`)} tone={statusTone[status] ?? 'plain'} />;
}

export function MetricCard({ label, value, sub, action, onAction }: { label: string; value: string | number; sub?: string; action?: string; onAction?: () => void }) {
  return (
    <View
      style={[
        { flex: 1, minWidth: 160, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.card, padding: 16, gap: 4 },
        shadow,
      ]}>
      <Text variant="caption">{label}</Text>
      <Text style={{ fontFamily: fonts.serif, fontSize: 32, lineHeight: 40 }}>{value}</Text>
      {sub ? <Text variant="caption">{sub}</Text> : null}
      {action ? (
        <Pressable accessibilityRole="link" onPress={onAction} hitSlop={6}>
          <Text variant="label" color={colors.purple}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** One-line staffing / progress summaries for organizer tables. */
export function useStaffingText() {
  const { t } = useTranslation();
  return (task: Tables<'seva_tasks'>) => {
    const left = remaining(task);
    if (task.type === 'role') {
      return {
        capacity: t('org.positionsOf', { filled: task.volunteers_count, total: task.positions }),
        progress: t('org.positionsOnly'),
        staffing: left === 0 ? t('org.fullyStaffed') : t('org.openCount', { count: left }),
        tone: (left === 0 ? 'success' : 'amber') as BadgeTone,
      };
    }
    const workLeft = (task.target_qty ?? 0) - task.verified_total;
    return {
      capacity: t('org.claimedOf', { claimed: task.claimed_total, total: task.target_qty }),
      progress: `${task.verified_total} / ${task.target_qty}${task.pending_total ? ` · ${t('org.pendingSuffix', { count: task.pending_total })}` : ''}`,
      staffing: left === 0 ? (workLeft > 0 ? t('org.fullInProgress') : t('org.fullyStaffed')) : t('org.unclaimed', { count: left }),
      tone: (left === 0 ? 'success' : 'amber') as BadgeTone,
    };
  };
}
