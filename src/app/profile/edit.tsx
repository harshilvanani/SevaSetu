import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/Field';
import { Icon } from '@/components/Icon';
import { Card, Row, Screen, TopBar } from '@/components/Layout';
import { OptionCards, Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { type Profile, useAuth } from '@/features/auth/AuthProvider';
import { type PersonType, type SkillLevel, useMyPrivate, useSaveMyPrivate } from '@/features/insights/api';
import { LANGUAGE_OPTIONS, PROVINCES, SKILL_SUGGESTIONS, useLabels } from '@/features/insights/labels';
import { useSaveProfile } from '@/features/profile/prefs';
import { colors, radius } from '@/theme/tokens';

const LINKEDIN = /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/\S{1,200}$/i;
const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const priv = useMyPrivate();
  if (!profile || priv.isPending) return <Screen><Text variant="caption">{t('common.loading')}</Text></Screen>;
  return <EditForm profile={profile} needs={priv.data ?? ''} />;
}

function EditForm({ profile, needs }: { profile: Profile; needs: string }) {
  const { t } = useTranslation();
  const L = useLabels();
  const save = useSaveProfile();
  const savePrivate = useSaveMyPrivate();
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/profile'));

  const [personType, setPersonType] = useState<PersonType>((profile.person_type as PersonType) ?? 'volunteer');
  const [profession, setProfession] = useState(profile.profession ?? '');
  const [linkedin, setLinkedin] = useState(profile.linkedin_url ?? '');
  const [consent, setConsent] = useState(profile.linkedin_consent);
  const [country, setCountry] = useState(profile.country === 'US' ? 'US' : profile.country === 'CA' ? 'CA' : 'OTHER');
  const [province, setProvince] = useState(profile.province ?? '');
  const [languages, setLanguages] = useState<string[]>(profile.languages ?? []);
  const [skills, setSkills] = useState<string[]>(profile.skills);
  const [levels, setLevels] = useState<Record<string, SkillLevel>>((profile.skill_levels ?? {}) as Record<string, SkillLevel>);
  const [draftSkill, setDraftSkill] = useState('');
  const [optIn, setOptIn] = useState(profile.directory_opt_in);
  const [access, setAccess] = useState(needs);
  const [error, setError] = useState<string | null>(null);

  const linkedinError = linkedin.trim() && !LINKEDIN.test(linkedin.trim()) ? t('v360.linkedinInvalid') : null;
  const toggleLang = (l: string) => setLanguages((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));
  const addSkill = (raw: string) => {
    const k = slug(raw);
    if (k && !skills.includes(k)) setSkills([...skills, k]);
    setDraftSkill('');
  };
  const removeSkill = (k: string) => {
    setSkills(skills.filter((x) => x !== k));
    setLevels(({ [k]: _drop, ...rest }) => rest);
  };

  const submit = async () => {
    if (linkedinError) return;
    setError(null);
    try {
      const cleanLevels = Object.fromEntries(Object.entries(levels).filter(([k]) => skills.includes(k)));
      await Promise.all([
        save.mutateAsync({
          person_type: personType,
          profession: profession.trim() || null,
          linkedin_url: linkedin.trim() || null,
          linkedin_consent: !!linkedin.trim() && consent,
          country: country === 'OTHER' ? 'XX' : country,
          province: country === 'CA' ? province || null : province.trim() || null,
          languages,
          skills,
          skill_levels: cleanLevels,
          directory_opt_in: optIn,
        }),
        savePrivate.mutateAsync(access),
      ]);
      back();
    } catch {
      setError(t('common.somethingWrong'));
    }
  };

  return (
    <Screen
      title={t('v360.editProfile')}
      maxWidth={760}
      header={<TopBar title={t('v360.editProfile')} onBack={back} />}
      footer={<Button title={t('common.save')} size="lg" loading={save.isPending || savePrivate.isPending} onPress={submit} />}>
      <Card style={styles.card}>
        <Text variant="h3">{t('v360.role')}</Text>
        <OptionCards<PersonType>
          label={t('v360.role')}
          value={personType}
          onChange={setPersonType}
          columns={3}
          options={[
            { value: 'volunteer', title: L.personType('volunteer') },
            { value: 'volunteer_teacher', title: L.personType('volunteer_teacher') },
            { value: 'full_time_teacher', title: L.personType('full_time_teacher') },
          ]}
        />
      </Card>

      <Card style={styles.card}>
        <Text variant="h3">{t('v360.professional')}</Text>
        <Text variant="caption">{t('v360.addProfessionalBody')}</Text>
        <TextField label={t('v360.profession')} optional value={profession} onChangeText={setProfession} placeholder={t('v360.professionPlaceholder')} maxLength={80} />
        <TextField label={t('v360.linkedinUrl')} optional value={linkedin} onChangeText={setLinkedin} placeholder="https://www.linkedin.com/in/…"
          autoCapitalize="none" keyboardType="url" error={linkedinError ?? undefined} />
        <Toggle label={t('v360.consentLabel')} hint={t('v360.consentHint')} value={consent && !!linkedin.trim()} disabled={!linkedin.trim()} onChange={setConsent} />
      </Card>

      <Card style={styles.card}>
        <Text variant="h3">{t('v360.whereTitle')}</Text>
        <Segmented
          label={t('v360.country')}
          value={country}
          onChange={(c) => { setCountry(c); setProvince(''); }}
          options={[{ value: 'CA', label: t('v360.canada') }, { value: 'US', label: t('v360.usa') }, { value: 'OTHER', label: t('v360.otherCountry') }]}
        />
        {country === 'CA' ? (
          <View style={{ gap: 8 }}>
            <Text variant="label">{t('v360.province')}</Text>
            <Row gap={8} wrap>
              {PROVINCES.map((pv) => <Chip key={pv} size="sm" label={pv} selected={province === pv} onPress={() => setProvince(pv)} />)}
            </Row>
          </View>
        ) : (
          <TextField label={country === 'US' ? t('v360.state') : t('v360.regionLabel')} optional value={province} onChangeText={setProvince} maxLength={40} />
        )}
      </Card>

      <Card style={styles.card}>
        <Text variant="h3">{t('v360.languages')}</Text>
        <Row gap={8} wrap>
          {LANGUAGE_OPTIONS.map((l) => <Chip key={l} size="sm" label={L.language(l)} selected={languages.includes(l)} onPress={() => toggleLang(l)} />)}
        </Row>
      </Card>

      <Card style={styles.card}>
        <Text variant="h3">{t('v360.skills')}</Text>
        <Text variant="caption">{t('v360.skillsHint')}</Text>
        {skills.map((k) => (
          <View key={k} style={styles.skillRow}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="label">{L.skill(k)}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t('v360.removeSkill', { skill: L.skill(k) })} onPress={() => removeSkill(k)} hitSlop={8}>
                <Icon name="x" size={18} color={colors.muted} />
              </Pressable>
            </Row>
            <Row gap={6} wrap>
              {(['beginner', 'intermediate', 'expert'] as const).map((lv) => (
                <Chip key={lv} size="sm" label={L.level(lv)} selected={levels[k] === lv}
                  onPress={() => setLevels((cur) => ({ ...cur, [k]: lv }))} />
              ))}
            </Row>
          </View>
        ))}
        <TextField label={t('v360.addSkill')} optional value={draftSkill} onChangeText={setDraftSkill} onSubmitEditing={() => addSkill(draftSkill)}
          placeholder={t('onboarding.skillsPlaceholder')} right={draftSkill.trim() ? <Button title={t('common.add')} variant="ghost" onPress={() => addSkill(draftSkill)} /> : undefined} />
        <Row gap={8} wrap>
          {SKILL_SUGGESTIONS.filter((s) => !skills.includes(s)).slice(0, 14).map((s) => (
            <Chip key={s} size="sm" icon="plus" label={L.skill(s)} dashed onPress={() => addSkill(s)} />
          ))}
        </Row>
      </Card>

      <Card style={styles.card}>
        <Text variant="h3">{t('v360.privacyTitle')}</Text>
        <Toggle label={t('v360.optInLabel')} hint={t('v360.optInHint')} value={optIn} onChange={setOptIn} />
        <TextField label={t('v360.accessibility')} optional multiline value={access} onChangeText={setAccess} maxLength={500}
          hint={t('v360.accessibilityHint')} placeholder={t('v360.accessibilityPlaceholder')} />
      </Card>
      {error ? <Text variant="caption" color={colors.danger}>{error}</Text> : null}
    </Screen>
  );
}

function Toggle({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Row gap={12} style={{ alignItems: 'flex-start', opacity: disabled ? 0.55 : 1 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{label}</Text>
        {hint ? <Text variant="caption">{hint}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: colors.purple, false: colors.border }}
        thumbColor={colors.white}
      />
    </Row>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14, padding: 20 },
  skillRow: { gap: 8, padding: 12, borderRadius: radius.control, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.cream },
});
