import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme/tokens';

import { Button } from './Button';
import { TextField } from './Field';
import { Text } from './Text';

export type ConfirmRequest = {
  title: string;
  body?: string;
  confirmLabel: string;
  destructive?: boolean;
  /** For notices with a single button. */
  hideCancel?: boolean;
  /** 'required' asks for a reason before confirming, 'optional' offers a note, undefined shows no field. */
  reason?: 'required' | 'optional';
  /** Label for the text field when it is used for something other than a reason (e.g. a name). */
  fieldLabel?: string;
  initialValue?: string;
  /** Single-line field instead of a multi-line note. */
  singleLine?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
};

/** Cross-platform confirmation dialog (replaces window.confirm / Alert), optionally collecting a reason. */
export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  return (
    <Modal visible={!!request} transparent animationType="fade" onRequestClose={onClose}>
      {request ? <DialogBody key={request.title} request={request} onClose={onClose} /> : null}
    </Modal>
  );
}

/** State wiring for a confirmation: call ask({...}) and render {dialog} once in the screen. */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  return { ask: setRequest, dialog: <ConfirmDialog request={request} onClose={() => setRequest(null)} /> };
}

function DialogBody({ request, onClose }: { request: ConfirmRequest; onClose: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState(request.initialValue ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (request.reason === 'required' && !reason.trim()) return setError(request.fieldLabel ? t('taskForm.required') : t('admin.reasonRequired'));
    setError(null);
    setBusy(true);
    try {
      await request.onConfirm(reason.trim());
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable accessibilityLabel={t('common.close')} style={StyleSheet.absoluteFill} onPress={onClose} />
      <View accessibilityRole="alert" style={styles.card}>
        <Text variant="h2">{request.title}</Text>
        {request.body ? <Text variant="bodySm" color={colors.body}>{request.body}</Text> : null}
        {request.reason ? (
          <TextField
            label={request.fieldLabel ?? (request.reason === 'required' ? t('admin.reason') : t('admin.reasonOptional'))}
            value={reason}
            onChangeText={setReason}
            multiline={!request.singleLine}
            maxLength={request.singleLine ? 140 : 500}
            error={error ?? undefined}
            autoFocus
          />
        ) : error ? (
          <Text variant="caption" color={colors.danger}>{error}</Text>
        ) : null}
        <View style={styles.actions}>
          {request.hideCancel ? null : <Button title={t('common.cancel')} variant="outline" onPress={onClose} />}
          <Button title={request.confirmLabel} variant={request.destructive ? 'danger' : 'primary'} loading={busy} onPress={confirm} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'rgba(34,34,34,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 480, backgroundColor: colors.cream, borderRadius: radius.sheet - 8, padding: 24, gap: 16 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' },
});
