import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button } from '@/components/Button';
import { TextField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Row, useLayout } from '@/components/Layout';
import { Logo } from '@/components/Logo';
import { ProgressBar } from '@/components/ProgressBar';
import { Badge } from '@/components/Chip';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { useAppStore } from '@/lib/store';
import {
  appleAuthAvailable,
  authErrorKey,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '@/features/auth/api';
import { colors, fonts, radius, shadowRaised } from '@/theme/tokens';

type Mode = 'signin' | 'create';

export default function SignInScreen() {
  const { t } = useTranslation();
  const { isDesktop, isPhone } = useLayout();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: Mode; invite?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'create' ? 'create' : 'signin');
  const authNotice = useAppStore((s) => s.authNotice);
  const setAuthNotice = useAppStore((s) => s.setAuthNotice);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.cream }}
      contentContainerStyle={[{ flexGrow: 1 }, isDesktop && { flexDirection: 'row' }]}
      keyboardShouldPersistTaps="handled">
      {isDesktop ? <BrandPanel /> : <MobileHeader topInset={insets.top} compact={!isPhone} />}
      <View style={[styles.formSide, isDesktop && { paddingVertical: 48 }]}>
        <View style={styles.form}>
          {params.invite ? (
            <View style={styles.invite}>
              <Icon name="mail" size={20} color={colors.amberText} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label" color={colors.amberText}>{t('auth.invitedTitle')}</Text>
                <Text variant="caption" color={colors.amberText}>{t('auth.invitedBody')}</Text>
              </View>
            </View>
          ) : null}

          {authNotice ? (
            <Pressable accessibilityRole="alert" onPress={() => setAuthNotice(null)} style={styles.blocked}>
              <Icon name="lock" size={18} color={colors.danger} />
              <Text variant="bodySm" color={colors.danger} style={{ flex: 1 }}>{authNotice}</Text>
              <Icon name="x" size={16} color={colors.danger} />
            </Pressable>
          ) : null}

          <View style={{ gap: 6 }}>
            <Text variant="h1">{mode === 'signin' ? t('auth.welcomeBack') : t('auth.createTitle')}</Text>
            <Text variant="bodySm" color={colors.muted}>
              {mode === 'signin' ? t('auth.signInSubtitle') : t('auth.createSubtitle')}
            </Text>
          </View>

          <Segmented
            label="Account"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'signin', label: t('auth.tabSignIn') },
              { value: 'create', label: t('auth.tabCreate') },
            ]}
          />

          <SocialButtons />

          <Row gap={12}>
            <View style={styles.rule} />
            <Text variant="caption">{t('auth.orEmail')}</Text>
            <View style={styles.rule} />
          </Row>

          <EmailForm key={mode} mode={mode} />

          <Text variant="bodySm" color={colors.muted} align="center">
            {mode === 'signin' ? t('auth.newHere') : t('auth.haveAccount')}{' '}
            <Text
              variant="bodySm"
              weight="semibold"
              color={colors.purple}
              accessibilityRole="link"
              onPress={() => setMode(mode === 'signin' ? 'create' : 'signin')}>
              {mode === 'signin' ? t('auth.createAccount') : t('auth.signIn')}
            </Text>
          </Text>

          <Pressable accessibilityRole="link" onPress={() => router.push('/discover')} style={styles.browse}>
            <Icon name="compass" size={18} />
            <Text variant="bodySm" weight="medium">{t('auth.browse')}</Text>
          </Pressable>

          <Text variant="small" color={colors.muted} align="center" style={{ lineHeight: 19, fontFamily: fonts.regular }}>
            {t('auth.legal')}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function SocialButtons() {
  const { t } = useTranslation();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    appleAuthAvailable().then(setApple);
  }, []);

  const run = async (which: 'google' | 'apple') => {
    setError(null);
    setBusy(which);
    try {
      await (which === 'google' ? signInWithGoogle() : signInWithApple());
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'ERR_REQUEST_CANCELED') setError(t(authErrorKey(e)));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      {apple ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => run('apple')}
          disabled={!!busy}
          style={[styles.social, { backgroundColor: colors.charcoal, borderColor: colors.charcoal }]}>
          <Text style={{ color: colors.white, fontSize: 18, lineHeight: 22 }} accessibilityElementsHidden>{''}</Text>
          <Text style={{ color: colors.white, fontFamily: fonts.semibold, fontSize: 15 }}>{t('auth.apple')}</Text>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => run('google')} disabled={!!busy} style={[styles.social, busy === 'google' && { opacity: 0.6 }]}>
        <View style={styles.g} accessibilityElementsHidden>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 }}>G</Text>
        </View>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15 }}>{t('auth.google')}</Text>
      </Pressable>
      {error ? <Text variant="caption" color={colors.danger}>{error}</Text> : null}
    </View>
  );
}

function EmailForm({ mode }: { mode: Mode }) {
  const { t } = useTranslation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const schema = z.object({
    name: mode === 'create' ? z.string().trim().min(1, t('auth.errors.nameRequired')) : z.string().optional(),
    email: z.string().trim().email(t('auth.errors.invalidEmail')),
    password: z.string().min(mode === 'create' ? 8 : 1, t('auth.errors.passwordShort')),
  });
  type Values = z.infer<typeof schema>;

  const { control, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (v) => {
    setServerError(null);
    setNotice(null);
    try {
      if (mode === 'signin') await signInWithEmail(v.email, v.password);
      else {
        const { needsConfirmation } = await signUpWithEmail(v.name ?? '', v.email, v.password);
        if (needsConfirmation) setNotice(t('auth.checkEmail'));
      }
    } catch (e) {
      setServerError(t(authErrorKey(e)));
    }
  });

  return (
    <View style={{ gap: 16 }}>
      {mode === 'create' ? (
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <TextField
              label={t('auth.name')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoComplete="name"
              textContentType="name"
              error={fieldState.error?.message}
            />
          )}
        />
      ) : null}
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label={t('auth.email')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <TextField
            label={t('auth.password')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            secureTextEntry
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            textContentType={mode === 'signin' ? 'password' : 'newPassword'}
            hint={mode === 'create' ? t('auth.passwordHint') : undefined}
            error={fieldState.error?.message}
            onSubmitEditing={() => onSubmit()}
            right={
              mode === 'signin' ? (
                <Link href="/forgot-password" style={{ color: colors.purple, fontFamily: fonts.semibold, fontSize: 13 }}>
                  {t('auth.forgot')}
                </Link>
              ) : undefined
            }
          />
        )}
      />
      {serverError ? (
        <Text variant="caption" color={colors.danger} accessibilityLiveRegion="assertive">{serverError}</Text>
      ) : null}
      {notice ? (
        <View style={styles.notice}>
          <Icon name="mail" size={18} color={colors.purpleDark} />
          <Text variant="bodySm" color={colors.purpleDark} style={{ flex: 1 }}>{notice}</Text>
        </View>
      ) : null}
      <Button
        title={mode === 'signin' ? t('auth.signIn') : t('auth.createAccount')}
        size="lg"
        onPress={() => onSubmit()}
        loading={formState.isSubmitting}
      />
    </View>
  );
}

function MobileHeader({ topInset, compact }: { topInset: number; compact: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.mobileHeader, { paddingTop: topInset + 24 }, compact && { alignItems: 'center' }]}>
      <Logo size={44} />
      <View style={{ gap: 6 }}>
        <Text variant="overline" color={colors.purple}>{t('common.appName')}</Text>
        <Text style={{ fontFamily: fonts.serifMedium, fontSize: 25, lineHeight: 32 }}>
          {t('common.taglineLead')}
          {'\n'}
          <Text style={{ fontFamily: fonts.serifMedium, fontSize: 25, lineHeight: 32, color: colors.orangeText }}>
            {t('common.taglineAccent')}
          </Text>
        </Text>
      </View>
    </View>
  );
}

function BrandPanel() {
  const { t } = useTranslation();
  return (
    <View style={styles.brand}>
      <Logo size={52} />
      <View>
        <View style={styles.photo}>
          <Icon name="image" size={32} color="#6B4A2A" />
          <Text variant="label" color="#6B4A2A">[Community photo]</Text>
          <Text variant="caption" color="#6B4A2A" align="center">{t('auth.photoPlaceholder')}</Text>
        </View>
        <View style={[styles.floatCard, shadowRaised]}>
          <Row gap={6}>
            <Badge label="On-site" tone="purple" />
            <Badge label="36 kits left" tone="amber" />
          </Row>
          <Text variant="title">Pack winter care kits</Text>
          <Text variant="caption">Sat · 10:00 AM · Community Hall</Text>
          <ProgressBar value={0.7} />
        </View>
      </View>
      <View style={{ gap: 16, maxWidth: 540, paddingTop: 12 }}>
        <Text variant="overline" color={colors.purple}>SevaSetu · Volunteer seva</Text>
        <Text style={{ fontFamily: fonts.serifMedium, fontSize: 44, lineHeight: 50, letterSpacing: -0.8 }}>
          {t('common.taglineLead')}{' '}
          <Text style={{ fontFamily: fonts.serifMedium, fontSize: 44, lineHeight: 50, color: colors.orangeText }}>
            {t('common.taglineAccent')}
          </Text>
        </Text>
        <Text variant="body" color={colors.body} style={{ lineHeight: 27 }}>{t('auth.heroBody')}</Text>
        <Row gap={20} wrap>
          {[t('auth.pillJoin'), t('auth.pillPrivate'), t('auth.pillVerified')].map((p) => (
            <Row key={p} gap={6}>
              <Icon name="check" size={16} color={colors.deepOrange} />
              <Text variant="bodySm" color={colors.body}>{p}</Text>
            </Row>
          ))}
        </Row>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  formSide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 28 },
  form: { width: '100%', maxWidth: 420, gap: 22 },
  rule: { flex: 1, height: 1, backgroundColor: colors.divider },
  social: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.white,
  },
  g: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browse: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.control,
    backgroundColor: colors.sand,
  },
  invite: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, backgroundColor: colors.amberTint },
  blocked: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: colors.dangerTint },
  notice: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.purpleTint, alignItems: 'center' },
  mobileHeader: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    backgroundColor: colors.peach,
    gap: 18,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  brand: {
    flex: 1.15,
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
    justifyContent: 'space-between',
    gap: 40,
    paddingVertical: 48,
    paddingHorizontal: 56,
    backgroundColor: colors.peach,
  },
  photo: {
    height: 300,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#E3B98F',
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  floatCard: {
    position: 'absolute',
    right: 28,
    bottom: -28,
    width: 300,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
});
