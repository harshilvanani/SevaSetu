import { Image } from 'expo-image';
import { View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

import { Text } from './Text';

// Brand colours sampled from the SevaSetu logo (assets/brand/sevasetu-logo.png).
const BRAND_PURPLE = '#650DB5';
const BRAND_ORANGE = '#FD8602';
const MARK_RATIO = 512 / 270;

/** Sun, volunteers and bridge mark. `size` is the mark's height. */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/logo-mark.png')}
      style={{ width: size * MARK_RATIO, height: size }}
      contentFit="contain"
      accessible={false}
    />
  );
}

export function Logo({ size = 40, subtitle = true, onDark }: { size?: number; subtitle?: boolean; onDark?: boolean }) {
  const word = { fontFamily: fonts.semibold, fontSize: size * 0.55, lineHeight: size * 0.66, letterSpacing: -0.3 };
  return (
    <View accessible accessibilityLabel="SevaSetu by The Art of Living" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <LogoMark size={size * 0.8} />
      <View>
        <Text style={word}>
          <Text style={[word, { color: onDark ? colors.white : BRAND_PURPLE }]}>seva</Text>
          <Text style={[word, { color: BRAND_ORANGE }]}>setu</Text>
        </Text>
        {subtitle ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: Math.max(11, size * 0.26), lineHeight: size * 0.36, color: onDark ? '#CDB8E6' : colors.purple }}>
            by The Art of Living
          </Text>
        ) : null}
      </View>
    </View>
  );
}
