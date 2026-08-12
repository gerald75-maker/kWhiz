import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { localizeTariffText, setLanguage } from '../src/i18n/i18n.js';

const tariffs = JSON.parse(await readFile(new URL('../public/tarifs.json', import.meta.url), 'utf8'));
const electra = tariffs.electra;
const byId = new Map(electra.formulas.map(formula => [formula.id ?? formula.name, formula]));

test('Electra conserve six formules et les tarifs français vérifiés', () => {
  assert.equal(electra.formulas.length, 6);
  const app = byId.get('Application Electra - prix variable');
  const direct = byId.get('Paiement par badge ou carte');
  assert.deepEqual([app.rateMin, app.rateMax, app.rate, app.calculationBasis], [0.39, 0.61, 0.5, 'midpoint']);
  assert.match(app.note, /station, l’heure et l’affluence/);
  assert.match(app.note, /prix exact est affiché dans l’application Electra avant la recharge/);
  assert.deepEqual([direct.rate, direct.ref, direct.pricingType, direct.calculationBasis], [0.64, 0.64, 'station', 'estimate']);
  assert.equal(app.verifiedAt, '2026-08-12');
  assert.equal(direct.verifiedAt, '2026-08-12');
});

test('Essential et Smart appliquent uniquement leurs remises Electra au calcul', () => {
  for (const id of ['electra-essential', 'electra-essential-annual']) {
    const formula = byId.get(id);
    assert.equal(formula.discountPerKwh, 0.1);
    assert.equal(formula.rate, formula.ref - formula.discountPerKwh);
  }
  for (const id of ['electra-smart', 'electra-smart-annual']) {
    const formula = byId.get(id);
    assert.equal(formula.discountPerKwh, 0.2);
    assert.equal(formula.rate, formula.ref - formula.discountPerKwh);
    assert.notEqual(formula.rate, 0.49);
    assert.match(formula.note, /0,49 €\/kWh.*Atlante, Fastned et IONITY/);
  }
});

test('les montants annuels historiques ne sont pas présentés comme revérifiés', () => {
  assert.deepEqual([byId.get('electra-essential-annual').cost, byId.get('electra-smart-annual').cost], [19.99, 49.99]);
  assert.equal(byId.get('electra-essential-annual').verifiedAt, '2026-07-27');
  assert.equal(byId.get('electra-smart-annual').verifiedAt, '2026-07-27');
  assert.equal(electra.verifiedAt, '2026-07-27');
  assert.match(byId.get('electra-essential-annual').note, /valeur historique non revérifiée/);
});

test('les notes Electra contrôlées sont entièrement localisées en anglais', () => {
  setLanguage('en', { persist: false, translate: false });
  for (const formula of electra.formulas) {
    const localized = localizeTariffText(formula.note);
    assert.notEqual(localized, formula.note);
    assert.doesNotMatch(localized, /Sans engagement|Remise officielle|L’offre annuelle|tarif partenaire/);
  }
  const appNote = localizeTariffText(byId.get('Application Electra - prix variable').note);
  assert.equal(appNote, 'Price varies by station, time of day and demand. The exact price is shown in the Electra app before charging. The calculation uses the midpoint of the official range.');
});
