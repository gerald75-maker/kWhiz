import test from 'node:test';
import assert from 'node:assert/strict';
import { addScenarioToHistory, normalizeScenarioHistory } from '../src/ui/scenario-simulator.js';

const scenario = (id, km, fastPercentage) => ({
    id, km, fastPercentage, operator: 'Ionity', formula: 'Passport', monthlyCost: 42.5
});

test('normalise et limite l’historique des scénarios', () => {
    const result = normalizeScenarioHistory([
        scenario('1', 1000, 50), scenario('2', 2000, 80), scenario('3', 3000, 100)
    ], 2);
    assert.equal(result.length, 2);
    assert.equal(result[0].km, 1000);
});

test('place le nouveau scénario en tête et déduplique son usage', () => {
    const history = [scenario('1', 1000, 50), scenario('2', 2000, 80)];
    const result = addScenarioToHistory(history, scenario('3', 1000, 50));
    assert.equal(result.length, 2);
    assert.equal(result[0].id, '3');
    assert.equal(result.filter(item => item.km === 1000 && item.fastPercentage === 50).length, 1);
});
