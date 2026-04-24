/* eslint-disable no-restricted-globals */
// Service Worker — web push notifications + offline app-shell caching.
// One SW for the whole app; the push handlers live below the cache handlers.

const SHELL_CACHE = 'teranga-shell-v1';
const API_CACHE = 'teranga-api-v1';

// Paths pre-cached at install so the POS can boot with no network.
const SHELL_PRECACHE = [
  '/',
  '/dashboard',
  '/dashboard/pos',
  '/dashboard/orders',
  '/dashboard/offline-queue',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192x192.png',
];

// API GETs cached stale-while-revalidate so menu, servers and tables are
// available offline even without the IndexedDB cache.
const API_SWR_PATTERNS = [
  /\/api\/articles(\?.*)?$/,
  /\/api\/categories(\?.*)?$/,
  /\/api\/establishments(\/[^/]+)?$/,
  /\/api\/restaurant-tables(\?.*)?$/,
  /\/api\/establishments\/[^/]+\/servers(\?.*)?$/,
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Best-effort precache; individual failures don't block install.
      Promise.all(
        SHELL_PRECACHE.map((url) =>
          fetch(url, { credentials: 'same-origin' })
            .then((res) => (res.ok ? cache.put(url, res) : null))
            .catch(() => null)
        )
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop old caches
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== API_CACHE && k.startsWith('teranga-'))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // writes never cached; queue is the offline path

  const url = new URL(req.url);

  // Health endpoint: always network, never cached — we need it to tell if
  // the server is really reachable.
  if (url.pathname === '/api/health') return;

  // API GETs → stale-while-revalidate for the selected patterns, otherwise
  // network-first with cache fallback.
  if (url.pathname.startsWith('/api/')) {
    const isSwr = API_SWR_PATTERNS.some((r) => r.test(url.pathname + url.search));
    if (isSwr) {
      event.respondWith(staleWhileRevalidate(req, API_CACHE));
    } else {
      event.respondWith(networkFirst(req, API_CACHE));
    }
    return;
  }

  // Same-origin navigations & assets: network-first with shell fallback.
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req, SHELL_CACHE));
  }
});

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((resp) => {
      if (resp && resp.ok) cache.put(req, resp.clone());
      return resp;
    })
    .catch(() => null);
  return cached || (await fetchPromise) || offlineFallback(req);
}

async function networkFirst(req, cacheName) {
  try {
    const resp = await fetch(req);
    if (resp && resp.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, resp.clone());
    }
    return resp;
  } catch {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(req);
    if (cached) return cached;
    return offlineFallback(req);
  }
}

function offlineFallback(req) {
  // For navigations, serve the cached dashboard shell if we have one.
  if (req.mode === 'navigate') {
    return caches.match('/dashboard').then(
      (r) => r || new Response('Hors-ligne', { status: 503 })
    );
  }
  return new Response(
    JSON.stringify({ success: false, error: 'Hors-ligne et donnée non cachée' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  );
}

// ---------------------------------------------------------------------------
// Web Push notifications
// ---------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Teranga PMS', body: event.data.text() };
  }

  const title = payload.title || 'Teranga PMS';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: payload.data || {},
    tag: (payload.data && payload.data.notificationId) || 'default',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.link) || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
