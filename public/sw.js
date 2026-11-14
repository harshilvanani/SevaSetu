// SevaSetu service worker: lets the website be installed and opens the app shell when offline.
// It only touches this site's own pages and built files. Data requests (Supabase) never pass through it.
const CACHE = 'sevasetu-v1';
const SHELL = '/index.html';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages: always try the network first so new versions show up; fall back to the saved app shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) (await caches.open(CACHE)).put(SHELL, res.clone());
          return res;
        } catch {
          const cached = await caches.match(SHELL);
          return (
            cached ||
            new Response('<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;padding:32px"><h1>You are offline</h1><p>Reconnect to the internet and reload SevaSetu.</p>', {
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            })
          );
        }
      })(),
    );
    return;
  }

  // Built files have content hashes in their names, so they can be kept as they are.
  if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
  }
});
