import test from 'node:test';
import assert from 'node:assert/strict';
import { assessTariffsFreshness } from '../src/domain/tariffs-freshness.js';
import { formatTariffsFreshness, setLanguage } from '../src/i18n/i18n.js';

const now = new Date('2026-07-27T12:00:00+02:00');

test('classe des tarifs récents', () => {
    const result = assessTariffsFreshness('2026-07-20', { now });
    assert.equal(result.state, 'fresh');
    assert.equal(result.ageDays, 7);
    assert.equal('label' in result, false);
});

test('localise la fraîcheur du jour, d’un jour et de plusieurs jours', () => {
    const today = assessTariffsFreshness('2026-07-27', { now });
    const oneDay = assessTariffsFreshness('2026-07-26', { now });
    const severalDays = assessTariffsFreshness('2026-07-20', { now });
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(formatTariffsFreshness(today), 'Tarifs vérifiés aujourd’hui');
    assert.equal(formatTariffsFreshness(oneDay), 'Tarifs récents (1 jour)');
    assert.equal(formatTariffsFreshness(severalDays), 'Tarifs récents (7 jours)');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(formatTariffsFreshness(today), 'Prices checked today');
    assert.equal(formatTariffsFreshness(oneDay), 'Recent prices (1 day)');
    assert.equal(formatTariffsFreshness(severalDays), 'Recent prices (7 days)');
});

test('signale des tarifs à vérifier après 30 jours', () => {
    const result = assessTariffsFreshness('2026-06-01', { now });
    assert.equal(result.state, 'stale');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(formatTariffsFreshness(result), 'Prices need checking (56 days)');
});

test('signale des tarifs critiques après 90 jours', () => {
    const result = assessTariffsFreshness('2026-01-01', { now });
    assert.equal(result.state, 'critical');
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(formatTariffsFreshness(result), 'Tarifs trop anciens (207 jours)');
});

test('gère une date inconnue', () => {
    const result = assessTariffsFreshness(null, { now });
    assert.equal(result.state, 'unknown');
});

test('conserve exactement les seuils de fraîcheur à 30 et 90 jours', () => {
    const utcNow = new Date('2026-07-27T12:00:00Z');
    assert.equal(assessTariffsFreshness('2026-06-28', { now: utcNow }).state, 'fresh');
    assert.equal(assessTariffsFreshness('2026-06-27', { now: utcNow }).state, 'stale');
    assert.equal(assessTariffsFreshness('2026-04-29', { now: utcNow }).state, 'stale');
    assert.equal(assessTariffsFreshness('2026-04-28', { now: utcNow }).state, 'critical');
});
