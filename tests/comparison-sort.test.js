import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PERIOD, calculateBreakeven, chargebackBreakeven, computeProfileMonthlyCost } from '../src/domain/pricing.js';
import { initProfileControls } from '../src/ui/controllers/profile-controls.js';
import { formatTariffsVerifiedOn, setLanguage } from '../src/i18n/i18n.js';
import {
    adjustedThreshold,
    buildComparisonRanking,
    filterComparisonFormulas,
    openComparisonRecommendation,
    profileThresholdLabel,
    renderComparisonTable,
    subscriptionBenefitLabel,
    subscriptionLabel
} from '../src/ui/views/comparison-view.js';

const profile = { monthlyKm: 1000, consumption: 0.18, fastPercentage: 100, homeRate: 0.20 };

function formula(name, { rate, ref = rate, monthlyCost = 0, cost = monthlyCost, period = monthlyCost ? PERIOD.MONTHLY : PERIOD.NONE, km = monthlyCost ? 1000 : 0, ...extra }) {
    return { name, operator: name, rate, ref, monthlyCost, cost, period, km, ...extra };
}

test('classe automatiquement par coût mensuel rapide réel, abonnement compris', () => {
    const formulas = [
        formula('Chère', { rate: 0.60 }),
        formula('Abonnement', { rate: 0.20, ref: 0.60, monthlyCost: 10 }),
        formula('Intermédiaire', { rate: 0.40 })
    ];
    const ranking = buildComparisonRanking(formulas, profile);
    assert.deepEqual(ranking.map(item => item.name), ['Abonnement', 'Intermédiaire', 'Chère']);
    assert.equal(ranking[0].estimatedMonthlyCost, 46);
    assert.equal(ranking[0].fastChargingCost, 36);
    assert.equal(ranking[0].monthlyCost, 10);
});

test('le rendu marque uniquement la première formule comme meilleure et affiche son abonnement', () => {
    const list = { innerHTML: '', onclick: null, onkeydown: null };
    const count = { textContent: '' };
    const summary = { textContent: '' };
    globalThis.document = {
        getElementById: id => ({
            'ranking-list': list,
            'compare-count': count,
            'compare-summary': summary
        })[id] || null
    };
    const formulas = [
        formula('Sans abonnement', { rate: 0.60, opKey: 'sans' }),
        formula('Formule avec abonnement', { rate: 0.20, ref: 0.60, monthlyCost: 9.99, opKey: 'avec' })
    ];

    assert.doesNotThrow(() => renderComparisonTable(formulas, profile));
    assert.equal((list.innerHTML.match(/compare-item--best/g) || []).length, 1);
    assert.match(list.innerHTML, /compare-item compare-item--best[\s\S]*Formule avec abonnement/);
    assert.match(list.innerHTML, /9,99 €\/mois/);
});

test('le badge de vérification utilise Intl et suit immédiatement la langue', () => {
    const list = { innerHTML: '', onclick: null, onkeydown: null };
    globalThis.document = {
        getElementById: id => id === 'ranking-list' ? list : { textContent: '' },
        dispatchEvent: () => true
    };
    const formulas = [formula('Formule datée', { rate: 0.40, opKey: 'datee', verifiedAt: '2026-07-27' })];

    setLanguage('fr', { persist: false, translate: false });
    renderComparisonTable(formulas, profile);
    assert.match(list.innerHTML, /Vérifié le 27 juillet 2026/);

    setLanguage('en', { persist: false, translate: false });
    renderComparisonTable(formulas, profile);
    assert.match(list.innerHTML, /Verified on 27 July 2026/);
    assert.doesNotMatch(list.innerHTML, /Vérifié le/);
});

test('une date de vérification absente ou invalide ne produit pas de badge ni d’exception', () => {
    assert.equal(formatTariffsVerifiedOn(null), '');
    assert.equal(formatTariffsVerifiedOn('date-invalide'), '');
    const list = { innerHTML: '', onclick: null, onkeydown: null };
    globalThis.document = {
        getElementById: id => id === 'ranking-list' ? list : { textContent: '' },
        dispatchEvent: () => true
    };
    assert.doesNotThrow(() => renderComparisonTable([
        formula('Sans date', { rate: 0.40 }),
        formula('Date invalide', { rate: 0.41, verifiedAt: 'date-invalide' })
    ], profile));
    assert.doesNotMatch(list.innerHTML, /compare-verified/);
});

test('faible kilométrage favorise le sans abonnement et fort kilométrage peut favoriser un abonnement', () => {
    const formulas = [
        formula('Sans abonnement', { rate: 0.50 }),
        formula('Abonnement', { rate: 0.20, ref: 0.50, monthlyCost: 10 })
    ];
    assert.equal(buildComparisonRanking(formulas, { ...profile, monthlyKm: 100 })[0].name, 'Sans abonnement');
    assert.equal(buildComparisonRanking(formulas, { ...profile, monthlyKm: 1000 })[0].name, 'Abonnement');
});

test('Atlante Go utilise exactement la simulation ChargeBack de Mon choix', () => {
    const date = new Date('2026-08-09T12:00:00+02:00');
    const chargebackConfig = {
        enabled: true,
        beforeDate: '2026-07-01',
        rateBefore: 1,
        rateAfter: 0.5,
        sessionsPerMonth: 4
    };
    const atlanteGo = formula('Atlante Go - mensuel', {
        rate: 0.29 / 1.5,
        rateRaw: 0.29,
        ref: 0.54,
        cost: 9.99,
        monthlyCost: 9.99,
        km: chargebackBreakeven({ rate: 0.29, ref: 0.54, cost: 9.99, period: PERIOD.MONTHLY }, 0.18, 0.5),
        chargebackConfig
    });
    const payAsYouGo = formula('Sans abonnement', { rate: 0.54 });
    const options = { ...profile, date };
    const ranking = buildComparisonRanking([payAsYouGo, atlanteGo], options);

    assert.equal(ranking[0].name, 'Atlante Go - mensuel');
    assert.equal(ranking[0].monthlyCost, 9.99);
    assert.equal(
        ranking[0].estimatedMonthlyCost,
        computeProfileMonthlyCost(atlanteGo, options.monthlyKm, options.consumption, options)
    );
    assert.ok(ranking[0].estimatedMonthlyCost < ranking[1].estimatedMonthlyCost);
    assert.equal(ranking[0].estimatedMonthlyCost.toFixed(2), '47.51');
    assert.equal(ranking[0].subscriptionBenefit.toFixed(2), '49.69');
    assert.equal(subscriptionBenefitLabel(ranking[0], 'fr'), 'Vous économisez 49,69 €/mois');
});

test('un abonnement annuel conserve son prix officiel et son équivalent mensuel', () => {
    const annualResult = calculateBreakeven({ rate: 0.30, ref: 0.50, cost: 60, period: PERIOD.ANNUAL }, 0.18);
    const annual = formula('Annuel', { rate: 0.30, ref: 0.50, cost: 60, period: PERIOD.ANNUAL, monthlyCost: annualResult.monthlyCost, km: annualResult.km });
    const ranked = buildComparisonRanking([annual], profile)[0];
    assert.equal(ranked.estimatedMonthlyCost, 59);
    assert.equal(subscriptionLabel(annual, 'fr'), '60,00 €/an, soit 5,00 €/mois');
});

test('ajuste le seuil à la part rapide et traite une part rapide nulle', () => {
    const subscribed = formula('Abonnement', { rate: 0.30, ref: 0.50, monthlyCost: 5, km: 600 });
    const adjusted = { ...subscribed, adjustedThresholdKm: adjustedThreshold(subscribed.km, 40) };
    assert.equal(adjusted.adjustedThresholdKm, 1500);
    assert.equal(profileThresholdLabel(adjusted, 40, 'fr'), 'Rentable dès 1 500 km/mois au total, soit 600 km rechargés sur bornes rapides');
    assert.equal(adjustedThreshold(subscribed.km, 0), Infinity);
    assert.equal(profileThresholdLabel({ ...subscribed, adjustedThresholdKm: Infinity }, 0, 'fr'), 'Abonnement non pertinent sans recharge rapide');
});

test('un kilométrage nul ne produit aucun classement', () => {
    assert.deepEqual(buildComparisonRanking([formula('A', { rate: 0.50 })], { ...profile, monthlyKm: 0 }), []);
});

test('le classement réagit à la consommation et à la part rapide du profil', () => {
    const plans = [formula('Sans', { rate: 0.50 }), formula('Avec', { rate: 0.20, ref: 0.50, monthlyCost: 10 })];
    const lowConsumption = buildComparisonRanking(plans, { ...profile, monthlyKm: 200, consumption: 0.13, fastPercentage: 100 });
    const highConsumption = buildComparisonRanking(plans, { ...profile, monthlyKm: 200, consumption: 0.24, fastPercentage: 100 });
    const lowFastShare = buildComparisonRanking(plans, { ...profile, monthlyKm: 1000, fastPercentage: 10 });
    const highFastShare = buildComparisonRanking(plans, { ...profile, monthlyKm: 1000, fastPercentage: 100 });
    assert.equal(lowConsumption[0].name, 'Sans');
    assert.equal(highConsumption[0].name, 'Avec');
    assert.equal(lowFastShare[0].name, 'Sans');
    assert.equal(highFastShare[0].name, 'Avec');
});

test('décrit une économie réelle, une économie faible et un surcoût abonnement inclus', () => {
    assert.equal(subscriptionBenefitLabel({ monthlyCost: 5, fastKwh: 100, subscriptionBenefit: 8.2 }, 'fr'), 'Vous économisez 8,20 €/mois');
    assert.equal(subscriptionBenefitLabel({ monthlyCost: 5, fastKwh: 100, subscriptionBenefit: 0.2 }, 'fr'), 'Économie inférieure à 0,50 €/mois');
    assert.equal(subscriptionBenefitLabel({ monthlyCost: 5, fastKwh: 100, subscriptionBenefit: -4.1 }, 'fr'), 'L’abonnement vous coûte encore 4,10 €/mois de plus');
    assert.equal(subscriptionBenefitLabel({ monthlyCost: 5, fastKwh: 100, subscriptionBenefit: null }, 'fr'), 'Comparaison au tarif de référence indisponible');
    assert.equal(subscriptionBenefitLabel({ monthlyCost: 5, fastKwh: 100, subscriptionBenefit: null }, 'en'), 'Reference-price comparison unavailable');
});

test('la recherche reste active et les égalités conservent l’ordre du catalogue', () => {
    const plans = [formula('Premier', { rate: 0.50 }), formula('Second', { rate: 0.50 })];
    assert.deepEqual(buildComparisonRanking(plans, profile).map(item => item.name), ['Premier', 'Second']);
    assert.deepEqual(filterComparisonFormulas(plans, 'second').map(item => item.name), ['Second']);
});

test('Modifier mon profil utilise navigation.switchView', () => {
    const calls = [];
    openComparisonRecommendation({ switchView: view => calls.push(view) });
    assert.deepEqual(calls, ['profile']);
});

test('le kilométrage est synchronisé autour de profile-km et les anciens tris ont disparu', async () => {
    const [html, app, controller, view] = await Promise.all([
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../app.js', import.meta.url), 'utf8'),
        readFile(new URL('../src/ui/controllers/profile-controls.js', import.meta.url), 'utf8'),
        readFile(new URL('../src/ui/views/comparison-view.js', import.meta.url), 'utf8')
    ]);
    assert.match(html, /id="compare-km"/);
    assert.doesNotMatch(html, /<select|Trier par|costPer100km|monthlyCost/);
    assert.match(app, /profileControls\?\.setMonthlyKm\(event\.target\.value\)/);
    assert.match(app, /comparisonKm\.value = String\(monthlyKm\)/);
    assert.match(controller, /getMonthlyKm/);
    assert.match(controller, /setMonthlyKm/);
    assert.doesNotMatch(app + view, /currentSort|nextSortDirection|compare-sort-select/);
});

test('le contrôleur conserve une seule valeur de kilométrage pour Mon choix et Comparer', () => {
    const classes = () => ({ add() {}, remove() {}, toggle() {} });
    const profileKm = new EventTarget();
    profileKm.value = '1000';
    const chips = { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
    const elements = {
        'profile-km': profileKm,
        'profile-km-chips': chips,
        'profile-km-other-wrap': { classList: classes() },
        'km-chip-other': { classList: classes() },
        'fast-pct-value': { textContent: '' }
    };
    globalThis.document = { getElementById: id => elements[id] || null };
    globalThis.localStorage = { setItem() {} };
    let changes = 0;
    const controls = initProfileControls({ onChange: () => { changes += 1; } });

    assert.equal(controls.setMonthlyKm(1450), 1450);
    assert.equal(profileKm.value, '1450');
    assert.equal(controls.getMonthlyKm(), 1450);
    assert.equal(changes, 1);
});

test('les textes FR et EN expliquent le classement mensuel', async () => {
    const [html, i18n, view] = await Promise.all([
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../src/i18n/i18n.js', import.meta.url), 'utf8'),
        readFile(new URL('../src/ui/views/comparison-view.js', import.meta.url), 'utf8')
    ]);
    assert.match(html, /Indiquez votre kilométrage mensuel\. kWhiz estime le coût de chaque formule, abonnement compris/);
    assert.match(html, /data-i18n="comparison\.controls\.editProfile"[^>]*>Modifier mon profil/);
    assert.match(i18n, /Enter your monthly mileage\. kWhiz estimates each plan’s cost, including the subscription/);
    assert.match(i18n, /'comparison\.controls\.editProfile': 'Edit my profile'/);
    assert.match(view, /Estimated cost/);
    assert.match(view, /Subscription does not break even/);
});

test('app transmet la référence tarifaire aux données comparées', async () => {
    const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
    assert.match(app, /ref:\s+formula\.ref,/);
});

test('les dernières règles mobiles empêchent le débordement et empilent le coût sous l’identité', async () => {
    const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
    const mobileStart = css.lastIndexOf('@media (max-width: 700px)');
    const mobileEnd = css.indexOf('@media (max-width: 390px)', mobileStart);
    const mobile = css.slice(mobileStart, mobileEnd);
    assert.match(mobile, /grid-template-columns:\s*minmax\(0, 1fr\) 18px/);
    assert.match(mobile, /"identity chevron"\s*"price chevron"\s*"meta chevron"/);
    assert.match(mobile, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(mobile, /\.compare-item > \*[\s\S]*min-width:\s*0/);
    assert.match(mobile, /max-width:\s*100%/);
    assert.match(mobile, /flex-wrap:\s*wrap/);
    assert.match(mobile, /overflow-wrap:\s*anywhere/);
});

test('la carte de consommation cesse d’être sticky uniquement dans Comparer', async () => {
    const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
    assert.match(css, /body\[data-view="compare"\] \.sticky-top\s*\{\s*position:\s*static;/);
    assert.doesNotMatch(css, /body\[data-view="profile"\] \.sticky-top[\s\S]*position:\s*static/);
});
