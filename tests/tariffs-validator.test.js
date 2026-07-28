import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateTariffs } from '../src/domain/tariffs-validator.js';

describe('validation des tarifs', () => {
    it('conserve une formule valide', () => {
        const result = validateTariffs({
            demo: { color: 'demo', formulas: [{ name: 'Direct', period: 'none', rate: 0.39, cost: 0, ref: 0.39 }] }
        }, { validColors: new Set(['demo']) });
        assert.equal(result.data.demo.formulas.length, 1);
        assert.equal(result.errors.length, 0);
    });

    it('exclut une formule avec un tarif non numérique au lieu de la transformer en 0', () => {
        const result = validateTariffs({
            demo: { color: 'demo', formulas: [
                { name: 'Invalide', period: 'monthly', rate: '0.29', cost: 4.99, ref: 0.50 },
                { name: 'Valide', period: 'none', rate: 0.50, cost: 0, ref: 0.50 }
            ] }
        }, { validColors: new Set(['demo']) });
        assert.equal(result.data.demo.formulas.length, 1);
        assert.equal(result.data.demo.formulas[0].name, 'Valide');
        assert.match(result.errors[0], /rate invalide/);
    });

    it('rejette un opérateur sans aucune formule valide', () => {
        const result = validateTariffs({
            demo: { color: 'demo', formulas: [{ name: 'Cassée', period: 'monthly', rate: -1, cost: 4, ref: 0.5 }] }
        }, { validColors: new Set(['demo']) });
        assert.equal(result.data.demo, undefined);
    });
});
