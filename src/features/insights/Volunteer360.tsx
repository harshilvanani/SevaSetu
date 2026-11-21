import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/Chip';
import { Icon, type IconName } from '@/components/Icon';
import { Avatar, Card, Row, useLayout } from '@/components/Layout';
import { Text } from '@/components/Text';
import { formatDayYear } from '@/lib/format';
import { colors, fonts, radius } from '@/theme/tokens';

import type { PersonType, Slot } from './api';
import { useLabels } from './labels';

export type Person360 = {
  full_name: string;
  email?: string | null;
  code?: string | null;
  person_type: PersonType;
  is_active?: boolean;
  city?: string | null;
  region?: string | null;
  profession?: string | null;
  linkedin_url?: string | null;
  linkedin_consent?: boolean;
  interests: string[];
  skills: string[];
  skill_levels: Record<string, string>;
  languages: string[];
  courses: string[];
  availability: Slot[];
  hours?: number;
  events_count?: number;
  joined_at?: string | null;
  last_active?: string | null;
};

/** Summarise weekly availability: "Weekends · mornings, afternoons". */
export function useAvailabilitySummary() {
  const { t } = useTranslation();
  return (slots: Slot[]) => {
    if (!slots.length) return t('v360.noAvailability');
    const days = new Set(slots.map((s) => s.weekday));
    const periods = ['morning', 'afternoon', 'evening'].filter((p) => slots.some((s) => s.period === p));
    const weekend = days.has(5) || days.has(6);
    const weekday = [0, 1, 2, 3, 4].some((d) => days.has(d));
    const when = weekend && weekday ? t('v360.weekdaysWeekends') : weekend ? t('v360.weekends') : t('v360.weekdays');
    return `${when} · ${periods.map((p) => t(`availability.periods.${p}`).toLowerCase()).join(', ')}`;
  };
}

export function Volunteer360({
  person,
  mine,
  actions,
  insight,
  extra,
}: {
  person: Person360;
  mine?: boolean;
  actions?: ReactNode;
  insight?: ReactNode;
  extra?: ReactNode;
}) {
  const { t } = useTranslation();
  const { isDesktop } = useLayout();
  const L = useLabels();
  const summary = useAvailabilitySummary();
  const p = person;
  const sortedSkills = [...p.skills].sort((a, b) => rank(p.skill_levels[b]) - rank(p.skill_levels[a]));

  const header = (
    <Card style={{ padding: 20, gap: 16 }}>
      <View style={[{ gap: 16 }, isDesktop && { flexDirection: 'row', alignItems: 'center' }]}>
        <Row gap={16} style={{ flex: 1, alignItems: 'flex-start' }}>
          <Avatar name={p.full_name || '?'} size={72} color={p.person_type === 'volunteer' ? colors.amber : '#D9C4EA'} />
          <View style={{ flex: 1, gap: 6 }}>
            <Row gap={8} wrap>
              <Text variant="h2">{p.full_name || '—'}</Text>
              {p.is_active !== undefined ? (
                <Badge label={p.is_active ? t('directory.active') : t('directory.inactive')} tone={p.is_active ? 'success' : 'plain'} />
              ) : null}
            </Row>
            <Row gap={8} wrap>
              <Badge label={L.personType(p.person_type)} tone="purple" />
              {p.code ? <Text variant="small" color={colors.muted}>{p.code}</Text> : null}
              {p.city || p.region ? <Text variant="small" color={colors.muted}>· {p.city ?? L.region(p.region)}</Text> : null}
            </Row>
            <Row gap={14} wrap>
              {p.email ? <Text variant="caption">{p.email}</Text> : null}
              {p.linkedin_url ? (
                <Pressable accessibilityRole="link" onPress={() => Linking.openURL(p.linkedin_url!)} hitSlop={6}>
                  <Row gap={4}>
                    <Icon name="link" size={14} color={colors.purple} />
                    <Text variant="label" color={colors.purple}>{t('v360.linkedin')}</Text>
                  </Row>
                </Pressable>
              ) : mine ? (
                <Pressable accessibilityRole="link" onPress={() => router.push('/profile/edit')} hitSlop={6}>
                  <Row gap={4}>
                    <Icon name="link" size={14} color={colors.purple} />
                    <Text variant="label" color={colors.purple}>{t('v360.addLinkedin')}</Text>
                  </Row>
                </Pressable>
              ) : null}
            </Row>
          </View>
        </Row>
        <Row gap={0} style={isDesktop ? styles.statsDesktop : styles.statsPhone}>
          <Stat value={L.num(Math.round((p.hours ?? 0) * 10) / 10)} label={t('v360.sevaHours')} />
          <Stat value={String(p.events_count ?? 0)} label={t('v360.events')} />
          <Stat value={String(p.interests.length)} label={t('v360.sevaAreas')} />
        </Row>
      </View>
      {actions ? <Row gap={8} wrap>{actions}</Row> : null}
    </Card>
  );

  const main = (
    <View style={{ gap: 16, flex: 2 }}>
      <Section title={t('v360.professional')} sub={t('v360.professionalSub')} action={mine ? t('common.edit') : undefined}>
        {p.profession || p.linkedin_url ? (
          <View style={{ gap: 8 }}>
            {p.profession ? <Text variant="body">{p.profession}</Text> : null}
            <Row gap={6}>
              <Icon name="shield" size={16} color={colors.muted} />
              <Text variant="caption">
                {p.linkedin_url && p.linkedin_consent ? t('v360.matchingOn') : t('v360.matchingOff')}
              </Text>
            </Row>
          </View>
        ) : (
          <Pressable
            accessibilityRole={mine ? 'button' : undefined}
            disabled={!mine}
            onPress={() => router.push('/profile/edit')}
            style={styles.dashed}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label">{mine ? t('v360.addProfessional') : t('v360.noProfessional')}</Text>
              <Text variant="caption">{t('v360.addProfessionalBody')}</Text>
            </View>
            {mine ? <Icon name="plus" size={18} color={colors.purple} /> : null}
          </Pressable>
        )}
      </Section>

      <Section title={t('v360.preferredSeva')} sub={t('v360.areasSelected', { count: p.interests.length })} action={mine ? t('common.edit') : undefined} onAction={() => router.push('/availability')}>
        {p.interests.length ? (
          <View style={styles.areaGrid}>
            {p.interests.map((a) => (
              <View key={a} style={[styles.areaCard, isDesktop && { width: '48.5%' }]}>
                <View style={styles.areaIcon}>
                  <Icon name={AREA_ICON[a] ?? 'heart'} size={18} color={colors.purpleDark} />
                </View>
                <Text variant="label" style={{ flex: 1 }}>{L.area(a)}</Text>
                <Icon name="check" size={18} color={colors.purple} />
              </View>
            ))}
          </View>
        ) : (
          <Text variant="caption">{t('v360.noAreas')}</Text>
        )}
      </Section>

      <Section title={t('v360.skillsLanguages')} sub={t('v360.skillsLanguagesSub')} action={mine ? t('common.edit') : undefined}>
        <View style={[{ gap: 16 }, isDesktop && { flexDirection: 'row' }]}>
          <View style={{ flex: 1, gap: 8 }}>
            <Text variant="small" color={colors.muted}>{t('v360.skills')}</Text>
            {sortedSkills.length ? (
              <Row gap={6} wrap>
                {sortedSkills.map((s) => (
                  <Badge key={s} label={p.skill_levels[s] ? `${L.skill(s)} · ${L.level(p.skill_levels[s])}` : L.skill(s)} tone={p.skill_levels[s] === 'expert' ? 'purple' : 'plain'} />
                ))}
              </Row>
            ) : (
              <Text variant="caption">{t('v360.none')}</Text>
            )}
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Text variant="small" color={colors.muted}>{t('v360.languages')}</Text>
            {p.languages.length ? (
              <Row gap={6} wrap>
                {p.languages.map((l) => <Badge key={l} label={L.language(l)} tone="success" />)}
              </Row>
            ) : (
              <Text variant="caption">{t('v360.none')}</Text>
            )}
          </View>
        </View>
      </Section>
      {extra}
    </View>
  );

  const side = (
    <View style={{ gap: 16, flex: 1 }}>
      <Card style={{ padding: 20, gap: 0 }}>
        <Text variant="h3" style={{ paddingBottom: 8 }}>{t('v360.overview')}</Text>
        <Fact label={t('v360.availability')} value={summary(p.availability)} />
        <Fact label={t('v360.region')} value={L.region(p.region)} />
        {p.courses.length ? <Fact label={t('dataHealth.courses')} value={p.courses.map((c) => t(`courses.${c}`)).join(', ')} /> : null}
        {p.joined_at ? <Fact label={t('v360.joined')} value={formatDayYear(p.joined_at)} /> : null}
        {p.last_active ? <Fact label={t('v360.lastActive')} value={formatDayYear(p.last_active)} /> : null}
        <Fact label={t('v360.professionalMatching')} value={p.linkedin_url && p.linkedin_consent ? t('v360.enabled') : t('v360.disabled')} last />
      </Card>
      {insight}
    </View>
  );

  return (
    <View style={{ gap: 16 }}>
      {header}
      <View style={[{ gap: 16 }, isDesktop && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        {main}
        {side}
      </View>
    </View>
  );

  function Section({ title, sub, action, onAction, children }: { title: string; sub?: string; action?: string; onAction?: () => void; children: ReactNode }) {
    return (
      <Card style={{ padding: 20, gap: 14 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="h3">{title}</Text>
            {sub ? <Text variant="caption">{sub}</Text> : null}
          </View>
          {action ? (
            <Pressable accessibilityRole="link" onPress={onAction ?? (() => router.push('/profile/edit'))} hitSlop={8}>
              <Text variant="label" color={colors.purple}>{action}</Text>
            </Pressable>
          ) : null}
        </Row>
        {children}
      </Card>
    );
  }
}

/** Dark insight card ("Your interests match 3 open seva"). */
export function InsightCard({ title, body, action, onPress }: { title: string; body: string; action: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.insight, pressed && { opacity: 0.92 }]}>
      <Row gap={8}>
        <Icon name="sparkle" size={16} color="#CDB8E6" />
        <Text variant="overline" color="#CDB8E6">{title}</Text>
      </Row>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24, color: colors.white }}>{body}</Text>
      <Text variant="label" color="#E9DFF5">{action} →</Text>
    </Pressable>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 14, gap: 2, minWidth: 80 }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 24, lineHeight: 30 }}>{value}</Text>
      <Text variant="small" color={colors.muted} align="center">{label}</Text>
    </View>
  );
}

function Fact({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <Row style={last ? styles.fact : { ...styles.fact, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }} gap={12}>
      <Text variant="caption" style={{ flex: 1 }}>{label}</Text>
      <Text variant="label" style={{ flex: 1.4, textAlign: 'right' }}>{value}</Text>
    </Row>
  );
}

const rank = (l?: string) => (l === 'expert' ? 3 : l === 'intermediate' ? 2 : l === 'beginner' ? 1 : 0);

export const AREA_ICON: Record<string, IconName> = {
  event_setup: 'home',
  outreach: 'send',
  teaching: 'bookmark',
  food: 'heart',
  technology: 'grid',
  administration: 'clipboard',
  design_media: 'image',
  elder_care: 'users',
  kids_youth: 'sparkle',
  environment: 'globe',
  translation: 'language',
  fundraising: 'award',
  meditation: 'sparkle',
  data: 'chart',
  logistics: 'layers',
  professional: 'shield',
};

const styles = StyleSheet.create({
  statsDesktop: { borderLeftWidth: 1, borderLeftColor: colors.cardBorder, paddingLeft: 12 },
  statsPhone: { justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 14 },
  dashed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.control,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#BDB6AB',
  },
  areaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  areaCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.cream,
  },
  areaIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.purpleTint },
  fact: { paddingVertical: 12 },
  insight: { gap: 8, padding: 20, borderRadius: radius.card, backgroundColor: colors.plum },
});
