import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { VEHICLES, VEHICLE_SOURCE, findVehicle, vehicleLabel, vehicleSliderValue } from '../src/config/vehicles.js';

test('une trentaine de modèles, identifiants uniques, valeurs plausibles', () => {
    assert.ok(VEHICLES.length >= 30);
    assert.equal(new Set(VEHICLES.map(v => v.id)).size, VEHICLES.length);
    for (const v of VEHICLES) {
        assert.ok(v.whKm >= 110 && v.whKm <= 260, v.id);
        assert.ok(v.usableKwh > 15 && v.usableKwh < 110, v.id);
    }
});

test('la Ioniq 5 73 kWh de 2021 reprend les valeurs EV Database', () => {
    const ioniq = findVehicle('hyundai-ioniq5-73-2021');
    assert.equal(ioniq.whKm, 189);
    assert.equal(ioniq.usableKwh, 70);
    assert.equal(vehicleSliderValue(ioniq), 19);
    assert.equal(vehicleLabel(ioniq), 'Hyundai Ioniq 5 73 kWh propulsion (2021)');
});

test('arrondi au kWh/100 km dans les bornes du curseur', () => {
    assert.equal(vehicleSliderValue({ whKm: 133 }), 13);
    assert.equal(vehicleSliderValue({ whKm: 155 }), 16);
    assert.equal(vehicleSliderValue({ whKm: 80 }), 10);
    assert.equal(vehicleSliderValue({ whKm: 400 }), 30);
    assert.equal(findVehicle('inconnu'), null);
});

test('la source et sa date sont citées', async () => {
    assert.deepEqual({ ...VEHICLE_SOURCE }, { name: 'EV Database', url: 'https://ev-database.org/', asOf: '2026-11-11' });
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(html, /id="vehicle-model"/);
    assert.match(html, /href="https:\/\/ev-database\.org\/"/);
});
