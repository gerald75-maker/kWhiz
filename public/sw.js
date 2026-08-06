// Service Worker kWhiz
// Stratégie : Network First pour index.html/sw.js/tarifs.json, bypass total pour .php, Cache First pour les autres assets statiques
const CACHE_NAME = 'kwhiz-__CACHE_HASH__';

// Garde-fou : si inject-build-vars.mjs n'a pas tourné, le placeholder n'est pas remplacé
// et les anciens caches ne seront jamais purgés à l'activation.
if (CACHE_NAME.includes('__')) {
    console.error('[SW] CACHE_HASH non injecté — vérifiez que `npm run build` a bien exécuté inject-build-vars.mjs');
}

// Remplacé par scripts/inject-build-vars.mjs avec les fichiers Vite hashés.
const BUILD_ASSETS = __BUILD_ASSETS__;

const STATIC_ASSETS = [
  './',
  './index.html',
  './tarifs.json',
  './irve-fast.json',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  ...BUILD_ASSETS
];

// Note : 'app.js' est intentionnellement absent — après build Vite le fichier
// est hashé (ex: assets/index-XXXXXXXX.js) et n'a donc jamais ce nom en prod.
const NETWORK_FIRST_PATTERNS = ['index.html', 'sw.js', 'tarifs.json', 'irve-fast.json'];

function isNetworkFirst(url) {
  const path = new URL(url).pathname;
  if (path === '/' || path.endsWith('/index.html')) return true;
  return NETWORK_FIRST_PATTERNS.some(p => path.endsWith(p));
}

function isPhp(url) {
  return new URL(url).pathname.endsWith('.php');
}

function cacheKeyFor(request) {
  const url = new URL(request.url);
  if (url.pathname.endsWith('/tarifs.json')) url.search = '';
  return url.toString();
}

// ── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  // Pas de skipWaiting() ici : le nouveau SW reste en état 'waiting' jusqu'à ce que
  // l'utilisateur confirme la mise à jour via le banner → message SKIP_WAITING.
  // (Identique à Wattlog registerType:'prompt' pour une cohérence cross-app.)
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// ── MESSAGE ──────────────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name.startsWith('kwhiz-') && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // PHP : jamais en cache, fetch direct avec cache: 'no-store'
  if (isPhp(event.request.url)) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  // Network First : index.html, racine, sw.js, tarifs.json
  if (isNetworkFirst(event.request.url)) {
    const cacheKey = cacheKeyFor(event.request);
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(cacheKey, clone))
              .catch(err => console.warn('[SW] Cache put failed:', err));
          }
          return response;
        })
        .catch(() => caches.match(cacheKey))
    );
    return;
  }

  // Cache First : icônes et autres assets statiques
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, clone))
              .catch(err => console.warn('[SW] Cache put failed:', err));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
    })
  );
});
