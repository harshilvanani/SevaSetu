// Design tokens from the SevaSetu "Design foundations" board (Art of Living theme, v1.1).
import { Platform } from 'react-native';

export const colors = {
  // brand
  sunrise: '#FF9800', // brand highlights
  deepOrange: '#F17225', // progress fill, accents
  orangeText: '#D9590B', // orange used for text on cream (AA)
  purple: '#8441AB', // selection, verified
  purpleDark: '#5E2E7E', // purple text on tint
  purpleTint: '#F3EAF8',
  plum: '#3C285F', // active-seva hero card
  amber: '#FFB547', // pending
  amberSoft: '#FFC680',
  amberTint: '#FFF1D9',
  amberText: '#6B3A00',
  amberTextDark: '#7A4300',
  peach: '#FFF3E6', // brand panel background

  // neutrals
  charcoal: '#222222', // buttons, headings
  text: '#222222',
  body: '#525252',
  muted: '#666666',
  subtle: '#4A4A4A',
  cream: '#FDFBF7', // page background
  white: '#FFFFFF',
  sand: '#F3ECE2', // secondary button
  sandSoft: '#F6F0E8', // neutral chip
  track: '#EEE7DD', // progress track, segmented background
  border: '#DAD2C6',
  borderSoft: '#E7DFD3',
  divider: '#E2DACE',
  cardBorder: '#EEE7DD',

  // status
  danger: '#8C2F22',
  dangerTint: '#F9E4E0',
  success: '#1F6B3A',
  successTint: '#E3F2E7',
} as const;

export type ColorName = keyof typeof colors;

export const fonts = {
  // Lora for display headings, Poppins for UI text (loaded in app/_layout.tsx)
  serif: 'Lora_600SemiBold',
  serifMedium: 'Lora_500Medium',
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export const radius = { card: 16, control: 12, chip: 999, sheet: 28, small: 6 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const touch = 44; // minimum touch target

export const breakpoints = { tablet: 768, desktop: 1024 } as const;

export const shadow = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(34,34,34,0.06)' },
  default: {
    shadowColor: '#222222',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
}) as object;

export const shadowRaised = Platform.select({
  web: { boxShadow: '0 12px 32px rgba(60,40,95,0.16)' },
  default: {
    shadowColor: '#3C285F',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
}) as object;

// Type scale (size / line height) from the foundations board.
export const type = {
  display: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 48 },
  h1: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 36 },
  h2: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 30 },
  h3: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 26 },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 26 },
  bodySm: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  overline: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  small: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
} as const;

export type TypeVariant = keyof typeof type;
