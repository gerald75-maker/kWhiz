import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  detectInitialLanguage,
  formatCurrency,
  formatDate,
  formatDistance,
  formatNumber,
  getLanguage,
  plural,
  setLanguage,
  t
} from '../src/i18n/i18n.js';
import { buildShareText } from '../src/ui/share-result.js';

test('utilise le français par défaut et détecte un appareil anglais', () => {
  assert.equal(detectInitialLanguage({ deviceLanguage: 'fr-CA' }), 'fr');
  assert.equal(detectInitialLanguage({ deviceLanguage: 'en-US' }), 'en');
  assert.equal(detectInitialLanguage({ deviceLanguage: 'EN-gb' }), 'en');
});

test('le choix mémorisé prime sur la langue de l’appareil', () => {
  assert.equal(detectInitialLanguage({ storedLanguage: 'fr', deviceLanguage: 'en-US' }), 'fr');
  assert.equal(detectInitialLanguage({ storedLanguage: 'en', deviceLanguage: 'fr-FR' }), 'en');
});

test('mémorise le choix et bascule sans rechargement', () => {
  const values = new Map();
  const storage = { setItem: (key, value) => values.set(key, value) };
  assert.equal(setLanguage('en', { storage, translate: false }), true);
  assert.equal(getLanguage(), 'en');
  assert.equal(values.get('kwhiz_language'), 'en');
  assert.equal(t('nav.recommendation'), 'My recommendation');
  assert.equal(setLanguage('fr', { storage, translate: false }), true);
  assert.equal(t('nav.recommendation'), 'Mon choix');
});

test('adapte nombres, dates, distances, devises et pluriels avec Intl', () => {
  setLanguage('en', { persist: false, translate: false });
  assert.equal(formatNumber(1234.5, { minimumFractionDigits: 1 }), '1,234.5');
  assert.match(formatCurrency(4.99), /€4\.99/);
  assert.equal(formatDate('2026-08-06'), '6 August 2026');
  assert.match(formatDistance(12.5), /12\.5 km/);
  assert.equal(plural('count.station', 1), '1 charger');
  assert.equal(plural('count.station', 2), '2 chargers');
  setLanguage('fr', { persist: false, translate: false });
  assert.equal(formatDate('2026-08-06'), '6 août 2026');
});

test('traduit aussi un contenu généré par JavaScript', () => {
  setLanguage('en', { persist: false, translate: false });
  const text = buildShareText({ operator: 'IONITY', formula: 'Power', monthlyCost: 42.5, annualCost: 510, km: 1200, fastPercentage: 80 });
  assert.match(text, /^My kWhiz recommendation:/);
  assert.match(text, /1,200 km\/month/);
  assert.doesNotMatch(text, /Mon choix|par an|recharge rapide/);
  setLanguage('fr', { persist: false, translate: false });
});

test('le document expose le sélecteur et aucune clé brute comme texte', async () => {
  const [html, source] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/i18n/i18n.js', import.meta.url), 'utf8')
  ]);
  assert.match(html, /data-language="fr"/);
  assert.match(html, /data-language="en"/);
  assert.doesNotMatch(html, />\s*(?:nav|settings|map|common)\.[a-z.]+\s*</);
  assert.match(source, /document\.documentElement\.lang = currentLanguage/);
  const switchSource = source.slice(source.indexOf('export function setLanguage'), source.indexOf('export function onLanguageChange'));
  assert.doesNotMatch(switchSource, /reload|location/);
});

test('retire exactement le premier groupe de phrases legacy sans perdre les clés structurées', async () => {
  const source = await readFile(new URL('../src/i18n/i18n.js', import.meta.url), 'utf8');
  const legacy = source.slice(source.indexOf('const phrases = {'), source.indexOf('\n};', source.indexOf('const phrases = {')));
  const removed = [
    'Connexion indisponible — derniers tarifs enregistrés', 'Prix du kWh', 'Analyse…',
    'Choisir votre GPS', 'Coût', 'Source officielle', 'Vérifié le', 'Seuil de rentabilité',
    'Calcul de l’itinéraire…', 'Itinéraire indisponible', 'Stations sur votre trajet',
    'Localisation indisponible', 'Localisation…', 'Position introuvable',
    'La position actuelle sera utilisée comme départ.',
    'La localisation n’est pas disponible sur cet appareil.',
    'Localisation refusée ou indisponible. Vérifiez les réglages de localisation de votre navigateur.',
    'Afficher sur la carte', 'libre', 'occupé', 'hors service', 'statut inconnu'
  ];
  for (const phrase of removed) assert.doesNotMatch(legacy, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), phrase);
  assert.equal((legacy.match(/'[^']*'\s*:/g) || []).length, 39);

  setLanguage('fr', { persist: false, translate: false });
  for (const key of [
    'map.route.calculating', 'map.route.unavailable', 'map.list.route',
    'map.location.loading', 'map.location.notFound', 'map.location.usedAsStart',
    'map.station.showOnMap', 'map.status.available', 'map.status.outOfService',
    'offerDetail.noBreakEven', 'offerDetail.notProfitable', 'tariffs.verifiedOn'
  ]) assert.notEqual(t(key), key, key);
});

test('le service worker inclut le bundle i18n dans les assets générés', async () => {
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /const CRITICAL_ASSETS = __CRITICAL_ASSETS__/);
  assert.match(sw, /nouveau SW reste en état 'waiting'/);
});

test('précise le périmètre des réseaux présents en France en FR et EN', async () => {
  const [html, manifest] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/manifest.json', import.meta.url), 'utf8').then(JSON.parse)
  ]);
  const frenchScope = 'Comparez les tarifs et abonnements des principaux réseaux de recharge rapide présents en France.';
  const frenchAbout = 'kWhiz est conçu pour comparer une sélection de réseaux de recharge rapide présents en France. L’application ne prétend pas couvrir tous les opérateurs ni les tarifs proposés dans les autres pays.';
  assert.equal((html.match(new RegExp(frenchScope.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 2);
  assert.match(html, new RegExp(frenchAbout.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(manifest.description, frenchScope);
  assert.doesNotMatch(html, /opérateurs français/i);

  setLanguage('en', { persist: false, translate: false });
  assert.equal(t('app.description'), 'Compare prices and subscriptions from major fast-charging networks operating in France.');
  assert.equal(t('manifest.description'), 'Compare prices and subscriptions from major fast-charging networks operating in France.');
  setLanguage('fr', { persist: false, translate: false });
});
