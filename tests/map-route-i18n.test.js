import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatDate, setLanguage, t } from '../src/i18n/i18n.js';
import { locationErrorKey, routeErrorKey } from '../src/ui/map-route-ui.js';

test('le formulaire et le choix GPS utilisent des clés structurées sans traduire les marques', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const key of [
    'map.route.title', 'map.route.start', 'map.route.destination', 'map.route.myLocation',
    'map.route.showChargers', 'map.route.clear', 'map.gps.openDirections', 'map.gps.chooseApp',
    'map.gps.appOrBrowser', 'map.gps.note'
  ]) assert.match(html, new RegExp(`data-i18n="${key.replaceAll('.', '\\.')}"`));
  assert.match(html, /data-i18n-placeholder="map\.route\.addressPlaceholder"/);
  assert.match(html, /data-i18n-aria-label="map\.route\.startInputLabel"/);
  assert.match(html, /data-i18n-aria-label="map\.route\.destinationInputLabel"/);
  assert.match(html, />Plans</);
  assert.match(html, />Apple Maps</);
  assert.match(html, />Google Maps</);
  assert.match(html, />Waze</);
});

test('seul le chevron du planificateur pivote à son ouverture', async () => {
  const [html, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8')
  ]);
  assert.match(html, /<summary><span data-i18n="map\.route\.title">[^<]+<\/span> <span aria-hidden="true" class="route-planner-chevron">⌄<\/span><\/summary>/);
  assert.match(css, /\.route-planner\[open\] \.route-planner-chevron\s*\{[^}]*transform:\s*rotate\(180deg\)/);
  assert.doesNotMatch(css, /\.route-planner\[open\] summary span/);
});

test('le bouton de fermeture GPS reste accessible et ancré en haut à droite', async () => {
  const [html, css, app, modalManager] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/ui/modal-manager.js', import.meta.url), 'utf8')
  ]);
  const modal = html.slice(html.indexOf('class="help-modal route-choice-modal"'), html.indexOf('</div>\n</div>', html.indexOf('class="help-modal route-choice-modal"')));
  assert.match(modal, /<button[^>]+class="modal-close"[^>]+data-i18n-aria-label="common\.close"[^>]+id="route-choice-close"[^>]+type="button">×<\/button>/);

  const closeRule = css.slice(css.indexOf('.route-choice-modal .modal-close {'), css.indexOf('}', css.indexOf('.route-choice-modal .modal-close {')));
  assert.match(css, /\.route-choice-modal \{[\s\S]*?position:\s*relative/);
  assert.match(closeRule, /position:\s*absolute/);
  assert.match(closeRule, /top:\s*max\(16px, env\(safe-area-inset-top\)\)/);
  assert.match(closeRule, /right:\s*max\(16px, env\(safe-area-inset-right\)\)/);
  assert.match(closeRule, /width:\s*48px/);
  assert.match(closeRule, /height:\s*48px/);
  assert.match(closeRule, /min-width:\s*44px/);
  assert.match(closeRule, /min-height:\s*44px/);
  assert.match(closeRule, /font-size:\s*26px/);
  assert.match(css, /\.route-choice-modal > \.profile-page-kicker,[\s\S]*?\.route-choice-modal > h2 \{[\s\S]*?padding-right:\s*64px/);
  assert.match(css, /\.route-choice-modal \.modal-close:focus-visible \{[\s\S]*?outline:/);

  assert.match(app, /\{ overlayId: 'route-choice-overlay', closeId: 'route-choice-close' \}/);
  assert.match(modalManager, /closeButton\?\.addEventListener\('click', \(\) => closeModal\(overlayId\)\)/);
  assert.match(modalManager, /event\.key === 'Escape'[\s\S]*?closeModal\(activeModal\.id\)/);
  assert.match(modalManager, /const focusable = getFocusable\(activeModal\)/);
  assert.match(modalManager, /previousFocus\.focus\(\)/);

  setLanguage('fr', { persist: false, translate: false });
  assert.equal(t('common.close'), 'Fermer');
  setLanguage('en', { persist: false, translate: false });
  assert.equal(t('common.close'), 'Close');
});

test('localise le formulaire, les états courants, la liste et le choix GPS en FR et EN', () => {
  setLanguage('fr', { persist: false, translate: false });
  assert.equal(t('map.route.title'), 'Stations sur mon trajet');
  assert.equal(t('map.route.start'), 'Départ');
  assert.equal(t('map.route.destination'), 'Arrivée');
  assert.equal(t('map.route.currentLocation'), 'Ma position actuelle');
  assert.equal(t('map.route.searchingAddresses'), 'Recherche des adresses…');
  assert.equal(t('map.route.calculating'), 'Calcul de l’itinéraire…');
  assert.equal(t('map.list.route'), 'Stations sur votre trajet');
  assert.equal(t('map.gps.chooseApp'), 'Choisir une application de navigation');

  setLanguage('en', { persist: false, translate: false });
  assert.equal(t('map.route.title'), 'Chargers along my route');
  assert.equal(t('map.route.start'), 'Start');
  assert.equal(t('map.route.destination'), 'Destination');
  assert.equal(t('map.route.currentLocation'), 'My current location');
  assert.equal(t('map.route.searchingAddresses'), 'Searching for addresses…');
  assert.equal(t('map.route.calculating'), 'Calculating route…');
  assert.equal(t('map.list.route'), 'Chargers along your route');
  assert.equal(t('map.gps.chooseApp'), 'Choose a navigation app');
  assert.equal(t('map.gps.openWith', { app: 'Waze' }), 'Open directions with Waze');
});

test('convertit chaque famille d’erreur d’itinéraire en clé stable', () => {
  assert.equal(routeErrorKey({ networkError: true }), 'map.route.networkError');
  assert.equal(routeErrorKey({ responseValid: false }), 'map.route.invalidResponse');
  assert.equal(routeErrorKey({ message: 'Adresse introuvable : Paris.', start: 'Paris', destination: 'Lyon' }), 'map.route.startNotFound');
  assert.equal(routeErrorKey({ message: 'Adresse introuvable : Lyon.', start: 'Paris', destination: 'Lyon' }), 'map.route.destinationNotFound');
  assert.equal(routeErrorKey({ message: 'Aucun itinéraire routier trouvé. Vérifiez les lieux reconnus.' }), 'map.route.notFound');
  assert.equal(routeErrorKey({ message: 'Le calcul d’itinéraire n’est pas encore configuré' }), 'map.route.unavailable');
  assert.equal(routeErrorKey({ message: 'message technique inattendu' }), 'map.route.unavailable');
});

test('localise les erreurs sans exposer les messages techniques internes', () => {
  setLanguage('en', { persist: false, translate: false });
  for (const key of [
    'map.route.startNotFound', 'map.route.destinationNotFound', 'map.route.unavailable',
    'map.route.notFound', 'map.route.invalidResponse', 'map.route.noMatchingStations', 'map.route.networkError'
  ]) {
    assert.notEqual(t(key), key);
    assert.doesNotMatch(t(key), /Adresse|itinéraire|Réponse|Aucune station|connexion/i);
  }
});

test('distingue les résultats de géolocalisation sans modifier ses paramètres techniques', async () => {
  assert.equal(locationErrorKey({ code: 1 }), 'map.location.denied');
  assert.equal(locationErrorKey({ code: 2 }), 'map.location.unavailable');
  assert.equal(locationErrorKey({ code: 3 }), 'map.location.timeout');
  assert.equal(locationErrorKey({ code: 0 }), 'map.location.notFound');
  const source = await readFile(new URL('../src/ui/stations-map.js', import.meta.url), 'utf8');
  assert.match(source, /enableHighAccuracy: true, timeout: 10000, maximumAge: 60000/);
  assert.match(source, /map\.location\.yourPosition/);
  assert.match(source, /locationButtonState = 'recenter'/);
});

test('la bascule de langue conserve les états et reformate la date IRVE sans requête', async () => {
  const source = await readFile(new URL('../src/ui/stations-map.js', import.meta.url), 'utf8');
  const refresh = source.slice(source.indexOf('refreshLanguage()'), source.indexOf('activate()', source.indexOf('refreshLanguage()')));
  assert.match(refresh, /routeUiState\.key/);
  assert.match(refresh, /currentLocationIsRouteStart/);
  assert.match(refresh, /formatDate\(irveUpdatedAt\)/);
  assert.match(refresh, /setPopupContent/);
  assert.match(refresh, /renderRouteChoice\(\)/);
  assert.doesNotMatch(refresh, /fetch|load\(|searchRoute|locateUser|setView|panTo|fitBounds/);
  setLanguage('fr', { persist: false, translate: false });
  assert.equal(formatDate('2026-08-06'), '6 août 2026');
  setLanguage('en', { persist: false, translate: false });
  assert.equal(formatDate('2026-08-06'), '6 August 2026');
});
