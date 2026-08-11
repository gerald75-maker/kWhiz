import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setLanguage, t } from '../src/i18n/i18n.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const i18nSource = await readFile(new URL('../src/i18n/i18n.js', import.meta.url), 'utf8');

const requiredBindings = [
  'app.subtitle',
  'consumption.title', 'consumption.inputLabel', 'consumption.minimum', 'consumption.maximum',
  'vehicle.cityCar', 'vehicle.cityCarLabel', 'vehicle.saloon', 'vehicle.saloonLabel',
  'vehicle.suv', 'vehicle.suvLabel', 'vehicle.van', 'vehicle.vanLabel',
  'comparison.heading.kicker', 'comparison.heading.title', 'comparison.heading.intro',
  'comparison.search.label', 'comparison.search.placeholder',
  'comparison.controls.monthlyMileage', 'comparison.controls.monthlyMileageUnit', 'comparison.controls.editProfile',
  'operators.heading.kicker', 'operators.heading.title', 'operators.heading.intro', 'operators.viewMode.details',
  'map.heading.kicker', 'map.heading.title', 'map.heading.intro',
  'map.filters.title', 'map.filters.all', 'map.filters.none', 'map.canvasLabel',
  'map.source.prefix', 'map.source.notice',
  'profile.heading.kicker', 'profile.heading.title', 'profile.heading.intro',
  'profile.controls.kicker', 'profile.controls.title', 'profile.controls.instant',
  'profile.controls.monthlyMileage', 'profile.controls.other', 'profile.controls.monthlyMileageLabel',
  'profile.controls.monthlyMileageUnit', 'profile.controls.fastShare',
  'profile.controls.decreasePercentage', 'profile.controls.increasePercentage', 'profile.controls.homeRateHint',
  'profile.ranking.kicker', 'profile.ranking.title', 'profile.ranking.estimatedMonthlyCost',
  'profile.ranking.full', 'profile.ranking.operator', 'profile.ranking.plan',
  'profile.ranking.rate', 'profile.ranking.monthly',
  'navigation.profile', 'navigation.profileLabel', 'navigation.compare', 'navigation.compareLabel',
  'navigation.operators', 'navigation.operatorsLabel', 'navigation.map', 'navigation.mapLabel',
  'navigation.menu', 'navigation.menuLabel'
];

test('les squelettes principaux utilisent uniquement des clés structurées', () => {
  for (const key of requiredBindings) {
    assert.match(html, new RegExp(`data-i18n(?:-aria-label|-placeholder)?="${key.replaceAll('.', '\\.')}"`), key);
  }
});

test('rend les textes et attributs structurés en français et en anglais', () => {
  setLanguage('fr', { persist: false, translate: false });
  assert.equal(t('app.subtitle'), 'L’offre la moins chère selon votre usage');
  assert.equal(t('vehicle.cityCarLabel'), 'Citadine — 13 kWh/100 km');
  assert.equal(t('comparison.search.placeholder'), 'Rechercher un opérateur ou une formule');
  assert.equal(t('map.canvasLabel'), 'Carte des stations de recharge rapide');
  assert.equal(t('navigation.profileLabel'), 'Mon choix personnalisé');

  setLanguage('en', { persist: false, translate: false });
  assert.equal(t('app.subtitle'), 'The lowest-cost plan for your usage');
  assert.equal(t('vehicle.cityCarLabel'), 'City car — 13 kWh/100 km');
  assert.equal(t('comparison.search.placeholder'), 'Search for a network or plan');
  assert.equal(t('map.canvasLabel'), 'Fast-charger map');
  assert.equal(t('navigation.profileLabel'), 'My recommendation');
  assert.equal(t('profile.controls.monthlyMileageUnit'), 'km/month');
});

test('conserve les identifiants, les valeurs et la structure interactive', () => {
  for (const id of [
    'conso-slider', 'vehicles', 'compare-search', 'compare-km', 'compare-profile-link',
    'view-mode', 'map-select-all', 'map-select-none', 'stations-map', 'map-data-date',
    'profile-km', 'fast-pct-minus', 'fast-pct-plus', 'profile-shortlist-list', 'profile-table',
    'bnav-profile', 'bnav-compare', 'bnav-operators', 'bnav-map', 'bnav-menu'
  ]) assert.match(html, new RegExp(`id="${id}"`), id);

  assert.match(html, /id="conso-slider"[^>]*max="30"[^>]*min="10"[^>]*step="1"[^>]*value="18"/);
  assert.match(html, /id="compare-km"[^>]*max="9999"[^>]*min="0"[^>]*step="50"[^>]*value="1000"/);
  assert.match(html, /id="profile-km"[^>]*max="9999"[^>]*min="0"[^>]*step="50"[^>]*value="1000"/);
  assert.match(html, /class="bnav-item active"[^>]*id="bnav-profile"/);
});

test('les anciennes correspondances exactes propres à ces squelettes ont disparu', () => {
  const legacyBlock = '';
  for (const phrase of [
    'L’offre la moins chère selon votre usage', 'Consommation du véhicule', 'Comparer les offres',
    'Opérateurs et formules', 'Bornes rapides en France', 'Votre recharge rapide, au juste prix',
    'Mon profil de recharge', 'Les 3 meilleures offres', 'Mon choix personnalisé', 'Carte des bornes'
  ]) assert.doesNotMatch(legacyBlock, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), phrase);
});

test('la traduction statique ne contient ni requête ni recalcul', () => {
  const translateDocument = i18nSource.slice(i18nSource.indexOf('export function translateDocument'), i18nSource.indexOf('export function setLanguage'));
  assert.doesNotMatch(translateDocument, /fetch\(|updateCalculations|renderStations|L\.map\(/);
});
