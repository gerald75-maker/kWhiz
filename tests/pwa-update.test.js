import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createUpdateChecker, getInstallEnvironment, watchInstallingWorker } from '../src/pwa/pwa-manager.js';

const source = await readFile(new URL('../src/pwa/pwa-manager.js', import.meta.url), 'utf8');

test('les dialogues Izivia et IONITY référencent des titres existants', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    for (const id of ['izivia-title', 'ionity-rewards-title']) {
        assert.match(html, new RegExp(`aria-labelledby="${id}"`));
        assert.match(html, new RegExp(`<h3[^>]*id="${id}"[^>]*>`));
    }
});

test('ne confirme une mise à jour qu’après changement du contrôleur', () => {
    assert.match(source, /return controllerChange;/);
    assert.match(source, /const activated = await activateWaitingWorker\(registration, onStatus\);\s*return \{ supported: true, updated: activated \};/);
});

test('ne recharge la page que lorsqu’une mise à jour est activée', () => {
    assert.match(source, /const result = await checkForApplicationUpdate\(\);\s*if \(result\.updated\)/);
    assert.doesNotMatch(source, /finally \{\s*window\.setTimeout\(reloadApplication/);
});

test('confirme la version installée et affiche le résultat d’une vérification', async () => {
    const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
    assert.match(source, /const UPDATE_APPLIED_KEY = 'kwhiz_update_applied'/);
    assert.match(source, /showAppliedUpdateConfirmation\(\)/);
    assert.match(source, /className = 'update-status-banner'/);
    assert.match(appSource, /showUpdateStatus\('pwa\.status\.current'\)/);
    assert.match(appSource, /showUpdateStatus\('pwa\.status\.checkFailed'\)/);
});

test('vérifie le Service Worker sans utiliser le cache HTTP', () => {
    assert.match(source, /register\('\.\/sw\.js', \{ updateViaCache: 'none' \}\)/);
});

test('conserve l’installation disponible depuis un navigateur', () => {
    assert.deepEqual(getInstallEnvironment({
        userAgent: 'Mozilla/5.0 (iPhone) Version/18.0 Mobile Safari/604.1'
    }), { isIos: true, isAndroid: false, isStandalone: false });

    assert.deepEqual(getInstallEnvironment({
        userAgent: 'Mozilla/5.0 (Linux; Android 16) Chrome/140.0'
    }), { isIos: false, isAndroid: true, isStandalone: false });
});

test('détecte les modes standalone standard et historique iOS', () => {
    assert.equal(getInstallEnvironment({ displayModeStandalone: true }).isStandalone, true);
    assert.equal(getInstallEnvironment({ navigatorStandalone: true }).isStandalone, true);
});

test('le mode PWA masque uniquement la fonction d’installation', async () => {
    const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
    assert.match(appSource, /installSection\.hidden = isStandalone/);
    assert.doesNotMatch(appSource, /page-settings[^\n]*hidden = isStandalone/);
});

test('createUpdateChecker : vérifie, espace les vérifications et ignore les cas inutiles', async () => {
    let calls = 0;
    let time = 1_000_000;
    const registration = { waiting: null, update: async () => { calls += 1; } };
    const base = { registration, isOnline: () => true, isBusy: () => false, now: () => time, minIntervalMs: 60000 };
    const check = createUpdateChecker(base);

    assert.equal(await check({ force: true }), true);
    assert.equal(calls, 1);
    time += 10_000;
    assert.equal(await check(), false);
    assert.equal(calls, 1);
    time += 51_000;
    assert.equal(await check(), true);
    assert.equal(calls, 2);

    assert.equal(await createUpdateChecker({ ...base, isOnline: () => false })({ force: true }), false);
    assert.equal(await createUpdateChecker({ ...base, isBusy: () => true })({ force: true }), false);
    assert.equal(await createUpdateChecker({ ...base, registration: { ...registration, waiting: {} } })({ force: true }), false);
    assert.equal(calls, 2);
});

test('createUpdateChecker : une erreur de update() n’est jamais propagée', async () => {
    const registration = { waiting: null, update: async () => { throw new Error('réseau'); } };
    const check = createUpdateChecker({ registration, isOnline: () => true, isBusy: () => false, now: () => 0 });
    assert.equal(await check({ force: true }), false);
});

test('watchInstallingWorker : appelle onReady quand la mise à jour est installée', () => {
    const makeWorker = () => Object.assign(new EventTarget(), { state: 'installing' });
    const install = worker => {
        worker.state = 'installed';
        worker.dispatchEvent(new Event('statechange'));
    };

    let ready = 0;
    const worker = makeWorker();
    watchInstallingWorker(worker, { hasController: () => true, isBusy: () => false, onReady: () => { ready += 1; } });
    install(worker);
    assert.equal(ready, 1);

    ready = 0;
    const first = makeWorker();
    watchInstallingWorker(first, { hasController: () => false, isBusy: () => false, onReady: () => { ready += 1; } });
    install(first);
    const busy = makeWorker();
    watchInstallingWorker(busy, { hasController: () => true, isBusy: () => true, onReady: () => { ready += 1; } });
    install(busy);
    assert.equal(ready, 0);

    const twice = makeWorker();
    const options = { hasController: () => true, isBusy: () => false, onReady: () => { ready += 1; } };
    watchInstallingWorker(twice, options);
    watchInstallingWorker(twice, options);
    install(twice);
    assert.equal(ready, 1);

    assert.doesNotThrow(() => watchInstallingWorker(null));
});

test('initServiceWorker vérifie les mises à jour au démarrage et au retour dans l’app', () => {
    const body = source.slice(source.indexOf('export function initServiceWorker'), source.indexOf('export function initPwa'));
    assert.ok(body.includes('check({ force: true })'));
    assert.ok(body.includes('visibilitychange'));
    assert.ok(body.includes('pageshow'));
    assert.ok(body.includes('watchInstallingWorker(registration.installing)'));
});
