import { Text as RNText, type TextProps } from 'react-native';

import { colors, type TypeVariant, type as typeScale } from '@/theme/tokens';

type Props = TextProps & {
  variant?: TypeVariant;
  color?: string;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  align?: 'left' | 'center' | 'right';
};

const weightFont = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export function Text({ variant = 'body', color, weight, align, style, ...rest }: Props) {
  const isHeading = variant === 'display' || variant === 'h1' || variant === 'h2';
  return (
    <RNText
      accessibilityRole={isHeading ? 'header' : undefined}
      style={[
        typeScale[variant],
        { color: color ?? (variant === 'caption' ? colors.muted : colors.text) },
        weight && !isHeading ? { fontFamily: weightFont[weight] } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  );
}
