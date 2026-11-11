import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculateBreakeven, computeProfileMonthlyCost } from '../src/domain/pricing.js';
import { validateTariffs } from '../src/domain/tariffs-validator.js';
import { LOGOS, VALID_COLORS } from '../src/config/app-config.js';
import { IRVE_NETWORKS } from '../scripts/irve-networks.mjs';
import { localizeTariffText, localizeCommercialLabel, setLanguage } from '../src/i18n/i18n.js';

const data = JSON.parse(await readFile(new URL('../public/tarifs.json', import.meta.url), 'utf8'));
const powerdot = data.powerdot;

test('Powerdot direct conserve les tarifs DC officiels sans créer une référence sans abonnement', () => {
  const { data: catalog, errors } = validateTariffs({ powerdot }, { validColors: VALID_COLORS });
  assert.deepEqual(errors, []);
  assert.equal(catalog.powerdot.formulas.length, 2);
  assert.deepEqual(powerdot.formulas.map(({cost, rate}) => [cost, rate]), [[1.99, .52], [4.99, .41]]);
  for (const offer of powerdot.formulas) {
    assert.equal(offer.calculationBasis, 'official');
    assert.equal(offer.verifiedAt, '2026-10-08');
    assert.equal(offer.referenceUnavailable, true);
    assert.equal(calculateBreakeven(offer, .2).km, Infinity);
    assert.match(offer.note, /les recharges restent payantes/);
    assert.match(offer.note, /compte abonné/);
    assert.notEqual(localizeCommercialLabel(offer.name), undefined);
  }
});

test('le classement calcule les mensualités permanentes, sans essai gratuit ni cumul Electroverse', () => {
  const totals = powerdot.formulas.map(offer => computeProfileMonthlyCost({ ...offer, monthlyCost: offer.cost }, 1000, .2));
  assert.ok(Math.abs(totals[0] - 105.99) < 1e-9);
  assert.ok(Math.abs(totals[1] - 86.99) < 1e-9);
  assert.equal(data.electroverse.formulas.find(offer => offer.id === 'electroverse-powerdot-dc').calculationBasis, 'estimate');
});

test('Powerdot propose la carte officielle, un logo local et des textes anglais complets', async () => {
  assert.equal(powerdot.mapUrl, 'https://www.powerdot.eu/locations');
  assert.ok((await readFile(new URL('../public/logos/powerdot.webp', import.meta.url))).length > 0);
  assert.equal(LOGOS.powerdot, './logos/powerdot.webp');
  const matcher = IRVE_NETWORKS.find(([key]) => key === 'powerdot')[1];
  assert.ok(matcher.test('powerdot france'));
  assert.ok(matcher.test('power dot'));
  setLanguage('en', {persist:false, translate:false});
  for (const offer of powerdot.formulas) {
    assert.notEqual(localizeCommercialLabel(offer.name), offer.name);
    assert.notEqual(localizeTariffText(offer.note), offer.note);
  }
});
