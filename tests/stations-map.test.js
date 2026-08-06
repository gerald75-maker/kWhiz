import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('la carte propose une sélection multi-opérateurs explicite', async () => {
  const [html, navigation] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('src/ui/navigation.js', root), 'utf8')
  ]);
  assert.match(html, /id="tab-map"/);
  assert.match(html, /id="map-operator-filters"/);
  assert.match(html, /id="map-locate"/);
  assert.match(html, /Les résultats correspondent à l’un des réseaux choisis/);
  assert.match(navigation, /bnav-map/);
});

test('la vue Carte masque le slider et permet une géolocalisation volontaire', async () => {
  const [navigation, mapSource, css] = await Promise.all([
    readFile(new URL('src/ui/navigation.js', root), 'utf8'),
    readFile(new URL('src/ui/stations-map.js', root), 'utf8'),
    readFile(new URL('styles.css', root), 'utf8')
  ]);
  assert.match(navigation, /document\.body\.dataset\.view = view/);
  assert.match(css, /body\[data-view="map"\] \.sticky-top/);
  assert.match(mapSource, /navigator\.geolocation\.getCurrentPosition/);
});

test('les stations rapides officielles sont compactes et sans doublon', async () => {
  const payload = JSON.parse(await readFile(new URL('public/irve-fast.json', root), 'utf8'));
  assert.equal(payload.source, 'Base nationale IRVE — data.gouv.fr');
  assert.ok(payload.stations.length > 500);
  assert.equal(new Set(payload.stations.map(station => station.id)).size, payload.stations.length);
  assert.ok(payload.stations.every(station => station.power >= 100));
  assert.ok(payload.stations.some(station => station.operator === 'zunder'));
});

test('le service worker met à jour la base cartographique en priorité réseau', async () => {
  const sw = await readFile(new URL('public/sw.js', root), 'utf8');
  assert.match(sw, /NETWORK_FIRST_PATTERNS[^;]+irve-fast\.json/);
});

test('la carte partage un seul renderer pour préserver la mémoire de Safari', async () => {
  const source = await readFile(new URL('src/ui/stations-map.js', root), 'utf8');
  assert.equal((source.match(/L\.canvas\(/g) || []).length, 1);
  assert.match(source, /renderer: markerRenderer/);
});

test('l’aide explique la carte, la localisation et la fraîcheur des bornes', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /Utiliser la carte/);
  assert.match(html, /vos coordonnées ne sont pas transmises à kWhiz/);
  assert.match(html, /pas leur disponibilité en temps réel/);
});

test('la FAQ utilise des accordéons indépendants', async () => {
  const [html, navigation] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('src/ui/navigation.js', root), 'utf8')
  ]);
  assert.ok((html.match(/<details>/g) || []).length >= 10);
  assert.doesNotMatch(navigation, /#help-faq details\[open\]/);
});

test('la navigation suit le parcours Mon choix, Comparer, Opérateurs, Carte, Menu', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const navigation = html.slice(html.indexOf('<nav class="bottom-nav"'), html.indexOf('</nav>', html.indexOf('<nav class="bottom-nav"')));
  const ids = ['bnav-profile', 'bnav-compare', 'bnav-operators', 'bnav-map', 'bnav-menu'];
  assert.deepEqual([...navigation.matchAll(/id="(bnav-[^"]+)"/g)].map(match => match[1]), ids);
});

test('les parcours de l’aide sont de vraies listes ordonnées', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.equal((html.match(/<ol class="help-ordered-list">/g) || []).length, 2);
  assert.doesNotMatch(html.slice(html.indexOf('id="page-aide"'), html.indexOf('id="page-infos"')), /class="help-num"/);
});

test('un itinéraire propose Plans, Google Maps et Waze', async () => {
  const [html, source] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('src/ui/stations-map.js', root), 'utf8')
  ]);
  assert.match(html, /Choisir votre GPS/);
  assert.match(source, /maps\.apple\.com/);
  assert.match(source, /google\.com\/maps\/dir/);
  assert.match(source, /waze\.com\/ul/);
  assert.doesNotMatch(source, /<a href="https:\/\/www\.google\.com\/maps\/dir/);
});

test('une station de la liste sélectionne et centre son marqueur', async () => {
  const source = await readFile(new URL('src/ui/stations-map.js', root), 'utf8');
  assert.match(source, /data-station-id=/);
  assert.match(source, /map\.panTo\(\[station\.lat, station\.lon\]\)/);
  assert.match(source, /markersById\.get\(selectedStationId\)\?\.openPopup\(\)/);
  assert.match(source, /is-selected/);
});

test('un appui sur la carte sélectionne la station dans une zone tactile élargie', async () => {
  const source = await readFile(new URL('src/ui/stations-map.js', root), 'utf8');
  const selection = source.slice(source.indexOf('function selectStation'), source.indexOf('function renderFilters'));
  assert.match(source, /map\.on\('click'/);
  assert.match(source, /nearestDistance = 29/);
  assert.match(source, /tolerance: 12/);
  assert.match(source, /selected \? 15 : 10/);
  assert.match(selection, /marker\.setRadius/);
  assert.match(selection, /renderList\(visibleStations\(\)\)/);
  assert.doesNotMatch(selection, /renderStations\(\)/);
});
