import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { communeFromAddress, stationDisplayName, titleCaseIfUpper } from '../src/ui/station-name.js';
import { renderStationCardHtml } from '../src/ui/station-card.js';

test('un nom technique ou réduit à la marque devient « Réseau · Commune »', () => {
    assert.equal(stationDisplayName({ name: 'LFR4049EVCP03', address: 'Avenue du Général de Gaulle 77, 18200, Saint-Amand-Montrond' }, 'Lidl'), 'Lidl · Saint-Amand-Montrond');
    assert.equal(stationDisplayName({ name: 'IONITY GMBH', address: 'Aire de la Vendée- A83- 85210 Sainte-Hermine' }, 'IONITY'), 'IONITY · Sainte-Hermine');
    assert.equal(stationDisplayName({ name: '836', address: '1 Rue Jean Bertin 45430 Chécy' }, 'Izivia Fast'), 'Izivia Fast · Chécy');
    assert.equal(stationDisplayName({ name: 'GF18', address: 'Quai Louis Blanc 03100 Montluçon' }, 'Izivia Fast'), 'Izivia Fast · Montluçon');
    assert.equal(stationDisplayName({ name: 'Atlante', address: ' Route de Villasavary, Castelnaudary 11400 France' }, 'Atlante'), 'Atlante · Castelnaudary');
    assert.equal(stationDisplayName({ name: 'e-charge50', address: '12 rue du Port 50400 Granville' }, 'Zunder'), 'Zunder · Granville');
    assert.equal(stationDisplayName({ name: 'LFR0386EVCP03', address: '94 rue de Ligny' }, 'Lidl'), 'Lidl');
});

test('les noms porteurs de sens sont conservés, majuscules et mentions juridiques nettoyées', () => {
    assert.equal(stationDisplayName({ name: 'IONITY GmbH IONITY Vérités' }, 'IONITY'), 'IONITY Vérités');
    assert.equal(stationDisplayName({ name: 'Fastned Agen Le Passage' }, 'Fastned'), 'Fastned Agen Le Passage');
    assert.equal(stationDisplayName({ name: 'AIGUES-MORTES' }, 'Lidl'), 'Aigues-Mortes');
    assert.equal(titleCaseIfUpper('ROSNY SOUS BOIS'), 'Rosny sous Bois');
    assert.equal(titleCaseIfUpper('Saint-Vit'), 'Saint-Vit');
    assert.equal(communeFromAddress('7 Allée Antoine Parmentier 86000 Poitiers'), 'Poitiers');
});

test('la fiche affiche le nom lisible sans toucher à l’identifiant de la station', () => {
    const station = { id: 'FRLDLE4049', name: 'LFR4049EVCP03', address: 'Avenue du Général de Gaulle 77, 18200, Saint-Amand-Montrond', lat: 46.7, lon: 2.5 };
    const html = renderStationCardHtml(station, { operatorLabel: 'Lidl' });
    assert.match(html, /<strong>Lidl · Saint-Amand-Montrond<\/strong>/);
    assert.match(html, /data-station-id="FRLDLE4049"/);
    assert.match(html, /data-station="Lidl · Saint-Amand-Montrond"/);
    assert.doesNotMatch(html, /LFR4049EVCP03/);
});

test('sur la base IRVE actuelle, plus aucun nom affiché n’est un code', async () => {
    const { stations } = JSON.parse(await readFile(new URL('../public/irve-fast.json', import.meta.url), 'utf8'));
    const technical = stations.map(station => stationDisplayName(station, 'Réseau')).filter(name => /^(\d+|[A-Z]{1,4}\d{1,4}|LFR\w+)$/.test(name));
    assert.deepEqual(technical, []);
});
