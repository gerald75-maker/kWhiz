import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PERIOD, calculateBreakeven, chargebackBreakeven, computeProfileMonthlyCost } from '../src/domain/pricing.js';
import { initProfileControls } from '../src/ui/controllers/profile-controls.js';
import { formatTariffsVerifiedOn, setLanguage } from '../src/i18n/i18n.js';
import {
    adjustedThreshold,
    buildComparisonRanking,
    comparisonGapLabel,
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
        })[id] || null,
        dispatchEvent: () => true
    };
    const formulas = [
        formula('Sans abonnement', { rate: 0.60, opKey: 'sans' }),
        formula('Formule avec abonnement', { rate: 0.20, ref: 0.60, monthlyCost: 9.99, opKey: 'avec' })
    ];

    setLanguage('fr', { persist: false, translate: false });
    assert.doesNotThrow(() => renderComparisonTable(formulas, profile));
    assert.equal((list.innerHTML.match(/compare-item--best/g) || []).length, 1);
    assert.match(list.innerHTML, /compare-item compare-item--best[\s\S]*Formule avec abonnement/);
    assert.match(list.innerHTML, /9,99 €\/mois/);
});

test('les offres ex æquo au centime portent aussi le libellé Meilleur coût', () => {
    const list = { innerHTML: '', onclick: null, onkeydown: null };
    globalThis.document = { getElementById: id => id === 'ranking-list' ? list : { textContent: '' }, dispatchEvent: () => true };
    const formulas = [
        formula('Première', { rate: 0.40, opKey: 'first' }),
        formula('Ex æquo', { rate: 0.40, opKey: 'tie' }),
        formula('Plus chère', { rate: 0.60, opKey: 'high' })
    ];
    setLanguage('fr', { persist: false, translate: false });
    renderComparisonTable(formulas, profile);
    assert.equal((list.innerHTML.match(/compare-item--best/g) || []).length, 2);
    assert.equal((list.innerHTML.match(/Meilleur coût/g) || []).length, 2);
});

test('les dates et notes quittent les cartes et restent disponibles dans le détail', async () => {
    const list = { innerHTML: '', onclick: null, onkeydown: null };
    globalThis.document = {
        getElementById: id => id === 'ranking-list' ? list : { textContent: '' },
        dispatchEvent: () => true
    };
    const formulas = [formula('Formule datée', { rate: 0.40, opKey: 'datee', verifiedAt: '2026-07-27', note: 'Note documentaire complète' })];

    setLanguage('fr', { persist: false, translate: false });
    renderComparisonTable(formulas, profile);
    assert.doesNotMatch(list.innerHTML, /Vérifié le 27 juillet 2026|Note documentaire complète|compare-verified|compare-note/);

    setLanguage('en', { persist: false, translate: false });
    renderComparisonTable(formulas, profile);
    assert.doesNotMatch(list.innerHTML, /Verified on 27 July 2026|Note documentaire complète|compare-verified|compare-note/);
    const detail = await readFile(new URL('../src/ui/views/offer-detail-view.js', import.meta.url), 'utf8');
    assert.match(detail, /formatTariffsVerifiedOn\(formula\.verifiedAt\)/);
    assert.match(detail, /formula-detail-note/);
});

test('calcule l’écart depuis le coût classé et localise égalités et valeurs indisponibles', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(comparisonGapLabel(45, 45, 'fr'), 'Meilleur coût');
    assert.equal(comparisonGapLabel(45.004, 45, 'fr'), 'Meilleur coût');
    assert.equal(comparisonGapLabel(47.51, 45, 'fr'), '+2,51 € par rapport à la meilleure');
    assert.equal(comparisonGapLabel(Infinity, 45, 'fr'), 'Coût non calculable');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(comparisonGapLabel(45, 45, 'en'), 'Lowest cost');
    assert.equal(comparisonGapLabel(47.51, 45, 'en'), '€2.51 more than the lowest');
    assert.equal(comparisonGapLabel(Infinity, 45, 'en'), 'Cost unavailable');
});

test('les badges et libellés de Comparer sont structurés et suivent la langue sans MutationObserver', () => {
    const list = { innerHTML: '', onclick: null, onkeydown: null };
    globalThis.document = {
        getElementById: id => id === 'ranking-list' ? list : { textContent: '' },
        dispatchEvent: () => true
    };
    const formulas = [
        formula('Variable', { rate: 0.4, pricingType: 'station', opKey: 'v' }),
        formula('Plage', { rate: 0.4, rateMin: 0.3, rateMax: 0.5, pricingType: 'range', opKey: 'r' }),
        formula('Remise', { rate: 0.3, pricingType: 'discount', opKey: 'd' }),
        formula('Fixe', { rate: 0.4, pricingType: 'fixed', opKey: 'f' })
    ];
    setLanguage('fr', { persist: false, translate: false });
    renderComparisonTable(formulas, profile);
    assert.match(list.innerHTML, /compare-pricing-badge[^>]*>(?:Tarif variable|Plage tarifaire|Remise|Tarif fixe)</);
    setLanguage('en', { persist: false, translate: false });
    renderComparisonTable(formulas, profile);
    assert.match(list.innerHTML, /compare-pricing-badge[^>]*>(?:Variable price|Price range|Discount|Fixed price)</);
    assert.doesNotMatch(list.innerHTML, /compare-pricing-badge[^>]*>(?:Tarif variable|Plage tarifaire|Remise|Tarif fixe)</);
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
    setLanguage('fr', { persist: false, translate: false });
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

test('le rendu résume ChargeBack et conserve exactement le coût calculé', () => {
    const list = { innerHTML: '', onclick: null, onkeydown: null };
    globalThis.document = { getElementById: id => id === 'ranking-list' ? list : { textContent: '' }, dispatchEvent: () => true };
    const plan = formula('ChargeBack', { rate: 0.25, ref: 0.50, monthlyCost: 5, opKey: 'atlante', chargebackConfig: { enabled: true } });
    const expected = buildComparisonRanking([plan], profile)[0].estimatedMonthlyCost;
    setLanguage('fr', { persist: false, translate: false });
    renderComparisonTable([plan], profile);
    assert.match(list.innerHTML, new RegExp(expected.toFixed(2).replace('.', ',')));
    assert.match(list.innerHTML, /ChargeBack estimé inclus/);
    assert.doesNotMatch(list.innerHTML, /4 sessions|tarif public|compare-benefit/);
});

test('le bouton Détails ouvre la fenêtre existante au clic et au clavier', () => {
    const list = { innerHTML: '', onclick: null, onkeydown: null };
    globalThis.document = { getElementById: id => id === 'ranking-list' ? list : { textContent: '' }, dispatchEvent: () => true };
    const plan = formula('Accessible', { rate: 0.40, opKey: 'accessible' });
    const calls = [];
    renderComparisonTable([plan], { ...profile, onDetail: (formulaValue, trigger) => calls.push([formulaValue, trigger]) });
    const card = { dataset: { detail: 'accessible::Accessible' } };
    const target = { closest: selector => selector === '[data-detail]' ? card : null };
    list.onclick({ target });
    let prevented = false;
    list.onkeydown({ key: 'Enter', target, preventDefault() { prevented = true; } });
    assert.equal(calls.length, 2);
    assert.equal(calls[0][0], plan);
    assert.equal(calls[0][1], card);
    assert.equal(prevented, true);
    assert.match(list.innerHTML, /class="compare-detail-btn"[^>]*data-detail="accessible::Accessible"/);
    assert.match(list.innerHTML, /aria-label="Voir le détail/);
});

test('un abonnement annuel conserve son prix officiel et son équivalent mensuel', () => {
    setLanguage('fr', { persist: false, translate: false });
    const annualResult = calculateBreakeven({ rate: 0.30, ref: 0.50, cost: 60, period: PERIOD.ANNUAL }, 0.18);
    const annual = formula('Annuel', { rate: 0.30, ref: 0.50, cost: 60, period: PERIOD.ANNUAL, monthlyCost: annualResult.monthlyCost, km: annualResult.km });
    const ranked = buildComparisonRanking([annual], profile)[0];
    assert.equal(ranked.estimatedMonthlyCost, 59);
    assert.equal(subscriptionLabel(annual, 'fr'), '60,00 €/an, soit 5,00 €/mois');
});

test('ajuste le seuil à la part rapide et traite une part rapide nulle', () => {
    setLanguage('fr', { persist: false, translate: false });
    const subscribed = formula('Abonnement', { rate: 0.30, ref: 0.50, monthlyCost: 5, km: 600 });
    const adjusted = { ...subscribed, adjustedThresholdKm: adjustedThreshold(subscribed.km, 40) };
    assert.equal(adjusted.adjustedThresholdKm, 1500);
    assert.equal(profileThresholdLabel(adjusted, 40, 'fr'), 'Abonnement rentabilisé dès 1 500 km/mois au total, soit 600 km rechargés sur bornes rapides');
    assert.equal(adjustedThreshold(subscribed.km, 0), Infinity);
    assert.equal(profileThresholdLabel({ ...subscribed, adjustedThresholdKm: Infinity }, 0, 'fr'), 'Abonnement non pertinent sans recharge rapide');
});

test('affiche une seule explication du seuil pertinent et la masque lorsqu’il disparaît', () => {
    const list = { innerHTML: '', onclick: null, onkeydown: null };
    const explanation = { hidden: true, textContent: '' };
    globalThis.document = {
        getElementById: id => ({
            'ranking-list': list,
            'compare-threshold-explanation': explanation
        })[id] || { textContent: '' },
        dispatchEvent: () => true
    };
    const subscribed = formula('Abonnement', { rate: 0.30, ref: 0.50, monthlyCost: 5, km: 600 });
    const withoutSubscription = formula('Sans abonnement', { rate: 0.50 });

    setLanguage('fr', { persist: false, translate: false });
    renderComparisonTable([subscribed, withoutSubscription], profile);
    assert.equal(explanation.hidden, false);
    assert.equal(explanation.textContent, 'Le seuil indique à partir de quel kilométrage l’abonnement devient avantageux par rapport à l’offre sans abonnement du même réseau, selon votre profil. Il ne signifie pas nécessairement que cette formule est la moins chère de kWhiz.');
    assert.match(list.innerHTML, /Abonnement rentabilisé dès 600 km\/mois/);
    assert.equal((list.innerHTML.match(/Le seuil indique/g) || []).length, 0);

    setLanguage('en', { persist: false, translate: false });
    renderComparisonTable([subscribed, withoutSubscription], profile);
    assert.equal(explanation.hidden, false);
    assert.equal(explanation.textContent, 'The threshold shows the monthly mileage from which the subscription becomes cheaper than the same network’s no-subscription plan, based on your profile. It does not necessarily mean that this plan is the cheapest in kWhiz.');
    assert.match(list.innerHTML, /Subscription pays for itself from 600 km\/month/);

    renderComparisonTable([withoutSubscription], profile);
    assert.equal(explanation.hidden, true);
    assert.equal(explanation.textContent, '');
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
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(subscriptionBenefitLabel({ monthlyCost: 5, fastKwh: 100, subscriptionBenefit: 8.2 }, 'fr'), 'Vous économisez 8,20 €/mois');
    assert.equal(subscriptionBenefitLabel({ monthlyCost: 5, fastKwh: 100, subscriptionBenefit: 0.2 }, 'fr'), 'Économie inférieure à 0,50 €/mois');
    assert.equal(subscriptionBenefitLabel({ monthlyCost: 5, fastKwh: 100, subscriptionBenefit: -4.1 }, 'fr'), 'L’abonnement vous coûte encore 4,10 €/mois de plus');
    assert.equal(subscriptionBenefitLabel({ monthlyCost: 5, fastKwh: 100, subscriptionBenefit: null }, 'fr'), 'Comparaison au tarif de référence indisponible');
    setLanguage('en', { persist: false, translate: false });
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
    assert.doesNotMatch(view, /const COPY|Tarif variable|Plage tarifaire|Remise|Tarif fixe/);
    assert.match(i18n, /comparison\.estimatedCost/);
    assert.match(i18n, /comparison\.notProfitable/);
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
    assert.match(mobile, /grid-template-columns:\s*minmax\(0, 1fr\) auto/);
    assert.match(mobile, /"identity identity"\s*"price price"\s*"gap detail"\s*"meta meta"/);
    assert.match(mobile, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(mobile, /\.compare-item > \*[\s\S]*min-width:\s*0/);
    assert.match(mobile, /max-width:\s*100%/);
    assert.match(css, /@media \(max-width: 390px\)[\s\S]*compare-meta[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test('la carte de consommation cesse d’être sticky uniquement dans Comparer', async () => {
    const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
    assert.match(css, /body\[data-view="compare"\] \.sticky-top\s*\{\s*position:\s*static;/);
    assert.doesNotMatch(css, /body\[data-view="profile"\] \.sticky-top[\s\S]*position:\s*static/);
});
