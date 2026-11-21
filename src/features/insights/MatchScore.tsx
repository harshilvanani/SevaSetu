import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Row } from '@/components/Layout';
import { Text } from '@/components/Text';
import { colors, fonts } from '@/theme/tokens';

import type { Breakdown } from './api';

const tone = (score: number) =>
  score >= 80 ? { bg: colors.successTint, fg: colors.success } : score >= 60 ? { bg: colors.purpleTint, fg: colors.purpleDark } : { bg: colors.track, fg: colors.subtle };

/** "92% match" pill. */
export function MatchPill({ score }: { score: number }) {
  const { t } = useTranslation();
  const c = tone(score);
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: c.bg }}>
      <Text style={{ fontSize: 12, lineHeight: 16, fontFamily: fonts.semibold, color: c.fg }}>{t('match.pill', { score })}</Text>
    </View>
  );
}

/** Round score with the label underneath. */
export function MatchRing({ score }: { score: number }) {
  const { t } = useTranslation();
  const c = tone(score);
  return (
    <View accessible accessibilityLabel={t('match.pill', { score })} style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 17, lineHeight: 20, color: c.fg }}>{score}%</Text>
      <Text style={{ fontSize: 9, lineHeight: 11, fontFamily: fonts.medium, color: c.fg }}>{t('match.word')}</Text>
    </View>
  );
}

/** Explains the score: skills 40 · seva area 25 · availability 20 · location 10 · experience 5 (+3 LinkedIn). */
export function MatchBreakdown({ b }: { b: Breakdown }) {
  const { t } = useTranslation();
  const parts: [string, number, number][] = [
    [t('match.skills'), b.skills, 40],
    [t('match.area'), b.area, 25],
    [t('match.availability'), b.availability, 20],
    [t('match.location'), b.location, 10],
    [t('match.experience'), b.experience, 5],
  ];
  return (
    <View style={{ gap: 6 }} accessible accessibilityLabel={parts.map(([l, v, m]) => `${l} ${v}/${m}`).join(', ')}>
      <Row gap={10} wrap>
        {parts.map(([label, v, max]) => (
          <View key={label} style={{ minWidth: 88, flexGrow: 1, flexBasis: 88, gap: 3 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="small" color={colors.muted}>{label}</Text>
              <Text variant="small">{v}/{max}</Text>
            </Row>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.track, overflow: 'hidden' }}>
              <View style={{ width: `${(v / max) * 100}%`, height: '100%', backgroundColor: v >= max ? colors.success : colors.purple }} />
            </View>
          </View>
        ))}
      </Row>
      {b.linkedin ? <Text variant="small" color={colors.muted}>{t('match.linkedinBonus', { n: b.linkedin })}</Text> : null}
    </View>
  );
}
