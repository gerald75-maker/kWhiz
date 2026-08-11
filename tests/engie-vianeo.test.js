import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { calculateBreakeven, computeProfileMonthlyCost } from '../src/domain/pricing.js';
import { localizeCommercialLabel, localizeNetworkDescription, localizeTariffText, setLanguage } from '../src/i18n/i18n.js';
import { formulaFavoriteId, toggleFavorite } from '../src/ui/favorites.js';
import { createUserDataBackup, restoreUserDataBackup } from '../src/ui/data-backup.js';

const root = new URL('../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('public/tarifs.json', root), 'utf8'));
const operator = catalog['engie-vianeo'];

test('ENGIE Vianeo expose exactement trois formules permanentes', () => {
  assert.equal(operator.name, 'ENGIE Vianeo');
  assert.equal(operator.formulas.length, 3);
  assert.deepEqual(operator.formulas.map(plan => plan.id), [
    'engie-vianeo-max', 'engie-vianeo-app', 'engie-vianeo-bank-card'
  ]);
  assert.equal(operator.formulas.some(plan => /Happy Hours/i.test(plan.name)), false);
});

test('Vianeo Max calcule le prix, la mensualisation et les seuils exacts', () => {
  const max = operator.formulas[0];
  const result = calculateBreakeven(max, 0.18);
  assert.equal(result.monthlyCost, 9.99);
  assert.ok(Math.abs(result.kwh - (9.99 / (0.54 - 0.33))) < 1e-12);
  assert.ok(Math.abs(result.km - (9.99 / (0.54 - 0.33) / 0.18)) < 1e-12);
  assert.ok(Math.abs(computeProfileMonthlyCost({ ...max, monthlyCost: result.monthlyCost }, 1000, 0.18) - 69.39) < 1e-12);
  const versusCard = calculateBreakeven({ ...max, ref: 0.60 }, 0.18);
  assert.ok(Math.abs(versusCard.km - (9.99 / (0.60 - 0.33) / 0.18)) < 1e-12);
});

test('les tarifs sans abonnement restent variables et explicitement minimaux', () => {
  for (const plan of operator.formulas.slice(1)) {
    assert.equal(plan.period, 'none');
    assert.equal(plan.pricingType, 'station');
    assert.equal(plan.calculationBasis, 'estimate');
    assert.equal(plan.isMinimum, true);
    assert.match(plan.note, /À partir de/);
    assert.match(plan.note, /frais à la minute/);
  }
  assert.match(operator.formulas[0].note, /frais à la minute/);
  assert.match(operator.formulas[1].note, /50 %/);
});

test('les libellés et notes Vianeo basculent en anglais puis reviennent en français', () => {
  setLanguage('en', { persist: false, translate: false });
  assert.equal(localizeCommercialLabel(operator.formulas[1].name), 'ENGIE Vianeo app — no subscription');
  assert.equal(localizeNetworkDescription(operator.badge), 'Ultra-fast DC charging from 300 to 400 kW depending on the site');
  assert.match(localizeTariffText(operator.formulas[1].note), /^From €0\.54\/kWh/);
  setLanguage('fr', { persist: false, translate: false });
  assert.equal(localizeCommercialLabel(operator.formulas[1].name), operator.formulas[1].name);
});

test('le logo officiel est local et les stations Vianeo alimentent carte et trajet', async () => {
  await access(new URL('public/logos/source/ENGIE_VIANEO_Logo_RGB.svg', root));
  await access(new URL('public/logos/engie-vianeo.webp', root));
  const payload = JSON.parse(await readFile(new URL('public/irve-fast.json', root), 'utf8'));
  const stations = payload.stations.filter(station => station.operator === 'engie-vianeo');
  assert.equal(stations.length, 181);
  assert.equal(stations.reduce((sum, station) => sum + station.connectors, 0), 1403);
  assert.ok(stations.every(station => station.power >= 100));
  assert.ok(stations.every(station => station.lat >= 41 && station.lat <= 52 && station.lon >= -6 && station.lon <= 10.5));
  const mapSource = await readFile(new URL('src/ui/stations-map.js', root), 'utf8');
  assert.match(mapSource, /'engie-vianeo': 'ENGIE Vianeo'/);
  assert.match(mapSource, /'engie-vianeo': '#008bd2'/);
  assert.match(mapSource, /selected\.has\(station\.operator\).*routeStationMetrics/);
});

test('le logo optimisé est ajouté au précache hors ligne', async () => {
  const injector = await readFile(new URL('scripts/inject-build-vars.mjs', root), 'utf8');
  assert.match(injector, /\.\/logos\/engie-vianeo\.webp/);
});

test('la règle IRVE exige Vianeo et protège ENGIE, ESSO et CERTAS', async () => {
  const networks = await readFile(new URL('scripts/irve-networks.mjs', root), 'utf8');
  assert.match(networks, /engie-vianeo.*engie\\s\+\)\?vianeo/);
  assert.doesNotMatch(networks, /\['engie-vianeo',\s*\/\\bengie\\b\//);
  assert.doesNotMatch(networks, /\['engie-vianeo',[^\n]*(?:esso|certas)/i);
  const audit = await readFile(new URL('docs/vianeo-irve-audit-2026-08-11.md', root), 'utf8');
  assert.match(audit, /Esso Arnage.*C4Energies/);
  assert.match(audit, /ENGIE PACA.*Greenspot/);
});

test('favoris et sauvegarde restaurent un choix Vianeo sans casser les anciens formats', () => {
  const favorite = formulaFavoriteId('engie-vianeo', operator.formulas[0].name);
  const favorites = toggleFavorite(new Set(), favorite);
  const values = new Map([['favorites', JSON.stringify([...favorites])], ['theme', 'dark']]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  const backup = createUserDataBackup(storage, ['favorites', 'theme'], new Date('2026-08-11T12:00:00Z'));
  values.set('favorites', '[]');
  assert.equal(restoreUserDataBackup(storage, backup, ['favorites', 'theme']), 2);
  assert.deepEqual(JSON.parse(values.get('favorites')), [favorite]);
});
