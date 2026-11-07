import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/locales/en';
import fr from '@/locales/fr';
import hi from '@/locales/hi';

export const SUPPORTED_LOCALES = ['en', 'hi', 'fr'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', hi: 'हिन्दी', fr: 'Français' };

function deviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return (SUPPORTED_LOCALES as readonly string[]).includes(code) ? (code as Locale) : 'en';
}

// eslint-disable-next-line import/no-named-as-default-member -- i18next's documented setup
i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi }, fr: { translation: fr } },
  lng: deviceLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

// BCP-47 tag for Intl date/number formatting.
export function intlLocale(): string {
  return { en: 'en-US', hi: 'hi-IN', fr: 'fr-CA' }[(i18n.language as Locale) ?? 'en'] ?? 'en-CA';
}

export default i18n;
