import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadIrve, resetIrveCache } from '../src/data/irve-repository.js';
import { initLazyStationsMap } from '../src/ui/stations-map-loader.js';
import { lazyBuildAssets } from '../scripts/inject-build-vars.mjs';

test('la base IRVE n’est téléchargée qu’une fois, puis retentée après un échec', async () => {
    resetIrveCache();
    let calls = 0;
    const ok = async () => { calls += 1; return { ok: true, json: async () => ({ updatedAt: '2026-11-11', stations: [{ id: 'a' }] }) }; };
    const [first, second] = await Promise.all([loadIrve({ fetchImpl: ok }), loadIrve({ fetchImpl: ok })]);
    assert.equal(calls, 1);
    assert.equal(first, second);
    assert.deepEqual(first, { updatedAt: '2026-11-11', stations: [{ id: 'a' }] });

    resetIrveCache();
    const failing = async () => ({ ok: false, status: 503 });
    await assert.rejects(loadIrve({ fetchImpl: failing }), /HTTP 503/);
    const retried = await loadIrve({ fetchImpl: ok });
    assert.equal(retried.stations.length, 1, 'un échec ne reste pas en cache');
    resetIrveCache();
});

test('la carte et l’application partagent le même chargeur IRVE', async () => {
    const [app, map] = await Promise.all([
        readFile(new URL('../app.js', import.meta.url), 'utf8'),
        readFile(new URL('../src/ui/stations-map.js', import.meta.url), 'utf8')
    ]);
    assert.doesNotMatch(app, /fetch\('\.\/irve-fast\.json'\)/);
    assert.doesNotMatch(map, /fetch\('\.\/irve-fast\.json'\)/);
    assert.match(app, /loadIrve\(\)/);
    assert.match(map, /await loadIrve\(\)/);
});

test('la carte n’est chargée qu’à sa première ouverture et reçoit les prix mis en attente', async () => {
    const calls = [];
    let loads = 0;
    const load = async () => {
        loads += 1;
        return { initStationsMap: options => ({
            activate: () => calls.push('activate'),
            showOperator: key => calls.push(`operator:${key}`),
            setPrices: prices => calls.push(`prices:${prices.size}`),
            refreshLanguage: () => calls.push('language'),
            options
        }) };
    };
    const map = initLazyStationsMap({ getHomeZone: () => null }, { load });
    map.setPrices(new Map([['atlante', {}]]));
    map.refreshLanguage();
    assert.equal(loads, 0, 'ni les prix ni la langue ne déclenchent le téléchargement');
    await map.activate();
    await map.showOperator('atlante');
    map.setPrices(new Map());
    map.refreshLanguage();
    assert.equal(loads, 1);
    assert.deepEqual(calls, ['prices:1', 'activate', 'operator:atlante', 'prices:0', 'language']);
});

test('un échec de chargement de la carte est signalé et peut être retenté', async () => {
    let attempts = 0;
    let errors = 0;
    const load = async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('hors ligne');
        return { initStationsMap: () => ({ activate() {}, setPrices() {} }) };
    };
    const map = initLazyStationsMap({ onLoadError: () => { errors += 1; } }, { load });
    await map.activate();
    assert.equal(errors, 1);
    await map.activate();
    assert.equal(attempts, 2);
    assert.equal(errors, 1);
});

test('app.js n’importe plus Leaflet au démarrage', async () => {
    const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
    assert.doesNotMatch(app, /from '\.\/src\/ui\/stations-map\.js'/);
    assert.match(app, /initLazyStationsMap\(/);
});

test('les fichiers chargés à la demande sont précachés sans doublonner ceux de index.html', () => {
    const manifest = {
        'index.html': { file: 'assets/index-a.js', css: ['assets/index-a.css'], assets: ['assets/inter-b.woff2'], isEntry: true },
        'src/ui/stations-map.js': { file: 'assets/stations-map-c.js', css: ['assets/stations-map-c.css'], isDynamicEntry: true },
        'src/fonts/inter.woff2': { file: 'assets/inter-b.woff2' }
    };
    assert.deepEqual(
        lazyBuildAssets(manifest, ['./assets/index-a.css', './assets/index-a.js']),
        ['./assets/inter-b.woff2', './assets/stations-map-c.css', './assets/stations-map-c.js']
    );
    assert.deepEqual(lazyBuildAssets({}, []), []);
});

test('la police est servie par l’application, sans requête vers un service tiers', async () => {
    const [html, css] = await Promise.all([
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../styles.css', import.meta.url), 'utf8')
    ]);
    assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
    assert.match(css, /@font-face \{[^}]*font-family: 'Inter';[^}]*src: url\('\.\/src\/fonts\/inter-latin-wght-normal\.woff2'\)/s);
    // Ressources chargées par la page (scripts, feuilles de style, images), pas les liens à suivre.
    const external = [...html.matchAll(/<(?:script|link|img)\b[^>]*\s(?:src|href)="(https?:\/\/[^"/]+)/g)].map(match => match[1]);
    assert.deepEqual([...new Set(external)], ['https://umami.aubard.net'], 'seul Umami est chargé depuis un autre hôte');
});
