const CACHE_NAME = 'ptit-buro-pwa-v5';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/manifest.json',
  '/js/main.js',
  '/js/state.js',
  '/js/engine/scoring.js',
  '/js/engine/optimizer.js',
  '/js/services/parser.js',
  '/js/ui/components.js',
  '/js/ui/renderer.js',
  '/data/active.json',
  '/data/calendrier.json',
  '/data/players_J1.json',
  '/data/players_J2.json',
  '/data/players_J3.json',
  '/data/feuilles_J1.json',
  '/data/feuilles_J2.json',
  '/data/feuilles_J3.json',
  '/data/forme_J1.json',
  '/data/forme_J2.json',
  '/data/forme_J3.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Mise en cache des ressources essentielles...');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pré-cache partiel (certaines ressources non trouvées) :', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. API de synchronisation : Réseau en priorité, avec repli propre hors-ligne
  if (url.pathname === '/api/sync') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            offline: true,
            message: 'Mode hors-ligne : la synchronisation en direct est désactivée. Données locales utilisées.'
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 200
          }
        );
      })
    );
    return;
  }

  // 2. Polices Google Fonts : Cache-First
  if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open('ptit-buro-fonts').then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) return cachedResponse;
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return cachedResponse || Response.error();
        }
      })
    );
    return;
  }

  // 3. Navigations HTML : Network-First avec repli sur /index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(event.request);
          if (cached) return cached;
          return cache.match('/index.html') || cache.match('/');
        })
    );
    return;
  }

  // 4. Statique et Données (JS, CSS, JSON, Images) : Network-First avec repli Cache hors-ligne
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        return Response.error();
      })
  );
});
