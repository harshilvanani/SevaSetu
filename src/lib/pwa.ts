import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (isWeb) {
  // Chrome and Edge announce that the site can be installed; keep the offer for the Profile screen.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
}

/** Registers the service worker that makes the website installable (published site only). */
export function useRegisterServiceWorker() {
  useEffect(() => {
    if (!isWeb || __DEV__ || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
}

const standalone = () =>
  isWeb && (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

/**
 * 'prompt': the browser can install it with one tap. 'ios': iPhone/iPad Safari, where it is done from the Share menu.
 * 'none': already installed, not a browser that can install, or not the web.
 */
export function useInstallApp() {
  const offer = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => deferred,
    () => null,
  );
  const [state] = useState(() => ({
    installed: standalone(),
    ios: isWeb && /iphone|ipad|ipod/i.test(navigator.userAgent),
  }));
  const status: 'prompt' | 'ios' | 'none' = state.installed ? 'none' : offer ? 'prompt' : state.ios ? 'ios' : 'none';
  const install = async () => {
    if (!deferred) return;
    const e = deferred;
    deferred = null;
    emit();
    await e.prompt();
  };
  return { status, install };
}
