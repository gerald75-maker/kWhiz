import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTariffSnapshot, appendTariffSnapshot, getFormulaHistory, describeTariffChange } from '../src/domain/tariff-history.js';

const operators = rate => ({ electra: { formulas: [{ name: 'Smart', rate, cost: 5.99, period: 'monthly' }] } });

test('construit un relevé tarifaire par formule', () => {
    const snapshot = buildTariffSnapshot(operators(0.49), '2026-07-27', '2026-07-27T10:00:00Z');
    assert.equal(snapshot.formulas['electra::Smart'].rate, 0.49);
});

test('ne duplique pas un relevé identique', () => {
    const first = buildTariffSnapshot(operators(0.49), '2026-07-27');
    const second = buildTariffSnapshot(operators(0.49), '2026-07-28');
    assert.equal(appendTariffSnapshot([first], second).length, 1);
});

test('détecte une hausse de tarif', () => {
    const history = [buildTariffSnapshot(operators(0.49), '2026-06-01'), buildTariffSnapshot(operators(0.52), '2026-07-01')];
    const entries = getFormulaHistory(history, 'electra::Smart');
    const change = describeTariffChange(entries);
    assert.equal(change.state, 'up');
    assert.ok(Math.abs(change.deltaRate - 0.03) < 1e-9);
});
