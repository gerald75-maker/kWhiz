import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildTariffSnapshot, appendTariffSnapshot, getFormulaHistory, describeTariffChange } from '../src/domain/tariff-history.js';

const operators = (rate, verifiedAt = '2026-07-27', cost = 5.99, period = 'monthly') => ({
    electra: { formulas: [{ name: 'Smart', rate, cost, period, verifiedAt }] }
});

test('construit un relevé tarifaire par formule', () => {
    const snapshot = buildTariffSnapshot(operators(0.49), '2026-07-27', '2026-07-27T10:00:00Z');
    assert.deepEqual(snapshot.formulas['electra::Smart'], {
        rate: 0.49, cost: 5.99, period: 'monthly', verifiedAt: '2026-07-27'
    });
});

test('une modification d’une autre offre ne duplique pas la formule inchangée', () => {
    const first = buildTariffSnapshot({
        ...operators(0.25), other: { formulas: [{ name: 'Autre', rate: 0.50, cost: 0, period: 'none', verifiedAt: '2026-08-01' }] }
    }, '2026-08-01');
    const second = buildTariffSnapshot({
        ...operators(0.25), other: { formulas: [{ name: 'Autre', rate: 0.55, cost: 0, period: 'none', verifiedAt: '2026-08-06' }] }
    }, '2026-08-06');
    const history = appendTariffSnapshot([first], second);
    assert.equal(history.length, 2);
    assert.deepEqual(getFormulaHistory(history, 'electra::Smart').map(entry => entry.verifiedAt), ['2026-07-27']);
});

test('deux snapshots globaux le même jour et une vérification identique donnent une observation', () => {
    const first = buildTariffSnapshot(operators(0.49), '2026-08-06', '2026-08-06T08:00:00Z');
    const second = buildTariffSnapshot(operators(0.49), '2026-08-06', '2026-08-06T18:00:00Z');
    assert.equal(getFormulaHistory([first, second], 'electra::Smart').length, 1);
});

test('une formule inchangée et la même date de vérification reste unique', () => {
    const entries = getFormulaHistory([
        buildTariffSnapshot(operators(0.49, '2026-07-27'), '2026-07-27'),
        buildTariffSnapshot(operators(0.49, '2026-07-27'), '2026-08-06')
    ], 'electra::Smart');
    assert.deepEqual(entries.map(entry => entry.verifiedAt), ['2026-07-27']);
});

test('une nouvelle date de vérification conserve une nouvelle observation stable', () => {
    const first = buildTariffSnapshot(operators(0.49, '2026-07-27'), '2026-07-27');
    const second = buildTariffSnapshot(operators(0.49, '2026-08-06'), '2026-08-06');
    const history = appendTariffSnapshot([first], second);
    assert.equal(history.length, 2);
    assert.deepEqual(getFormulaHistory(history, 'electra::Smart').map(entry => entry.verifiedAt), ['2026-07-27', '2026-08-06']);
});

test('détecte une hausse de tarif', () => {
    const history = [
        buildTariffSnapshot(operators(0.49, '2026-06-01'), '2026-06-01'),
        buildTariffSnapshot(operators(0.52, '2026-07-01'), '2026-07-01')
    ];
    const entries = getFormulaHistory(history, 'electra::Smart');
    const change = describeTariffChange(entries);
    assert.equal(change.state, 'up');
    assert.ok(Math.abs(change.deltaRate - 0.03) < 1e-9);
});

test('conserve un changement réel d’abonnement', () => {
    const history = [
        buildTariffSnapshot(operators(0.49, '2026-06-01', 5.99), '2026-06-01'),
        buildTariffSnapshot(operators(0.49, '2026-07-01', 7.99), '2026-07-01')
    ];
    assert.deepEqual(getFormulaHistory(history, 'electra::Smart').map(entry => entry.cost), [5.99, 7.99]);
});

test('ignore prudemment la date globale d’un ancien snapshot sans perdre ses données', () => {
    const legacy = {
        updatedAt: '2026-08-06', capturedAt: '2026-08-06T10:00:00Z',
        formulas: { 'electra::Smart': { rate: 0.49, cost: 5.99, period: 'monthly' } },
        unrelatedPreference: { preserved: true }
    };
    const before = structuredClone(legacy);
    assert.deepEqual(getFormulaHistory([legacy], 'electra::Smart'), []);
    assert.deepEqual(legacy, before);
});

test('l’écriture de l’historique ne supprime aucune autre donnée locale', async () => {
    const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
    const loadBlock = appSource.slice(appSource.indexOf('async function loadTarifs()'), appSource.indexOf('function renderCurrentFormulaDetail()'));
    assert.match(loadBlock, /localStorage\.setItem\(STORAGE_KEYS\.tariffHistory/);
    assert.doesNotMatch(loadBlock, /localStorage\.(?:clear|removeItem)/);
});
