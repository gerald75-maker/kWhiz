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

    it('normalise les URL HTTPS valides', () => {
        const result = validateTariffs({
            demo: {
                color: 'demo',
                mapUrl: 'https://example.com/map?q=borne',
                sourceUrl: 'https://example.com/source',
                formulas: [{ name: 'Direct', period: 'none', rate: 0.39, cost: 0, ref: 0.39 }]
            }
        }, { validColors: new Set(['demo']) });

        assert.equal(result.data.demo.mapUrl, 'https://example.com/map?q=borne');
        assert.equal(result.data.demo.formulas[0].sourceUrl, 'https://example.com/source');
        assert.equal(result.errors.length, 0);
    });

    it('neutralise les URL opérateur non HTTPS ou injectées', () => {
        const result = validateTariffs({
            demo: {
                color: 'demo',
                mapUrl: 'javascript:alert(1)',
                sourceUrl: 'https://example.com\" onmouseover=\"alert(1)',
                formulas: [{ name: 'Direct', period: 'none', rate: 0.39, cost: 0, ref: 0.39 }]
            }
        }, { validColors: new Set(['demo']) });

        assert.equal(result.data.demo.mapUrl, '');
        assert.equal(result.data.demo.formulas[0].sourceUrl, null);
        assert.equal(result.errors.length, 2);
    });

    it('rejette une formule dont la source URL est invalide', () => {
        const result = validateTariffs({
            demo: {
                color: 'demo',
                formulas: [
                    { name: 'Injectée', period: 'none', rate: 0.39, cost: 0, ref: 0.39, sourceUrl: 'https://example.com\" onclick=\"alert(1)' },
                    { name: 'Valide', period: 'none', rate: 0.49, cost: 0, ref: 0.49 }
                ]
            }
        }, { validColors: new Set(['demo']) });

        assert.deepEqual(result.data.demo.formulas.map(formula => formula.name), ['Valide']);
        assert.match(result.errors[0], /sourceUrl non HTTPS ou invalide/);
    });
});
