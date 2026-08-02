/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// Workbox si sem pri builde vloží zoznam súborov na precache
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.skipWaiting();
self.addEventListener('activate', () => self.clients.claim());

// Mapové dlaždice OpenStreetMap - cache-first, aby appka fungovala aj offline
// (rovnaká logika ako predtým v generateSW konfigurácii + explicitné tlačidlo
// "Stiahnuť pre offline" v MapView, ktoré tieto dlaždice predstiahne dopredu)
registerRoute(
  ({ url }) => /\.tile\.openstreetmap\.org$/.test(url.hostname),
  new CacheFirst({
    cacheName: 'osm-tiles',
    plugins: [new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  })
);

// ---------------------------------------------------------------------------
// Push notifikácie - server (Edge Function) posiela JSON payload {title, body, url}
// ---------------------------------------------------------------------------

self.addEventListener('push', (event: PushEvent) => {
  let payload: { title?: string; body?: string; url?: string } = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Vlčince Pasport', body: event.data?.text() ?? '' };
  }

  const title = payload.title || 'Vlčince Pasport';
  const options: NotificationOptions = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data?.url as string) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
