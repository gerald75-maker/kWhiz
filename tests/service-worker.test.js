import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { computeCacheHash } from '../scripts/inject-build-vars.mjs';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const CACHE_NAME = 'kwhiz-testhash';
const CRITICAL_ASSETS = ['./index.html', './tarifs.json', './assets/app.js', './assets/app.css'];
const OPTIONAL_ASSETS = ['./irve-fast.json', './manifest.json', './logos/engie-vianeo.webp', './icons/icon-192.png'];

function createHarness({ criticalFailure = null, optionalFailures = [], cacheMatchFailure = null, fetchImpl } = {}) {
  const handlers = new Map();
  const calls = { addAll: [], add: [], deleted: [], warnings: [], claimed: 0 };
  const cachedResponses = new Map();
  const cacheNames = new Set([CACHE_NAME]);
  const cache = {
    async addAll(assets) {
      calls.addAll.push([...assets]);
      if (criticalFailure) throw criticalFailure;
    },
    async add(asset) {
      calls.add.push(asset);
      if (optionalFailures.includes(asset)) throw new Error(`optional failure: ${asset}`);
    },
    async put(key, response) {
      cachedResponses.set(typeof key === 'string' ? key : key.url, response);
    }
  };
  const caches = {
    async open(name) { cacheNames.add(name); return cache; },
    async match(key) {
      if (cacheMatchFailure) throw cacheMatchFailure;
      return cachedResponses.get(typeof key === 'string' ? key : key.url);
    },
    async keys() { return [...cacheNames]; },
    async delete(name) { calls.deleted.push(name); cacheNames.delete(name); return true; }
  };
  const self = {
    location: { origin: 'https://kwhiz.example' },
    clients: { async claim() { calls.claimed += 1; } },
    addEventListener(type, handler) { handlers.set(type, handler); },
    skipWaiting() {}
  };
  const code = source
    .replace('__CACHE_HASH__', 'testhash')
    .replace('__CRITICAL_ASSETS__', JSON.stringify(CRITICAL_ASSETS))
    .replace('__OPTIONAL_ASSETS__', JSON.stringify(OPTIONAL_ASSETS));
  vm.runInNewContext(code, {
    self,
    caches,
    fetch: fetchImpl || (async () => new Response('network')),
    URL,
    Response,
    Promise,
    console: { warn: (...args) => calls.warnings.push(args), error() {} }
  });

  return {
    calls,
    cacheNames,
    cachedResponses,
    async dispatchExtendable(type) {
      let pending;
      handlers.get(type)({ waitUntil(value) { pending = Promise.resolve(value); } });
      return pending;
    },
    dispatchFetch(request) {
      let responsePromise = null;
      handlers.get('fetch')({
        request,
        respondWith(value) { responsePromise = Promise.resolve(value); }
      });
      return responsePromise;
    }
  };
}

function request(path, { mode = 'cors', method = 'GET', origin = 'https://kwhiz.example' } = {}) {
  return { url: `${origin}${path}`, method, mode };
}

test('installe atomiquement le groupe critique', async () => {
  const harness = createHarness();
  await harness.dispatchExtendable('install');
  assert.deepEqual(harness.calls.addAll, [CRITICAL_ASSETS]);
  assert.deepEqual(harness.calls.add, OPTIONAL_ASSETS);
});

test('un échec critique empêche l’installation', async () => {
  const error = new Error('critical failure');
  const harness = createHarness({ criticalFailure: error });
  await assert.rejects(harness.dispatchExtendable('install'), error);
  assert.deepEqual(harness.calls.add, []);
});

test('un échec facultatif est journalisé sans empêcher l’installation', async () => {
  const failedAsset = './irve-fast.json';
  const harness = createHarness({ optionalFailures: [failedAsset] });
  await harness.dispatchExtendable('install');
  assert.equal(harness.calls.warnings.length, 1);
  assert.equal(harness.calls.warnings[0][1], failedAsset);
});

test('le hash change avec le contenu d’une ressource précachée', () => {
  const before = computeCacheHash([
    { path: './index.html', content: 'index' },
    { path: './assets/app.js', content: 'version 1' }
  ]);
  const after = computeCacheHash([
    { path: './index.html', content: 'index' },
    { path: './assets/app.js', content: 'version 2' }
  ]);
  assert.notEqual(after, before);
});

test('le hash est stable à chemins et contenus identiques', () => {
  const entries = [
    { path: './index.html', content: 'index' },
    { path: './assets/app.js', content: 'bundle' }
  ];
  assert.equal(computeCacheHash(entries), computeCacheHash([...entries].reverse()));
});

test('une navigation hors ligne est servie par index.html', async () => {
  const harness = createHarness({ fetchImpl: async () => { throw new Error('offline'); } });
  const shell = new Response('<html>offline</html>');
  harness.cachedResponses.set('./index.html', shell);
  const response = await harness.dispatchFetch(request('/page-inconnue', { mode: 'navigate' }));
  assert.equal(response, shell);
});

test('l’absence du réseau et du cache retourne une réponse 503 contrôlée', async () => {
  const harness = createHarness({ fetchImpl: async () => { throw new Error('offline'); } });
  const response = await harness.dispatchFetch(request('/tarifs.json'));
  assert.ok(response instanceof Response);
  assert.equal(response.status, 503);
});

test('une défaillance du Cache Storage retourne aussi une réponse contrôlée', async () => {
  const harness = createHarness({
    fetchImpl: async () => { throw new Error('offline'); },
    cacheMatchFailure: new Error('cache unavailable')
  });
  const response = await harness.dispatchFetch(request('/index.html', { mode: 'navigate' }));
  assert.ok(response instanceof Response);
  assert.equal(response.status, 503);
});

test('chaque branche fetch gérée produit une réponse', async () => {
  const offline = createHarness({ fetchImpl: async () => { throw new Error('offline'); } });
  for (const managedRequest of [
    request('/index.html', { mode: 'navigate' }),
    request('/tarifs.json'),
    request('/status.php'),
    request('/asset-manquant.png')
  ]) {
    const responsePromise = offline.dispatchFetch(managedRequest);
    assert.ok(responsePromise instanceof Promise);
    assert.ok(await responsePromise instanceof Response);
  }

  assert.equal(offline.dispatchFetch(request('/asset.png', { method: 'POST' })), null);
  assert.equal(offline.dispatchFetch(request('/asset.png', { origin: 'https://cdn.example' })), null);
});

test('l’activation supprime seulement les anciens caches kWhiz', async () => {
  const harness = createHarness();
  harness.cacheNames.add('kwhiz-old');
  harness.cacheNames.add('unrelated-cache');
  await harness.dispatchExtendable('activate');
  assert.deepEqual(harness.calls.deleted, ['kwhiz-old']);
  assert.equal(harness.cacheNames.has(CACHE_NAME), true);
  assert.equal(harness.cacheNames.has('unrelated-cache'), true);
  assert.equal(harness.calls.claimed, 1);
});
