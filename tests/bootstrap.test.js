import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const themeSource = await readFile(new URL('../src/ui/theme.js', import.meta.url), 'utf8');

test('initialise les contrôleurs avant le chargement initial des tarifs', () => {
    const initStart = appSource.indexOf('function initApp()');
    const navigationInit = appSource.indexOf('navigation = initNavigation', initStart);
    const tariffLoad = appSource.indexOf('loadTarifs();', navigationInit);
    assert.ok(initStart >= 0 && navigationInit > initStart && tariffLoad > navigationInit);
});

test('amorce aussi l’application si DOMContentLoaded est déjà passé', () => {
    assert.match(appSource, /document\.readyState === 'loading'/);
    assert.match(appSource, /else \{\s*initApp\(\);\s*\}/);
});

test('conserve un repli matchMedia pour les anciennes versions de WebKit', () => {
    assert.match(themeSource, /typeof colorScheme\.addEventListener === 'function'/);
    assert.match(themeSource, /typeof colorScheme\.addListener === 'function'/);
});
