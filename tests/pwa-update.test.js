import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getInstallEnvironment } from '../src/pwa/pwa-manager.js';

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
