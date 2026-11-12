import { router } from 'expo-router';
import { View } from 'react-native';

import { Screen, TopBar } from '@/components/Layout';
import { Text } from '@/components/Text';
import { colors } from '@/theme/tokens';

export const CONTACT_EMAIL = 'harshil.vanani@gmail.com';
export const LEGAL_UPDATED = 'November 12, 2026';

export type LegalSection = { heading: string; paragraphs?: string[]; bullets?: string[] };

/** Plain, readable legal page (privacy policy, terms). Public: works signed in or out. */
export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <Screen header={<TopBar onBack={back} title={title} />} maxWidth={760}>
      <View style={{ gap: 8, paddingTop: 8 }}>
        <Text variant="h1">{title}</Text>
        <Text variant="caption">Last updated {LEGAL_UPDATED}</Text>
        <Text variant="body" color={colors.body}>{intro}</Text>
      </View>
      {sections.map((s) => (
        <View key={s.heading} style={{ gap: 8 }}>
          <Text variant="h3" accessibilityRole="header">{s.heading}</Text>
          {(s.paragraphs ?? []).map((p, i) => (
            <Text key={i} variant="bodySm" color={colors.body} style={{ lineHeight: 22 }}>{p}</Text>
          ))}
          {(s.bullets ?? []).map((b, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, paddingLeft: 4 }}>
              <Text variant="bodySm" color={colors.body}>•</Text>
              <Text variant="bodySm" color={colors.body} style={{ flex: 1, lineHeight: 22 }}>{b}</Text>
            </View>
          ))}
        </View>
      ))}
    </Screen>
  );
}
