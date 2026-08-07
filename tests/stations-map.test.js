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

test('les logos remplacent les points quand la carte couvre environ 400 km', async () => {
  const source = await readFile(new URL('src/ui/stations-map.js', root), 'utf8');
  assert.match(source, /LOGO_DISTANCE_THRESHOLD_METERS = 450000/);
  assert.match(source, /visibleWidth <= LOGO_DISTANCE_THRESHOLD_METERS/);
  assert.match(source, /L\.divIcon/);
  assert.match(source, /showOperatorLogos \|\| selected/);
});

test('la vue Carte compacte son en-tête pour laisser apparaître la liste', async () => {
  const css = await readFile(new URL('styles.css', root), 'utf8');
  assert.match(css, /body\[data-view="map"\] > \.container > \.app-title/);
  assert.match(css, /\.stations-map \{ height:48dvh; min-height:360px; max-height:460px/);
  assert.match(css, /\.map-nearby \{ margin-top:12px/);
});

test('la carte reste fixe pendant que la liste des stations défile dessous', async () => {
  const css = await readFile(new URL('styles.css', root), 'utf8');
  assert.match(css, /\.stations-map \{ position:sticky; top:max\(8px, env\(safe-area-inset-top\)\)/);
  assert.match(css, /z-index:100; box-shadow:/);
});

test('les points et les logos sélectionnent directement leur fiche dans la liste', async () => {
  const source = await readFile(new URL('src/ui/stations-map.js', root), 'utf8');
  assert.match(source, /marker\.on\('click', \(\) => selectStation\(station\.id, \{ centerMap: false \}\)\)/);
  assert.ok((source.match(/bubblingMouseEvents: false/g) || []).length >= 2);
});

test('les statuts dynamiques restent indicatifs, récents et non bloquants', async () => {
  const [source, php, html, index] = await Promise.all([
    readFile(new URL('src/ui/stations-map.js', root), 'utf8'),
    readFile(new URL('public/status.php', root), 'utf8'),
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('public/irve-status-index.json', root), 'utf8')
  ]);
  assert.match(source, /fetch\('\.\/status\.php'/);
  assert.match(source, /Statut inconnu/);
  assert.match(php, /FRESH_SECONDS = 900/);
  assert.match(php, /CACHE_SECONDS = 120/);
  assert.match(php, /\$latestPoints\[\$pointId\]/);
  assert.match(html, /date de moins de 15 minutes/);
  assert.ok(Object.keys(JSON.parse(index).pointToStation).length > 10000);
});

test('la carte attend la localisation avant de dessiner les stations', async () => {
  const source = await readFile(new URL('src/ui/stations-map.js', root), 'utf8');
  assert.match(source, /if \(!map \|\| !mapPositionReady\) return/);
  assert.match(source, /locateUser\(\{ automatic: true \}\)/);
  assert.match(source, /map\.setView\(coordinates, automatic \? 9/);
});

test('Recentrer réutilise immédiatement la position connue sans nouvel appel GPS', async () => {
  const source = await readFile(new URL('src/ui/stations-map.js', root), 'utf8');
  assert.match(source, /let userCoordinates = null/);
  assert.match(source, /if \(userCoordinates && locationMarker\)/);
  assert.match(source, /map\.setView\(userCoordinates, Math\.max\(map\.getZoom\(\), 10\)/);
  assert.match(source, /if \(locationPending\) return/);
});

test('Stations sur mon trajet reste un MVP isolé et filtrable par opérateur', async () => {
  const [html, source, css, php] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('src/ui/stations-map.js', root), 'utf8'),
    readFile(new URL('styles.css', root), 'utf8'),
    readFile(new URL('public/route.php', root), 'utf8')
  ]);
  assert.match(html, /id="route-planner-form"/);
  assert.match(html, /Stations sur mon trajet/);
  assert.match(html, /id="route-use-location"/);
  assert.match(source, /fetch\('\.\/route\.php'/);
  assert.match(source, /metric\.distance <= 15/);
  assert.match(source, /startCoordinates:/);
  assert.match(source, /input\.value = 'Ma position actuelle'/);
  assert.match(source, /selected\.has\(station\.operator\).*routeStationMetrics/);
  assert.match(source, /routeStationMetrics\.get\(a\.id\)\.progress/);
  assert.match(source, /if \(!routeStationMetrics\)/);
  assert.match(css, /\.route-planner/);
  assert.match(css, /\.route-planner-form input \{ font-size:16px; \}/);
  assert.match(php, /OPENROUTESERVICE_API_KEY/);
  assert.match(php, /\$validProvidedStart/);
  assert.match(php, /\$startCacheValue = \$validProvidedStart/);
  assert.doesNotMatch(source, /openrouteservice.*api[_-]?key/i);
});

test('le géocodage des itinéraires est limité à la France', async () => {
  const php = await readFile(new URL('public/route.php', root), 'utf8');
  const geocode = php.slice(php.indexOf('function geocode'), php.indexOf("if ($_SERVER['REQUEST_METHOD']"));
  assert.match(geocode, /'boundary\.country'\s*=>\s*'FR'/);
  assert.match(geocode, /Précisez une adresse française ou un code postal/);
  assert.match(geocode, /'coordinates'\s*=>\s*\[\(float\) \$coordinates\[0\], \(float\) \$coordinates\[1\]\]/);
});

test('Bayonne est conservée en longitude, latitude près du Pays basque français', async () => {
  const php = await readFile(new URL('public/route.php', root), 'utf8');
  const orsBayonneFeature = {
    geometry: { coordinates: [-1.4748, 43.4929] }
  };
  const [longitude, latitude] = orsBayonneFeature.geometry.coordinates;

  assert.ok(Math.abs(longitude - (-1.47)) < 0.02);
  assert.ok(Math.abs(latitude - 43.49) < 0.02);
  assert.match(php, /'coordinates'\s*=>\s*\[\$startCoordinates, \$endCoordinates\]/);
  assert.match(php, /'start'\s*=>\s*\$startCoordinates/);
  assert.match(php, /'end'\s*=>\s*\$endCoordinates/);
});

test('le formulaire précise la saisie française et affiche les lieux reconnus', async () => {
  const [html, source, php] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('src/ui/stations-map.js', root), 'utf8'),
    readFile(new URL('public/route.php', root), 'utf8')
  ]);
  assert.equal((html.match(/placeholder="Ville, adresse ou code postal en France"/g) || []).length, 2);
  assert.match(php, /'recognizedStart'\s*=>\s*\$startPlace\['label'\]/);
  assert.match(php, /'recognizedEnd'\s*=>\s*\$endPlace\['label'\]/);
  assert.match(source, /payload\.recognizedStart \|\| start/);
  assert.match(source, /payload\.recognizedEnd \|\| end/);
});

test('les erreurs d’itinéraire donnent une action corrective', async () => {
  const [source, php] = await Promise.all([
    readFile(new URL('src/ui/stations-map.js', root), 'utf8'),
    readFile(new URL('public/route.php', root), 'utf8')
  ]);
  assert.match(php, /Précisez une adresse française ou un code postal/);
  assert.match(php, /Aucun itinéraire routier trouvé\. Vérifiez les lieux reconnus/);
  assert.match(php, /Service d’itinéraire indisponible\. Réessayez dans quelques instants/);
  assert.match(source, /Vérifiez les réglages de localisation de votre navigateur/);
});

test('l’aide en accordéons couvre localisation, statuts, sélection et itinéraire', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const help = html.slice(html.indexOf('id="page-aide"'), html.indexOf('id="page-infos"'));
  for (const title of ['Bien démarrer', 'Comprendre les résultats', 'Utiliser la carte', 'Stations sur mon trajet', 'Questions fréquentes']) {
    assert.match(help, new RegExp(`<summary>${title}`));
  }
  const mapHelp = help.slice(help.indexOf('<summary>Utiliser la carte'), help.indexOf('</details>', help.indexOf('<summary>Utiliser la carte')));
  assert.match(mapHelp, /première ouverture/);
  assert.match(mapHelp, /vert/);
  assert.match(mapHelp, /point, un logo ou une fiche/);
  assert.match(mapHelp, /Google Maps ou Waze/);
  assert.match(help, /OpenRouteService/);
  assert.match(help, /repère les stations sur un trajet, mais ne calcule pas les arrêts selon la batterie/);
  assert.match(help, /Sélectionnez les opérateurs/);
  assert.match(help, /ne tient compte ni de l’autonomie, ni du niveau de batterie/);
  assert.match(help, /ouvre le guidage vers une seule station/);
});

test('les notes bleues de l’aide ont la taille et le contraste de la liste ordonnée', async () => {
  const css = await readFile(new URL('styles.css', root), 'utf8');
  const noteStyles = css.slice(css.indexOf('.help-note {'), css.indexOf('}', css.indexOf('.help-note {')));
  assert.match(noteStyles, /font-size: 0\.82rem/);
  assert.match(noteStyles, /color: var\(--text-secondary\)/);
  assert.match(noteStyles, /line-height: 1\.5/);
});
