import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lowestOperatorRate } from '../src/ui/views/operators-view.js';

const tariffs = JSON.parse(await readFile(new URL('../public/tarifs.json', import.meta.url), 'utf8'));

test('« dès X €/kWh » prend le prix le plus bas payé à la borne', () => {
    assert.equal(lowestOperatorRate(tariffs.atlante), 0.29);
    assert.equal(lowestOperatorRate(tariffs.iecharge), 0.25);
    assert.equal(lowestOperatorRate({ formulas: [{ rate: 0 }, { rateMin: 0.39, rate: 0.5 }] }), 0.39);
    assert.equal(lowestOperatorRate({ formulas: [] }), null);
});

test('un seul chevron par réseau : la carte kWhiz s’ouvre par un bouton, la carte externe par ↗', async () => {
    const view = await readFile(new URL('../src/ui/views/operators-view.js', import.meta.url), 'utf8');
    assert.match(view, /data-map-operator="\$\{escapeHtml\(opKey\)\}"/);
    assert.match(view, /<span aria-hidden="true">↗<\/span><\/a>/);
    assert.doesNotMatch(view, /operator-directory-map[^`]*<span aria-hidden="true">›<\/span><\/a>/);
});
