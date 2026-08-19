import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    PERIOD,
    atlanteSteadyStateRate,
    buildAtlanteSessions,
    calculateBreakeven,
    chargebackBreakeven,
    computeProfileMonthlyCost,
    getAtlanteGemsRate,
    simulateAtlanteChargeBack
} from '../src/domain/pricing.js';

describe('calculs génériques', () => {
    it('mensualise correctement un abonnement annuel', () => {
        const result = calculateBreakeven({ rate: 0.30, ref: 0.50, cost: 24, period: PERIOD.ANNUAL }, 0.18);
        assert.ok(Math.abs(result.monthlyCost - 2) < 1e-9);
        assert.ok(Math.abs(result.kwh - 10) < 1e-9);
        assert.ok(Math.abs(result.km - 55.5555) < 1e-3);
    });

    it('retourne un seuil infini si la formule ne fait rien économiser', () => {
        const result = calculateBreakeven({ rate: 0.50, ref: 0.50, cost: 5, period: PERIOD.MONTHLY }, 0.18);
        assert.equal(result.km, Infinity);
    });

    it('retourne zéro pour une formule sans abonnement', () => {
        const result = calculateBreakeven({ rate: 0.39, ref: 0.39, cost: 0, period: PERIOD.NONE }, 0.18);
        assert.equal(result.km, 0);
    });
});

describe('ChargeBack Atlante', () => {
    const config = {
        enabled: true,
        beforeDate: '2026-07-01',
        promoEndDate: '2026-09-30',
        rateBefore: 1,
        rateAfter: 0.5,
        rateAfterPromo: 0.25
    };

    it('sélectionne le taux selon la date', () => {
        assert.equal(getAtlanteGemsRate(config, new Date('2026-06-30T12:00:00+02:00')), 1);
        assert.equal(getAtlanteGemsRate(config, new Date('2026-07-15T12:00:00+02:00')), 0.5);
        assert.equal(getAtlanteGemsRate(config, new Date('2026-10-01T12:00:00+02:00')), 0.25);
    });

    it('calcule le taux permanent', () => {
        assert.ok(Math.abs(atlanteSteadyStateRate(0.29, 1) - 0.145) < 1e-9);
        assert.ok(Math.abs(atlanteSteadyStateRate(0.29, 0.5) - 0.1933333) < 1e-6);
    });

    it('simule les sessions sans récursivité du crédit', () => {
        const simulation = simulateAtlanteChargeBack({ sessions: [20, 20, 20, 20], pricePerKwh: 1, gemsRate: 1 });
        assert.equal(simulation.totalGross, 80);
        assert.equal(simulation.totalPaid, 40);
        assert.equal(simulation.finalCredit, 0);
        assert.ok(Math.abs(simulation.discountRate - 0.5) < 1e-9);
    });

    it('répartit la consommation mensuelle entre les sessions', () => {
        assert.deepEqual(buildAtlanteSessions(1000, 0.18, 4), [45, 45, 45, 45]);
    });

    it('calcule un seuil ChargeBack cohérent', () => {
        const km = chargebackBreakeven({ rate: 0.29, ref: 0.49, cost: 4.99, period: PERIOD.MONTHLY }, 0.18, 0.5);
        assert.ok(km > 0);
        assert.equal(Number.isFinite(km), true);
    });

    it('neutralise le seuil quand aucune référence nationale fiable n’est disponible', () => {
        const formula = { rate: 0.29, ref: 0.54, cost: 9.99, period: PERIOD.MONTHLY, referenceUnavailable: true };
        const result = calculateBreakeven(formula, 0.18);
        assert.equal(result.monthlyCost, 9.99);
        assert.equal(result.km, Infinity);
        assert.equal(chargebackBreakeven(formula, 0.18, 0.5), Infinity);
    });
});


describe('coût mensuel du profil', () => {
    it('additionne recharge rapide, domicile et abonnement', () => {
        const cost = computeProfileMonthlyCost(
            { rate: 0.40, monthlyCost: 5 },
            1000,
            0.18,
            { fastPercentage: 50, homeRate: 0.20 }
        );
        assert.ok(Math.abs(cost - 59) < 1e-9);
    });

    it('simule ChargeBack uniquement sur la part rapide', () => {
        const cost = computeProfileMonthlyCost(
            {
                rate: 0.145,
                rateRaw: 0.29,
                monthlyCost: 0,
                chargebackConfig: {
                    enabled: true,
                    beforeDate: '2026-07-01',
                    rateBefore: 1,
                    rateAfter: 0.5,
                    sessionsPerMonth: 4
                }
            },
            1000,
            0.18,
            { fastPercentage: 100, homeRate: 0.20, date: new Date('2026-06-15T12:00:00+02:00') }
        );
        assert.ok(Math.abs(cost - 26.1) < 1e-9);
    });
});
