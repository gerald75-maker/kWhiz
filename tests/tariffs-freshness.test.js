import test from 'node:test';
import assert from 'node:assert/strict';
import { assessTariffsFreshness } from '../src/domain/tariffs-freshness.js';

const now = new Date('2026-07-27T12:00:00+02:00');

test('classe des tarifs récents', () => {
    const result = assessTariffsFreshness('2026-07-20', { now });
    assert.equal(result.state, 'fresh');
    assert.equal(result.ageDays, 7);
});

test('signale des tarifs à vérifier après 30 jours', () => {
    const result = assessTariffsFreshness('2026-06-01', { now });
    assert.equal(result.state, 'stale');
});

test('signale des tarifs critiques après 90 jours', () => {
    const result = assessTariffsFreshness('2026-01-01', { now });
    assert.equal(result.state, 'critical');
});

test('gère une date inconnue', () => {
    const result = assessTariffsFreshness(null, { now });
    assert.equal(result.state, 'unknown');
});
