import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScenarioComparison } from '../src/ui/scenario-simulator.js';

const formulasData = [
    { opKey: 'a', operator: 'A', name: 'Sans abonnement', rate: 0.60, monthlyCost: 0 },
    { opKey: 'b', operator: 'B', name: 'Abonnement', rate: 0.30, monthlyCost: 10 }
];

test('le simulateur peut changer la meilleure formule selon le kilométrage', () => {
    const result = calculateScenarioComparison({
        formulasData,
        consumption: 0.2,
        homeRate: 0.2,
        baselineKm: 100,
        baselineFastPercentage: 100,
        scenarioKm: 2000,
        scenarioFastPercentage: 100
    });
    assert.equal(result.baselineBest.opKey, 'a');
    assert.equal(result.scenarioBest.opKey, 'b');
    assert.equal(result.changedFormula, true);
});

test('le simulateur conserve la recommandation pour un scénario identique', () => {
    const result = calculateScenarioComparison({
        formulasData,
        consumption: 0.2,
        homeRate: 0.2,
        baselineKm: 1000,
        baselineFastPercentage: 50,
        scenarioKm: 1000,
        scenarioFastPercentage: 50
    });
    assert.equal(result.changedFormula, false);
    assert.equal(result.monthlyDifference, 0);
});
