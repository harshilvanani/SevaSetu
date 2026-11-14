import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { siteUrl } from '@/lib/site';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export const redirectTo = (path: string) => makeRedirectUri({ scheme: 'sevasetu', path });

/** Links sent by email open the website (works for everyone, any device); app deep link only as a fallback. */
const emailLink = (path: string) => {
  const site = siteUrl();
  return site ? `${site}/${path}` : redirectTo(path);
};

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function signUpWithEmail(name: string, email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: name.trim() }, emailRedirectTo: emailLink('auth/callback') },
  });
  if (error) throw error;
  // Supabase returns a user with no identities when the email is already registered.
  if (data.user && data.user.identities?.length === 0) {
    throw Object.assign(new Error('User already registered'), { code: 'user_already_exists' });
  }
  return { needsConfirmation: !data.session };
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: emailLink('reset-password'),
  });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

// Completes a PKCE redirect (?code=...) on native deep links.
export async function exchangeCodeFromUrl(url: string) {
  const code = new URL(url).searchParams.get('code');
  const errorDescription = new URL(url).searchParams.get('error_description');
  if (errorDescription) throw new Error(errorDescription);
  if (!code) return false;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return true;
}

export async function signInWithGoogle() {
  const redirect = redirectTo('auth/callback');
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect } });
    if (error) throw error;
    return;
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirect, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirect);
  if (result.type === 'success') await exchangeCodeFromUrl(result.url);
}

// Native Sign in with Apple (iOS). Supabase verifies Apple's ID token with the hashed nonce.
export async function signInWithApple() {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    nonce: hashedNonce,
  });
  if (!credential.identityToken) throw new Error('No identity token from Apple');
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
  // Apple only shares the name on first sign-in; store it.
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
  if (name) {
    const { data } = await supabase.auth.getUser();
    if (data.user) await supabase.from('profiles').update({ full_name: name }).eq('id', data.user.id);
  }
}

export async function appleAuthAvailable() {
  return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync());
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function authErrorKey(e: unknown): string {
  const err = e as { code?: string; message?: string };
  const code = err?.code ?? '';
  const msg = err?.message ?? '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'auth.errors.invalidCredentials';
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return 'auth.errors.emailNotConfirmed';
  if (code === 'user_already_exists' || /already registered/i.test(msg)) return 'auth.errors.userExists';
  if (code === 'user_banned' || /banned/i.test(msg)) return 'auth.errors.blocked';
  return 'auth.errors.generic';
}
