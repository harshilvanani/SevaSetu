import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { ConfirmDialog, type ConfirmRequest } from '@/components/ConfirmDialog';
import { Card, EmptyState, Screen } from '@/components/Layout';
import { Text } from '@/components/Text';
import { type DemoAccount, type DemoPersona, enterDemo, useDemoAccounts, useResetDemo } from '@/features/admin/demo';
import { colors } from '@/theme/tokens';

const ORDER: DemoPersona[] = ['volunteer', 'organizer', 'volunteer2'];

export default function AdminDemo() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const accounts = useDemoAccounts();
  const reset = useResetDemo();
  const [busy, setBusy] = useState<DemoPersona | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ConfirmRequest | null>(null);
  const list = accounts.data ?? [];
  const byPersona = (p: DemoPersona): DemoAccount | undefined => list.find((a) => a.persona === p);

  const viewAs = async (persona: DemoPersona) => {
    setBusy(persona);
    setError(null);
    try {
      await enterDemo(list, persona, qc);
    } catch {
      setError(t('admin.demo.signInFailed'));
      setBusy(null);
    }
  };

  return (
    <Screen title={t('admin.demo.title')} edges={[]} maxWidth={1200}>
      <Text variant="h1" style={{ paddingTop: 16 }}>{t('admin.demo.title')}</Text>
      <Text variant="body" color={colors.body}>{t('admin.demo.intro')}</Text>
      {accounts.isPending ? (
        <Text variant="caption">{t('common.loading')}</Text>
      ) : list.length === 0 ? (
        <EmptyState title={t('admin.demo.notSetUp')} />
      ) : (
        <View style={{ gap: 12 }}>
          {ORDER.map((p) => {
            const a = byPersona(p);
            if (!a) return null;
            return (
              <Card key={p}>
                <Text variant="h2">{a.full_name}</Text>
                <Text variant="bodySm" color={colors.body}>{t(`admin.demo.${p}Body`)}</Text>
                <View style={{ alignSelf: 'flex-start' }}>
                  <Button
                    title={t('admin.demo.viewAs', { who: t(`admin.demo.${p}`) })}
                    icon="swap"
                    loading={busy === p}
                    disabled={busy !== null}
                    onPress={() => viewAs(p)}
                  />
                </View>
              </Card>
            );
          })}
          {error ? <Text variant="bodySm" color={colors.danger}>{error}</Text> : null}
          {notice ? <Text variant="bodySm" color={colors.success}>{notice}</Text> : null}
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              title={t('admin.demo.reset')}
              variant="outline"
              loading={reset.isPending}
              onPress={() =>
                setDialog({
                  title: t('admin.demo.resetTitle'),
                  body: t('admin.demo.resetBody'),
                  confirmLabel: t('admin.demo.reset'),
                  onConfirm: async () => {
                    await reset.mutateAsync();
                    setNotice(t('admin.demo.resetDone'));
                  },
                })
              }
            />
          </View>
        </View>
      )}
      <ConfirmDialog request={dialog} onClose={() => setDialog(null)} />
    </Screen>
  );
}
