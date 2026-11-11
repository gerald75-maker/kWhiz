import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildStationPrices, compareByPrice, formulaPlanId } from '../src/domain/station-pricing.js';
import { formatStationPrice, renderStationCardHtml } from '../src/ui/station-card.js';
import { setLanguage } from '../src/i18n/i18n.js';

const formula = (opKey, name, rate, extra = {}) => ({ opKey, name, rate, monthlyCost: 0, pricingType: 'fixed', ...extra });
const normalize = value => value.replace(/\s/g, ' ');

test('le prix sans abonnement suit la règle tel quel, « dès » ou « ≈ »', () => {
    const prices = buildStationPrices([
        formula('lidl', 'Recharge rapide DC', 0.29),
        formula('ionity', 'Paiement direct', 0.55),
        formula('ionity', 'Application IONITY', 0.52),
        formula('tesla', 'Sans abonnement', 0.50, { pricingType: 'station' }),
        formula('engie-vianeo', 'Application', 0.54, { pricingType: 'station', isMinimum: true }),
        formula('electra', 'Application Electra', 0.50, { pricingType: 'range', rateMin: 0.39, rateMax: 0.61 })
    ]);
    assert.deepEqual(prices.get('lidl').payg, { rate: 0.29, from: false, approx: false });
    assert.deepEqual(prices.get('ionity').payg, { rate: 0.52, from: true, approx: false });
    assert.deepEqual(prices.get('tesla').payg, { rate: 0.50, from: false, approx: true });
    assert.equal(prices.get('engie-vianeo').payg.from, true);
    assert.deepEqual(prices.get('electra').payg, { rate: 0.39, from: true, approx: false });
});

test('seuls les abonnements favoris ou recommandés apparaissent', () => {
    const go = formula('atlante', 'Atlante Go - mensuel', 0.145, { monthlyCost: 4.99, chargebackRate: 0.145 });
    const formulas = [formula('atlante', 'Sans abonnement', 0.54, { pricingType: 'station' }), go];
    assert.equal(buildStationPrices(formulas).get('atlante').plan, null);
    const withPlan = buildStationPrices(formulas, { planIds: new Set([formulaPlanId(go)]) }).get('atlante');
    assert.deepEqual(withPlan.plan, { rate: 0.145, name: 'Atlante Go - mensuel', approx: true });
    assert.equal(withPlan.sortRate, 0.145);
});

test('le tri « Les moins chères » classe par prix puis distance, prix inconnus en dernier', () => {
    const prices = new Map([['lidl', { sortRate: 0.29 }], ['ionity', { sortRate: 0.52 }]]);
    const stations = [
        { id: 'a', operator: 'ionity', d: 1 }, { id: 'b', operator: 'inconnu', d: 0 },
        { id: 'c', operator: 'lidl', d: 9 }, { id: 'd', operator: 'lidl', d: 2 }
    ];
    assert.deepEqual(stations.sort(compareByPrice(prices, station => station.d)).map(station => station.id), ['d', 'c', 'a', 'b']);
});

test('la fiche de station affiche les deux prix en français et en anglais', () => {
    const price = { payg: { rate: 0.54, from: false, approx: true }, plan: { rate: 0.145, name: 'Atlante Go - mensuel', approx: true } };
    setLanguage('fr', { persist: false, translate: false });
    assert.deepEqual(formatStationPrice(price).map(normalize), ['≈ 0,54 €/kWh sans abonnement', '≈ 0,145 €/kWh avec Atlante Go']);
    const html = renderStationCardHtml({ id: 's1', name: 'Atlante', address: 'Montluçon', lat: 46, lon: 2 }, { price });
    assert.match(html, /class="station-price"><b>≈\s0,54\s€\/kWh sans abonnement<\/b><b class="station-price-plan">/);
    assert.equal(renderStationCardHtml({ id: 's2', name: 'X', lat: 0, lon: 0 }).includes('station-price'), false);
    setLanguage('en', { persist: false, translate: false });
    assert.match(normalize(formatStationPrice({ payg: { rate: 0.52, from: true, approx: false } })[0]), /^from €0\.52\/kWh without subscription$/);
    setLanguage('fr', { persist: false, translate: false });
});

test('chaque réseau de la carte a un prix sans abonnement dans les tarifs', async () => {
    const tariffs = JSON.parse(await readFile(new URL('../public/tarifs.json', import.meta.url), 'utf8'));
    const { MAP_OPERATOR_KEYS } = await import('../src/config/app-config.js');
    const formulas = Object.entries(tariffs).filter(([key]) => !key.startsWith('_'))
        .flatMap(([opKey, operator]) => operator.formulas.map(item => ({ ...item, opKey, monthlyCost: item.cost > 0 ? item.cost : 0 })));
    const prices = buildStationPrices(formulas);
    for (const key of MAP_OPERATOR_KEYS) assert.ok(prices.get(key)?.payg, `${key} sans prix sans abonnement`);
});
