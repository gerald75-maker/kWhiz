import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculateBreakeven, chargebackBreakeven } from '../src/domain/pricing.js';
import { renderOfferDetail } from '../src/ui/views/offer-detail-view.js';
import { setLanguage } from '../src/i18n/i18n.js';

const catalog = JSON.parse(await readFile(new URL('../public/tarifs.json', import.meta.url), 'utf8'));
const atlante = catalog.atlante;
const direct = atlante.formulas.find(formula => formula.period === 'none');
const go = atlante.formulas.find(formula => formula.id === 'atlante-go');

test('Atlante conserve exactement ses deux offres directes vérifiées', () => {
    assert.equal(atlante.formulas.length, 2);
    assert.deepEqual([go.rate, go.cost, go.period], [0.29, 9.99, 'monthly']);
    assert.equal(go.verifiedAt, '2026-09-21');
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
    assert.match(body.innerHTML, /Atlante Go à 9,99 €\/mois, sans engagement/);
    assert.match(body.innerHTML, /Atlante — 0,29 €\/kWh, ChargeBack à 50 % et décagnottage des Green Gems/);
    assert.match(body.innerHTML, /Powerdot — 0,42 €\/kWh, ChargeBack à 10 % et décagnottage des Green Gems/);
    assert.match(body.innerHTML, /ChargeLeague — 0,49 €\/kWh sur les réseaux partenaires Electra, Fastned et IONITY, avec ChargeBack à 10 %/);
    assert.match(body.innerHTML, /avantages sont réservés aux abonnés Atlante Go/);
    assert.match(body.innerHTML, /Référence variable · seuil non calculé/);

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
    assert.match(body.innerHTML, /Atlante Go costs €9.99\/month with no commitment/);
    assert.match(body.innerHTML, /Atlante — €0.29\/kWh, 50% ChargeBack and redemption of Green Gems/);
    assert.match(body.innerHTML, /Powerdot — €0.42\/kWh, 10% ChargeBack and redemption of Green Gems/);
    assert.match(body.innerHTML, /ChargeLeague — €0.49\/kWh on the Electra, Fastned and IONITY partner networks, with 10% ChargeBack/);
});
