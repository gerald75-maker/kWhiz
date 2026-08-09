import test from 'node:test';
import assert from 'node:assert/strict';
import { setLanguage } from '../src/i18n/i18n.js';
import { buildFormulaMeta, formatOperatorPlanCost, formatOperatorSubscription, formatOperatorThreshold, renderOperatorsViews } from '../src/ui/views/operators-view.js';

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
    assert.match(english, /Atlante Go — monthly/);
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

test('localise les seuils nul, fini et infini sans modifier leur valeur', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(formatOperatorThreshold(0), 'Sans abonnement');
    assert.equal(formatOperatorThreshold(1050), 'Rentable dès 1 050 km/mois');
    assert.equal(formatOperatorThreshold(Infinity), 'Non rentable');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(formatOperatorThreshold(0), 'No subscription');
    assert.equal(formatOperatorThreshold(1050), 'Cost-effective from 1,050 km/month');
    assert.equal(formatOperatorThreshold(Infinity), 'Not cost-effective');
});

test('localise les coûts sans abonnement, mensuels et annuels', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(formatOperatorPlanCost({ cost: 0, period: 'none' }), 'Sans abonnement');
    assert.equal(formatOperatorPlanCost({ cost: 9.99, period: 'monthly' }), '9,99 €/mois');
    assert.equal(formatOperatorPlanCost({ cost: 60, period: 'annual' }), '60,00 €/an');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(formatOperatorPlanCost({ cost: 0, period: 'none' }), 'No subscription');
    assert.equal(formatOperatorPlanCost({ cost: 9.99, period: 'monthly' }), '€9.99/month');
    assert.equal(formatOperatorPlanCost({ cost: 60, period: 'annual' }), '€60.00/year');
});

test('localise compteurs, en-têtes, favoris, carte et badges spécifiques dans les deux vues', () => {
    const specialOperators = {
        izivia: {
            name: 'IZIVIA Fast chez McDonald’s', color: 'izivia', badge: '150 kW DC',
            mapUrl: 'https://example.test/map', iziviaInfo: true, ionityRewards: true,
            formulas: [{ ...formula, name: 'Happy Hours - heures creuses', cost: 0, period: 'none', rate: 0.30, ref: 0.35 }]
        }
    };
    const containers = new Map([
        ['operators-compact', { innerHTML: '', hidden: false, children: [], appendChild(node) { this.children.push(node); } }],
        ['operators-detailed', { innerHTML: '', hidden: true, children: [], appendChild(node) { this.children.push(node); } }],
        ['operators-page-count', { innerHTML: '' }]
    ]);
    globalThis.document = {
        getElementById: id => containers.get(id) || null,
        createElement: () => ({ className: '', innerHTML: '', addEventListener() {} }),
        dispatchEvent: () => true
    };

    setLanguage('fr', { persist: false, translate: false });
    renderOperatorsViews({ operators: specialOperators, consumption: 18, logos: {}, favorites: new Set() });
    assert.equal(containers.get('operators-page-count').innerHTML, '<strong>1</strong><span>opérateur</span><strong>1</strong><span>formule</span>');
    const french = `${containers.get('operators-compact').children.at(-1).innerHTML}${containers.get('operators-detailed').children.at(-1).innerHTML}`;
    assert.match(french, /Formule.*Coût.*Rentabilité/s);
    assert.match(french, /Ajouter aux favoris/);
    assert.match(french, /Ouvrir la carte des bornes IZIVIA Fast chez McDonald’s/);
    assert.match(french, /Horaires Happy Hours/);
    assert.match(french, /Bonus de kWh gratuits IONITY/);
    assert.match(french, /0,30(?:&nbsp;|\s)€\/kWh/);

    setLanguage('en', { persist: false, translate: false });
    renderOperatorsViews({ operators: specialOperators, consumption: 18, logos: {}, favorites: new Set(['izivia::Happy Hours - heures creuses']) });
    assert.equal(containers.get('operators-page-count').innerHTML, '<strong>1</strong><span>network</span><strong>1</strong><span>plan</span>');
    const english = `${containers.get('operators-compact').children.at(-1).innerHTML}${containers.get('operators-detailed').children.at(-1).innerHTML}`;
    assert.match(english, /Plan.*Cost.*Break-even/s);
    assert.match(english, /Remove from favourites/);
    assert.match(english, /Open charger map for IZIVIA Fast at McDonald’s/);
    assert.match(english, /Happy Hours schedule/);
    assert.match(english, /IONITY free-kWh rewards/);
    assert.match(english, /€0\.30\/kWh/);
    assert.doesNotMatch(english, /Formule|Coût|Rentabilité|Ajouter aux favoris|Ouvrir la carte|Horaires Happy Hours|Bonus de kWh gratuits|en dehors de ces plages|Jusqu’à 5 kWh/);
    assert.equal(containers.get('operators-compact').hidden, false);
    assert.equal(containers.get('operators-detailed').hidden, true);
});

test('les compteurs gèrent zéro et plusieurs dans les deux langues', () => {
    const count = { innerHTML: '' };
    const containers = new Map([
        ['operators-compact', { innerHTML: '', appendChild() {} }],
        ['operators-detailed', { innerHTML: '', appendChild() {} }],
        ['operators-page-count', count]
    ]);
    globalThis.document = {
        getElementById: id => containers.get(id) || null,
        createElement: () => ({ className: '', innerHTML: '', addEventListener() {} }),
        dispatchEvent: () => true
    };
    setLanguage('fr', { persist: false, translate: false });
    renderOperatorsViews({ operators: {}, consumption: 18, logos: {} });
    assert.equal(count.innerHTML, '<strong>0</strong><span>opérateurs</span><strong>0</strong><span>formules</span>');
    setLanguage('en', { persist: false, translate: false });
    renderOperatorsViews({ operators: { a: { name: 'A', color: 'a', formulas: [formula] }, b: { name: 'B', color: 'b', formulas: [formula, formula] } }, consumption: 18, logos: {} });
    assert.equal(count.innerHTML, '<strong>2</strong><span>networks</span><strong>3</strong><span>plans</span>');
});
