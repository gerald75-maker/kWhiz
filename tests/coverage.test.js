import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPlaceIndex, countStationsByOperator, distanceKm, findPlace } from '../src/domain/coverage.js';
import { coverageNoteText } from '../src/ui/coverage-note.js';
import { setLanguage } from '../src/i18n/i18n.js';

const { stations } = JSON.parse(await readFile(new URL('../public/irve-fast.json', import.meta.url), 'utf8'));

test('la distance suit la géographie : Paris–Lyon ≈ 392 km', () => {
    assert.ok(Math.abs(distanceKm({ lat: 48.8566, lon: 2.3522 }, { lat: 45.764, lon: 4.8357 }) - 392) < 5);
});

test('compte les stations par réseau dans le rayon, sans les aires d’autoroute', () => {
    const center = { lat: 46, lon: 2 };
    const counts = countStationsByOperator([
        { operator: 'lidl', lat: 46.05, lon: 2, name: 'LIDL', address: 'Rue A 03100 Ville' },
        { operator: 'lidl', lat: 46.5, lon: 2, name: 'LIDL', address: 'Rue B 03100 Ville' },
        { operator: 'ionity', lat: 46.01, lon: 2, name: 'IONITY', address: 'Aire de la Vallée - A71 - 03000 Ville' }
    ], center, 20);
    assert.deepEqual(Object.fromEntries(counts), { lidl: 1 });
});

test('retrouve une commune par son nom, sans accent ou par code postal', () => {
    const index = buildPlaceIndex(stations);
    assert.ok(index.length > 1000);
    for (const query of ['Montluçon', 'montlucon', '03100', 'Montluçon (03100)']) assert.equal(findPlace(index, query)?.label, 'Montluçon', query);
    assert.equal(findPlace(index, 'St Etienne')?.label, 'Saint-Étienne');
    assert.equal(findPlace(index, 'Commune inexistante'), null);
});

test('la phrase de couverture signale l’absence de stations et ignore les agrégateurs', () => {
    setLanguage('fr', { persist: false, translate: false });
    const coverage = { label: 'Montluçon', radiusKm: 20, counts: new Map([['atlante', 3], ['ionity', 1]]), operators: new Set(['atlante', 'ionity', 'lidl']) };
    assert.equal(coverageNoteText(coverage, 'atlante', 'Atlante'), '3 stations Atlante à moins de 20 km de Montluçon');
    assert.equal(coverageNoteText(coverage, 'ionity', 'IONITY'), '1 station IONITY à moins de 20 km de Montluçon');
    assert.equal(coverageNoteText(coverage, 'lidl', 'Lidl'), 'Aucune station Lidl à moins de 20 km de Montluçon');
    assert.equal(coverageNoteText(coverage, 'lidl', 'Lidl', { short: true }), 'Aucune à moins de 20 km');
    assert.equal(coverageNoteText(coverage, 'electroverse', 'Electroverse'), '');
    assert.equal(coverageNoteText(null, 'atlante', 'Atlante'), '');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(coverageNoteText(coverage, 'atlante', 'Atlante'), '3 Atlante chargers within 20 km of Montluçon');
    setLanguage('fr', { persist: false, translate: false });
});
