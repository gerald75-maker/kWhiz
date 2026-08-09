// Service Worker kWhiz
// Stratégie : Network First pour index.html/sw.js/tarifs.json/irve-fast.json,
// bypass total pour .php, Cache First pour les autres assets statiques du même domaine.
const CACHE_NAME = 'kwhiz-__CACHE_HASH__';

// Garde-fou : si inject-build-vars.mjs n'a pas tourné, le placeholder n'est pas remplacé
// et les anciens caches ne seront jamais purgés à l'activation.
if (CACHE_NAME.includes('__')) {
    console.error('[SW] CACHE_HASH non injecté — vérifiez que `npm run build` a bien exécuté inject-build-vars.mjs');
}

// Remplacés par scripts/inject-build-vars.mjs pendant le build.
const CRITICAL_ASSETS = __CRITICAL_ASSETS__;
const OPTIONAL_ASSETS = __OPTIONAL_ASSETS__;

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

function isSameOrigin(url) {
  return new URL(url).origin === self.location.origin;
}

function cacheKeyFor(request) {
  const url = new URL(request.url);
  if (url.pathname.endsWith('/tarifs.json')) url.search = '';
  return url.toString();
}

function unavailableResponse() {
  return new Response('Service temporarily unavailable', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

async function matchCache(key) {
  try {
    return (await caches.match(key)) || null;
  } catch (error) {
    console.warn('[SW] Cache match failed:', error);
    return null;
  }
}

async function cachedNavigationFallback() {
  return (await matchCache('./index.html')) || unavailableResponse();
}

async function networkOnly(request) {
  try {
    return (await fetch(request, { cache: 'no-store' })) || unavailableResponse();
  } catch (_) {
    return unavailableResponse();
  }
}

async function networkFirst(request) {
  const cacheKey = cacheKeyFor(request);
  try {
    const response = await fetch(request);
    if (!response) return unavailableResponse();
    if (response.status === 200) {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(cacheKey, response.clone());
      } catch (error) {
        console.warn('[SW] Cache put failed:', error);
      }
    }
    return response;
  } catch (_) {
    const cached = await matchCache(cacheKey);
    if (cached) return cached;
    if (request.mode === 'navigate') return cachedNavigationFallback();
    return unavailableResponse();
  }
}

async function cacheFirst(request) {
  const cached = await matchCache(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (!response) return unavailableResponse();
    if (response.status === 200) {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      } catch (error) {
        console.warn('[SW] Cache put failed:', error);
      }
    }
    return response;
  } catch (_) {
    if (request.mode === 'navigate') return cachedNavigationFallback();
    return unavailableResponse();
  }
}

// ── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  // Pas de skipWaiting() ici : le nouveau SW reste en état 'waiting' jusqu'à ce que
  // l'utilisateur confirme la mise à jour via le banner → message SKIP_WAITING.
  // (Identique à Wattlog registerType:'prompt' pour une cohérence cross-app.)
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        await cache.addAll(CRITICAL_ASSETS);
        const results = await Promise.allSettled(
          OPTIONAL_ASSETS.map(asset => cache.add(asset))
        );
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.warn('[SW] Optional precache failed:', OPTIONAL_ASSETS[index], result.reason);
          }
        });
      })
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
  if (!isSameOrigin(event.request.url)) return;

  // PHP : jamais en cache, fetch direct avec cache: 'no-store'
  if (isPhp(event.request.url)) {
    event.respondWith(networkOnly(event.request));
    return;
  }

  // Network First : index.html, racine, sw.js, tarifs.json et irve-fast.json
  if (isNetworkFirst(event.request.url)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Cache First : icônes et autres assets statiques
  event.respondWith(cacheFirst(event.request));
});
