import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, fonts } from '@/theme/tokens';

import { decorative } from './a11y';
import { Text } from './Text';

// SevaSetu mark: a bridge (setu) with a rising sun behind it.
// Placeholder brand until official Art of Living artwork is supplied.
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" {...decorative}>
      <Circle cx="32" cy="32" r="32" fill={colors.peach} />
      <Circle cx="32" cy="27" r="11" fill={colors.sunrise} />
      <Path d="M12 45C17 34 24 29 32 29s15 5 20 16" stroke={colors.purple} strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <Path d="M7 45h50M22 34.5V45M32 29v16M42 34.5V45" stroke={colors.purple} strokeWidth="4.5" strokeLinecap="round" />
    </Svg>
  );
}

export function Logo({ size = 40, subtitle = true }: { size?: number; subtitle?: boolean }) {
  return (
    <View accessible accessibilityLabel="SevaSetu by The Art of Living" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <LogoMark size={size} />
      <View>
        <Text style={{ fontFamily: fonts.serif, fontSize: size * 0.5, lineHeight: size * 0.62, color: colors.text }}>SevaSetu</Text>
        {subtitle ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: Math.max(11, size * 0.26), lineHeight: size * 0.36, color: colors.purple }}>
            by The Art of Living
          </Text>
        ) : null}
      </View>
    </View>
  );
}
