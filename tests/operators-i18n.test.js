import test from 'node:test';
import assert from 'node:assert/strict';
import { setLanguage } from '../src/i18n/i18n.js';
import { buildFormulaMeta, formatOperatorSubscription, renderOperatorsViews } from '../src/ui/views/operators-view.js';

const formula = {
    name: 'Atlante Go - mensuel',
    cost: 9.99,
    period: 'monthly',
    rate: 0.29,
    ref: 0.54,
    pricingType: 'fixed',
    calculationBasis: 'official',
    verifiedAt: '2026-07-27',
    sourceUrl: 'https://atlante.energy/',
    chargebackEligible: true,
    note: '0,29 €/kWh chez Atlante. ChargeBack à 50 %.'
};

const operators = {
    atlante: {
        name: 'Atlante',
        color: 'atlante',
        badge: '50–400 kW',
        formulas: [formula],
        loyalty: {
            name: 'ChargeBack',
            chargebackInfo: true,
            description: 'Cumulez des Green Gems à chaque recharge et convertissez-les en crédit pour vos prochaines sessions chez Atlante ou Powerdot.',
            chargebackConfig: {
                enabled: true,
                beforeDate: '2026-07-01',
                rateBefore: 1,
                rateAfter: 0.5,
                sessionsPerMonth: 4,
                gemsGenerateGems: false
            }
        }
    }
};

function render(language) {
    const containers = new Map([
        ['operators-compact', { innerHTML: '', children: [], appendChild(node) { this.children.push(node); } }],
        ['operators-detailed', { innerHTML: '', children: [], appendChild(node) { this.children.push(node); } }],
        ['operators-page-count', { innerHTML: '' }]
    ]);
    globalThis.document = {
        getElementById: id => containers.get(id) || null,
        createElement: () => ({ className: '', innerHTML: '', addEventListener() {} }),
        dispatchEvent: () => true
    };
    setLanguage(language, { persist: false, translate: false });
    renderOperatorsViews({ operators, consumption: 18, logos: {} });
    return containers.get('operators-compact').children[0].innerHTML;
}

test('localise les métadonnées et abonnements du plan avec Intl', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(formatOperatorSubscription(formula), '9,99 €/mois');
    assert.match(buildFormulaMeta(formula), /Tarif fixe.*Vérifié le 27 juillet 2026.*Source officielle/);

    setLanguage('en', { persist: false, translate: false });
    assert.equal(formatOperatorSubscription(formula), '€9.99/month');
    const meta = buildFormulaMeta(formula);
    assert.match(meta, /Fixed price.*Verified on 27 July 2026.*Official source/);
    assert.doesNotMatch(meta, /Tarif fixe|vérifié le|27\/07\/2026/);
    assert.match(meta, /formula-meta-part">· Verified on/);
    assert.match(meta, /formula-meta-part">· <a[^>]*>Official source/);
});

test('rend la fiche ChargeBack entièrement localisée en FR et EN', () => {
    const french = render('fr');
    assert.match(french, /9,99(?:&nbsp;|\s)€\/mois/);
    assert.match(french, /Prix effectif avec ChargeBack/);
    assert.match(french, /0,193(?:&nbsp;|\s)€/);
    assert.match(french, /Cumulez des Green Gems/);
    assert.match(french, /Bornes 50–400 kW/);

    const english = render('en');
    assert.match(english, /€9\.99\/month/);
    assert.match(english, /Fixed price/);
    assert.match(english, /Verified on 27 July 2026/);
    assert.match(english, /Effective price with ChargeBack/);
    assert.match(english, /€0\.193/);
    assert.match(english, /Earn Green Gems with every charge/);
    assert.match(english, /Chargers 50–400 kW/);
    assert.doesNotMatch(english, /Tarif fixe|vérifié le|Cumulez|Bornes 50|Prix effectif/);
});

test('localise aussi le tarif variable sans modifier le nom commercial', () => {
    setLanguage('en', { persist: false, translate: false });
    const meta = buildFormulaMeta({ ...formula, name: 'Tarif unique', pricingType: 'station' });
    assert.match(meta, /Variable price depending on the station/);
    assert.equal(formula.name, 'Atlante Go - mensuel');
});
