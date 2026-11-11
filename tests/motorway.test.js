import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isMotorwayStation } from '../src/domain/motorway.js';
import { compareByPrice } from '../src/domain/station-pricing.js';
import { renderStationCardHtml } from '../src/ui/station-card.js';
import { setLanguage } from '../src/i18n/i18n.js';

test('reconnaît les aires d’autoroute', () => {
    for (const station of [
        { name: 'ENGIE Vianeo', address: 'Aire du Guiers - A43 - 38480 ROMAGNIEU' },
        { name: 'IONITY GMBH', address: 'Aire de Saint Leger Est , A10, 17800 Saint Léger' },
        { name: 'IONITY Bois Guillerot', address: 'A36, 21250 Glanon' },
        { name: 'IZIVIA FAST', address: 'Autoroute du Soleil 21320 Pouilly-en-Auxois' }
    ]) assert.equal(isMotorwayStation(station), true, station.address);
});

test('écarte sorties, enseignes, covoiturage et la ville d’Aire-sur-l’Adour', () => {
    for (const station of [
        { name: 'A7 - Les Tourrettes - Première Classe Montélimar', address: '695 Rue de Berianne 26740 Les Tourettes' },
        { name: 'Electra Villepinte - Hôtel Ibis', address: 'A104 Sortie No2 95972 Villepinte' },
        { name: 'Electra Le Bosc - E.Leclerc', address: 'A75 34700 Le Bosc' },
        { name: 'FLEX-E', address: 'Aire de covoiturage Vinci Autoroutes Valence Nord 26500 Bourg-lès-Valence' },
        { name: 'IZIVIA FAST', address: '101 Route de Bordeaux 40800 Aire-sur-l\'Adour' },
        { name: 'Lidl · Saint-Vit', address: 'Rue des Champs de Tenne, 25410, Saint-Vit' }
    ]) assert.equal(isMotorwayStation(station), false, station.address);
});

test('une station d’autoroute affiche un badge sans prix et passe en fin de tri', () => {
    setLanguage('fr', { persist: false, translate: false });
    const price = { payg: { rate: 0.52, from: true, approx: false } };
    const html = renderStationCardHtml({ id: 'm', name: 'IONITY Vérités', address: 'A71', lat: 46, lon: 2, motorway: true }, { price });
    assert.match(html, /Aire d’autoroute/);
    assert.match(html, /Tarif autoroute non comparé/);
    assert.doesNotMatch(html, /0,52/);
    const prices = new Map([['ionity', { sortRate: 0.2 }], ['lidl', { sortRate: 0.29 }]]);
    const list = [{ id: 'm', operator: 'ionity', motorway: true }, { id: 'l', operator: 'lidl' }];
    assert.deepEqual(list.sort(compareByPrice(prices, () => 0)).map(item => item.id), ['l', 'm']);
});

test('environ 7 % des stations IRVE sont détectées sur autoroute', async () => {
    const { stations } = JSON.parse(await readFile(new URL('../public/irve-fast.json', import.meta.url), 'utf8'));
    const share = stations.filter(isMotorwayStation).length / stations.length;
    assert.ok(share > 0.04 && share < 0.12, `part détectée : ${(share * 100).toFixed(1)} %`);
});
