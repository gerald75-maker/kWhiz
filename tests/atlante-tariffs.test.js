import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculateBreakeven, chargebackBreakeven, getAtlanteGemsRate } from '../src/domain/pricing.js';
import { offerDetailPricingLabel, renderOfferDetail } from '../src/ui/views/offer-detail-view.js';
import { setLanguage } from '../src/i18n/i18n.js';

const catalog = JSON.parse(await readFile(new URL('../public/tarifs.json', import.meta.url), 'utf8'));
const atlante = catalog.atlante;
const direct = atlante.formulas.find(formula => formula.period === 'none');
const go = atlante.formulas.find(formula => formula.id === 'atlante-go');

test('Atlante conserve exactement ses deux offres directes vérifiées', () => {
    assert.equal(atlante.formulas.length, 2);
    assert.deepEqual([go.rate, go.cost, go.period], [0.29, 4.99, 'monthly']);
    assert.equal(go.verifiedAt, '2026-10-19');
    assert.equal(atlante.verifiedAt, '2026-09-21');
    assert.equal(go.chargebackEligible, true);
    assert.equal(go.referenceUnavailable, true);
});

test('le tarif sans abonnement reste une hypothèse variable et non une référence nationale', () => {
    assert.deepEqual([direct.rate, direct.ref, direct.pricingType, direct.calculationBasis], [0.54, 0.54, 'station', 'estimate']);
    assert.match(direct.note, /hypothèse de calcul, pas un tarif national/);
    const threshold = calculateBreakeven(go, 0.18);
    assert.equal(threshold.km, Infinity);
    assert.equal(chargebackBreakeven(go, 0.18, 0.5), Infinity);
});

test('les tarifs partenaires et ChargeBack restent uniquement dans le détail Atlante Go', () => {
    setLanguage('fr', { persist: false, translate: false });
    const body = { innerHTML: '' };
    const title = { textContent: '' };
    const result = calculateBreakeven(go, 0.18);
    renderOfferDetail({
        body,
        title,
        formula: {
            ...go,
            operator: atlante.name,
            opKey: 'atlante',
            km: result.km,
            monthlyCost: result.monthlyCost,
            costPer100km: go.rate * 18,
            chargebackRate: go.rate / 1.5
        }
    });
    assert.match(body.innerHTML, /Atlante Go à 4,99 €\/mois au lieu de 9,99 €\/mois, sans engagement/);
    assert.match(body.innerHTML, /Atlante — 0,29 €\/kWh, ChargeBack à 100 % jusqu’au 31 décembre 2026, puis 50 % et décagnottage des Green Gems/);
    assert.match(body.innerHTML, /Powerdot — 0,42 €\/kWh, ChargeBack à 10 % et décagnottage des Green Gems/);
    assert.match(body.innerHTML, /ChargeLeague — 0,49 €\/kWh sur les réseaux partenaires Electra, Fastned et IONITY, avec ChargeBack à 10 %/);
    assert.match(body.innerHTML, /avantages sont réservés aux abonnés Atlante Go/);
    assert.match(body.innerHTML, /Non calculé : pas de tarif sans abonnement fixe/);

    setLanguage('en', { persist: false, translate: false });
    renderOfferDetail({
        body,
        title,
        formula: {
            ...go,
            operator: atlante.name,
            opKey: 'atlante',
            km: result.km,
            monthlyCost: result.monthlyCost,
            costPer100km: go.rate * 18,
            chargebackRate: go.rate / 1.5
        }
    });
    assert.match(body.innerHTML, /Atlante Go costs €4.99\/month instead of €9.99\/month with no commitment/);
    assert.match(body.innerHTML, /Atlante — €0.29\/kWh, 100% ChargeBack until 31 December 2026, then 50%, and redemption of Green Gems/);
    assert.match(body.innerHTML, /Powerdot — €0.42\/kWh, 10% ChargeBack and redemption of Green Gems/);
    assert.match(body.innerHTML, /ChargeLeague — €0.49\/kWh on the Electra, Fastned and IONITY partner networks, with 10% ChargeBack/);
});

 test('la promotion conserve la condition de souscription et la mensualité utilisée par les calculs', () => {
    assert.equal(calculateBreakeven(go, 0.18).monthlyCost, 4.99);
    assert.match(go.note, /souscription avant le 31 décembre 2026/);
    assert.match(go.note, /conservé tant que vous restez abonné/);
    assert.equal(go.validUntil, undefined);
    const config = atlante.loyalty.chargebackConfig;
    assert.equal(getAtlanteGemsRate(config, new Date('2026-10-19T12:00:00+02:00')), 1);
    assert.equal(getAtlanteGemsRate(config, new Date('2027-01-01T12:00:00+01:00')), 0.5);
});

test('le prix ChargeBack distingue le tarif payé à la borne et le prix effectif estimé', () => {
    const effective = go.rate / 2;
    setLanguage('fr', { persist: false, translate: false });
    const fromComparison = { ...go, rate: effective, rateRaw: go.rate, chargebackRate: effective };
    const normalize = value => value.replace(/\s/g, ' ');
    assert.equal(normalize(offerDetailPricingLabel(fromComparison)),
        normalize('0,29 €/kWh payé à la borne<small class="detail-stat-sub">≈ 0,145 €/kWh après ChargeBack (estimation)</small>'));
    const fromOperators = { ...go, chargebackRate: effective };
    assert.match(offerDetailPricingLabel(fromOperators), /^0,29\s€\/kWh payé à la borne/);
    assert.equal(normalize(offerDetailPricingLabel({ ...go, chargebackRate: null })), '0,290 €/kWh');

    setLanguage('en', { persist: false, translate: false });
    assert.match(offerDetailPricingLabel(fromComparison), /^€0\.29\/kWh paid at the charger.*≈ €0\.145\/kWh after ChargeBack \(estimate\)/);
    setLanguage('fr', { persist: false, translate: false });
});
