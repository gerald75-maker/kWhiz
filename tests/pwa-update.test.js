import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/pwa/pwa-manager.js', import.meta.url), 'utf8');

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
