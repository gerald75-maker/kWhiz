import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceSw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

test('précharge les tarifs et les assets générés', () => {
    assert.match(sourceSw, /'\.\/tarifs\.json'/);
    assert.match(sourceSw, /const BUILD_ASSETS = __BUILD_ASSETS__;/);
    assert.match(sourceSw, /\.\.\.BUILD_ASSETS/);
});

test('normalise la clé de cache de tarifs.json', () => {
    assert.match(sourceSw, /url\.pathname\.endsWith\('\/tarifs\.json'\)/);
    assert.match(sourceSw, /url\.search = ''/);
    assert.match(sourceSw, /caches\.match\(cacheKey\)/);
});

test('un échec de préchargement empêche l’installation du nouveau worker', () => {
    assert.doesNotMatch(sourceSw, /Precache failed/);
});
