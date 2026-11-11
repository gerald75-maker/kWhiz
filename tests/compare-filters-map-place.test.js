import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyComparisonFilters } from '../src/ui/views/comparison-view.js';
import { setLanguage, t } from '../src/i18n/i18n.js';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const formulas = [
    { opKey: 'atlante', name: 'Go', monthlyCost: 4.99 },
    { opKey: 'atlante', name: 'Sans abonnement', monthlyCost: 0 },
    { opKey: 'lidl', name: 'Lidl Plus', monthlyCost: 0 },
    { opKey: 'electroverse', name: 'Electroverse', monthlyCost: 0 }
];
const coverage = {
    label: 'Bourges', radiusKm: 20,
    counts: new Map([['lidl', 3]]),
    operators: new Set(['atlante', 'lidl'])
};

test('« Sans abonnement » écarte les formules à frais fixes', () => {
    assert.deepEqual(applyComparisonFilters(formulas, { noSubscription: true }).map(f => f.name),
        ['Sans abonnement', 'Lidl Plus', 'Electroverse']);
});

test('« Réseaux près de chez moi » garde les réseaux proches et ceux absents de la base IRVE', () => {
    assert.deepEqual(applyComparisonFilters(formulas, { nearby: true, coverage }).map(f => f.opKey),
        ['lidl', 'electroverse']);
    assert.equal(applyComparisonFilters(formulas, { nearby: true, coverage: null }).length, formulas.length);
    assert.deepEqual(applyComparisonFilters(formulas, { noSubscription: true, nearby: true, coverage }).map(f => f.name),
        ['Lidl Plus', 'Electroverse']);
});

test('les filtres, le champ « Autour de… » et les balises de partage sont dans la page', async () => {
    const html = await read('index.html');
    assert.match(html, /id="compare-filters"[^>]*role="group"/);
    assert.match(html, /data-compare-filter="noSubscription"/);
    assert.match(html, /data-compare-filter="nearby"/);
    assert.match(html, /<form class="map-place" id="map-place-form" role="search">/);
    assert.match(html, /property="og:title"/);
    assert.match(html, /property="og:image"/);
    assert.match(html, /name="twitter:card"/);
});

test('la carte se centre sur une commune et sur la zone de recharge sans localisation', async () => {
    const [map, app] = await Promise.all([read('src/ui/stations-map.js'), read('app.js')]);
    assert.match(map, /findPlace\(places\(\), query\)/);
    assert.match(map, /centerOnHomeZone\(\)/);
    assert.match(app, /getHomeZone: \(\) => zoneControls\?\.getZone\(\)/);
});

test('chaque changement d’onglet remonte en haut de page', async () => {
    const navigation = await read('src/ui/navigation.js');
    assert.match(navigation, /if \(previousView !== view\) window\.scrollTo\(\{ top: 0/);
});

test('compteur de la carte et libellés en français et en anglais', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(t('map.count.inView', { visible: '12', stations: '3 816 stations' }), '12 sur 3 816 stations dans la zone affichée');
    assert.match(t('help.plan.filters'), /Sans abonnement.*Réseaux près de chez moi/);
    assert.match(t('help.map.place'), /Autour de…/);
    setLanguage('en', { persist: false, translate: false });
    assert.equal(t('map.count.inView', { visible: '12', stations: '3,816 stations' }), '12 of 3,816 stations in view');
    assert.equal(t('comparison.filters.nearby'), 'Networks near me');
    setLanguage('fr', { persist: false, translate: false });
});

test('les champs gardent 16 px sur écran tactile pour éviter le zoom automatique d’iOS', async () => {
    const css = await read('styles.css');
    assert.match(css, /@media \(hover: none\) and \(pointer: coarse\) \{\s*input:not\(\[type="range"\]\):not\(\[type="checkbox"\]\):not\(\[type="radio"\]\),\s*select:not\(\[multiple\]\),\s*textarea:not\(\[hidden\]\) \{ font-size: 16px; \}/);
    // Le champ de zone ne doit pas imposer sa largeur naturelle à la colonne de Mon choix.
    assert.match(css, /\.profile-zone-input \{ flex:1 1 0; width:0; min-width:0;/);
});

test('la carte regroupe les stations proches et affiche un prix sur chaque marqueur', async () => {
    const [map, html] = await Promise.all([read('src/ui/stations-map.js'), read('index.html')]);
    assert.match(map, /const CLUSTER_CELL_PX = 72;/);
    assert.match(map, /if \(map\.getZoom\(\) > CLUSTER_MAX_ZOOM\) return items\.map\(station => \[station\]\);/);
    assert.match(map, /className: 'map-cluster'/);
    assert.match(map, /class="map-marker-price"/);
    assert.match(map, /if \(station\.motorway === true\) return null;/);
    assert.match(html, /class="map-panel" data-expanded="false" id="map-panel"/);
    assert.match(html, /aria-controls="map-station-list" aria-expanded="false" class="map-panel-toggle" id="map-panel-toggle"/);
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(t('map.filters.someNetworks', { count: '3' }), '3 réseaux');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(t('map.filters.allNetworks'), 'All networks');
    setLanguage('fr', { persist: false, translate: false });
});
