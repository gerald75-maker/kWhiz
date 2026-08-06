import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const tariffs = JSON.parse(await readFile(new URL('public/tarifs.json', root), 'utf8'));
const config = await readFile(new URL('src/config/app-config.js', root), 'utf8');

test('référence Plug Inn fast charge et son logo normalisé', async () => {
  await access(new URL('public/logos/pluginn.webp', root));
  assert.match(config, /pluginn: '\.\/logos\/pluginn\.webp'/);
  assert.match(config, /'pluginn'/);
});

test('contient les trois tarifs officiels Plug Inn fast charge', () => {
  const operator = tariffs.pluginn;
  assert.equal(operator.name, 'Plug Inn fast charge');
  assert.deepEqual(
    operator.formulas.map(({ name, cost, rate }) => ({ name, cost, rate })),
    [
      { name: 'Carte bancaire', cost: 0, rate: 0.59 },
      { name: 'Charge Pass BASIC', cost: 0, rate: 0.46 },
      { name: 'Charge Pass INTENSE', cost: 5.99, rate: 0.39 }
    ]
  );
  assert.match(operator.formulas[0].note, /0,30 €\/min/);
  assert.match(operator.formulas[1].note, /Renault, Dacia ou Alpine/);
  assert.match(operator.formulas[2].note, /tarif permanent/);
});

test('intègre uniquement les stations rapides Plug Inn identifiées dans la base IRVE', async () => {
  const payload = JSON.parse(await readFile(new URL('public/irve-fast.json', root), 'utf8'));
  const stations = payload.stations.filter(station => station.operator === 'pluginn');
  assert.ok(stations.length >= 70);
  assert.ok(stations.every(station => station.power >= 100));
  assert.ok(stations.every(station => !/renault trucks|freshmile|power ?dot/i.test(station.name)));
});
