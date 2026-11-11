import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { localizeTariffText, setLanguage } from '../src/i18n/i18n.js';

const tariffs = JSON.parse(await readFile(new URL('../public/tarifs.json', import.meta.url), 'utf8'));

const formula = (operator, name) => tariffs[operator].formulas.find(item => item.name === name);

test('l’audit du 21 septembre conserve les écarts tarifaires confirmés', () => {
  assert.equal(tariffs._updated, '2026-10-08');
  assert.deepEqual(
    [formula('lidl', 'Recharge rapide DC').rate, formula('lidl', 'Recharge rapide DC').calculationBasis],
    [0.29, 'official']
  );
  assert.deepEqual(
    [formula('fastned', 'Abonnement Gold - remise 30 %').cost, formula('fastned', 'Abonnement Gold - remise 30 %').validUntil],
    [5.99, '2026-09-30']
  );
  assert.match(formula('iziviafast', 'Happy Hours - heures creuses').note, /9 h à 11 h.*15 h à 17 h/);
});

test('les nouvelles notes tarifaires sont traduites en anglais', () => {
  setLanguage('en', { persist: false, translate: false });
  for (const [operator, name] of [
    ['electra', 'Paiement par badge ou carte'],
    ['lidl', 'Recharge rapide DC'],
    ['iziviafast', 'Happy Hours - heures creuses'],
    ['iziviafast', 'Tarif standard'],
    ['fastned', 'Abonnement Gold - remise 30 %']
  ]) {
    const note = formula(operator, name).note;
    assert.notEqual(localizeTariffText(note), note);
  }
});
