import { Platform } from 'react-native';

/**
 * Public address of the SevaSetu website (e.g. https://sevasetu.example.com), with no trailing slash.
 * Links in emails (account confirmation, password reset) always open this website, whichever app the
 * person signed up from, so they work for everyone. Falls back to the current web origin in local dev.
 */
export function siteUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return null;
}
