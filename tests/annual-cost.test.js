import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chargebackChangeWithinYear, computeProfileAnnualCost, computeProfileMonthlyCost } from '../src/domain/pricing.js';

const tariffs = JSON.parse(await readFile(new URL('../public/tarifs.json', import.meta.url), 'utf8'));
const config = { enabled: true, beforeDate: '2026-07-01', rateBefore: 1, rateAfter: 1, promoEndDate: '2026-12-31', rateAfterPromo: 0.5, sessionsPerMonth: 4, gemsGenerateGems: false };
const atlanteGo = { rateRaw: 0.29, monthlyCost: 4.99, chargebackConfig: config };
const date = new Date('2026-11-11T12:00:00+01:00');

test('le coût annuel suit le ChargeBack mois par mois au lieu de multiplier le mois courant par 12', () => {
    const monthNow = computeProfileMonthlyCost(atlanteGo, 1000, 0.18, { fastPercentage: 100, date });
    const annual = computeProfileAnnualCost(atlanteGo, 1000, 0.18, { fastPercentage: 100, date });
    assert.equal(monthNow.toFixed(2), '31.09');
    assert.equal(annual.toFixed(2), '487.27');
    assert.ok(annual > monthNow * 12);
});

test('sans ChargeBack, le coût annuel reste douze fois le coût mensuel', () => {
    const iecharge = { rateRaw: 0.25, rate: 0.25, monthlyCost: 0 };
    const monthly = computeProfileMonthlyCost(iecharge, 1000, 0.18, { fastPercentage: 100, date });
    assert.equal(computeProfileAnnualCost(iecharge, 1000, 0.18, { fastPercentage: 100, date }), monthly * 12);
});

test('le changement de taux est signalé seulement s’il tombe dans les 12 mois', () => {
    assert.deepEqual(chargebackChangeWithinYear(atlanteGo, date), { endDate: '2026-12-31', rateNow: 1, rateAfter: 0.5 });
    assert.equal(chargebackChangeWithinYear(atlanteGo, new Date('2027-02-01T12:00:00+01:00')), null);
    assert.equal(chargebackChangeWithinYear({ rateRaw: 0.25 }, date), null);
});

test('la configuration ChargeBack publiée correspond à celle testée', () => {
    assert.deepEqual(tariffs.atlante.loyalty.chargebackConfig, config);
});

test('l’accueil chiffre l’écart entre la formule la moins chère et la plus chère', async () => {
    const { monthlyCostSpread } = await import('../src/domain/pricing.js');
    const formulas = [
        { rate: 0.25, rateRaw: 0.25, monthlyCost: 0 },
        { rate: 0.59, rateRaw: 0.59, monthlyCost: 0 },
        { rate: 0.19, rateRaw: 0.19, monthlyCost: 12.99 }
    ];
    const result = monthlyCostSpread(formulas, 1000, 0.18);
    assert.equal(result.lowest.toFixed(2), '45.00');
    assert.equal(result.highest.toFixed(2), '106.20');
    assert.equal(monthlyCostSpread(formulas.slice(0, 1), 1000, 0.18), null);
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(html, /class="landing-benefit" hidden="" id="landing-benefit"/);
});
