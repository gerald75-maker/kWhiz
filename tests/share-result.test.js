import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShareText } from '../src/ui/share-result.js';

test('buildShareText produit un résumé complet en français', () => {
    const text = buildShareText({
        operator: 'Ionity',
        formula: 'Passport Power',
        monthlyCost: 42.5,
        annualCost: 510,
        km: 1500,
        fastPercentage: 80
    });

    assert.match(text, /Ionity · Passport Power/);
    assert.match(text, /42,50 €\/mois/);
    assert.match(text, /510 € par an/);
    assert.match(text, /1[\s\u202f]500 km\/mois/);
    assert.match(text, /80 % de recharge rapide/);
});

test('buildShareText conserve les valeurs nulles valides', () => {
    const text = buildShareText({
        operator: 'Exemple',
        formula: 'Sans abonnement',
        monthlyCost: 0,
        annualCost: 0,
        km: 0,
        fastPercentage: 0
    });

    assert.match(text, /0,00 €\/mois/);
    assert.match(text, /0 km\/mois/);
    assert.match(text, /0 % de recharge rapide/);
});
