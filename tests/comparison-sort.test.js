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
    assert.match(list.innerHTML, /compare-item compare-detail-btn compare-item--best[\s\S]*Formule avec abonnement/);
    assert.match(list.innerHTML, /9,99 €\/mois/);
});

test('les offres ex æquo au centime sont toutes deux mises en avant', () => {
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
    assert.equal((list.innerHTML.match(/compare-gap is-lowest/g) || []).length, 2);
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

test('le rendu montre le prix payé à la borne et le coût calculé avec ChargeBack', () => {
    const list = { innerHTML: '', onclick: null, onkeydown: null };
    globalThis.document = { getElementById: id => id === 'ranking-list' ? list : { textContent: '' }, dispatchEvent: () => true };
    const plan = formula('ChargeBack', { rate: 0.125, rateRaw: 0.25, chargebackRate: 0.125, ref: 0.50, monthlyCost: 5, opKey: 'atlante', chargebackConfig: { enabled: true, beforeDate: '2026-07-01', rateBefore: 1, rateAfter: 1, promoEndDate: '2026-12-31', rateAfterPromo: 0.5, sessionsPerMonth: 4 } });
    const expected = buildComparisonRanking([plan], profile)[0].estimatedMonthlyCost;
    setLanguage('fr', { persist: false, translate: false });
    renderComparisonTable([plan], profile);
    assert.match(list.innerHTML, new RegExp(expected.toFixed(2).replace('.', ',')));
    // Le tarif affiché est celui payé à la borne ; le détail du ChargeBack est dans la fiche.
    assert.match(list.innerHTML, /compare-rate-summary">0,25\s€\/kWh/);
    assert.doesNotMatch(list.innerHTML, /4 sessions|tarif public|compare-benefit|compare-chargeback-note/);
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
    assert.match(list.innerHTML, /class="compare-item compare-detail-btn[^"]*"[^>]*data-detail="accessible::Accessible"/);
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

test('un abonnement mensuel est présenté sans engagement en français et en anglais', () => {
    const monthly = formula('Mensuel', { rate: 0.30, ref: 0.50, cost: 9.99, period: PERIOD.MONTHLY, monthlyCost: 9.99 });
    assert.equal(subscriptionLabel(monthly, 'fr'), '9,99 €/mois · Sans engagement');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(subscriptionLabel(monthly, 'en'), '€9.99/month · No commitment');
    setLanguage('fr', { persist: false, translate: false });
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

test('le seuil de rentabilité quitte la liste et reste dans le détail', async () => {
    const list = { innerHTML: '', onclick: null, onkeydown: null };
    globalThis.document = { getElementById: id => id === 'ranking-list' ? list : { textContent: '' }, dispatchEvent: () => true };
    const subscribed = formula('Abonnement', { rate: 0.30, ref: 0.50, monthlyCost: 5, km: 600 });
    setLanguage('fr', { persist: false, translate: false });
    renderComparisonTable([subscribed, formula('Sans abonnement', { rate: 0.50 })], profile);
    assert.doesNotMatch(list.innerHTML, /rentabilisé|compare-meta-threshold|Le seuil indique/);
    assert.equal(profileThresholdLabel({ ...subscribed, adjustedThresholdKm: 600 }, 100, 'fr'), 'Abonnement rentabilisé dès 600 km/mois');
    const detail = await readFile(new URL('../src/ui/views/offer-detail-view.js', import.meta.url), 'utf8');
    assert.match(detail, /offerDetailThresholdLabel|breakEven|threshold/i);
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
    assert.equal(subscriptionBenefitLabel({ monthlyCost: 5, fastKwh: 100, subscriptionBenefit: null }, 'fr'), 'Non calculé : pas de tarif sans abonnement fixe');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(subscriptionBenefitLabel({ monthlyCost: 5, fastKwh: 100, subscriptionBenefit: null }, 'en'), 'Not calculated: no fixed no-subscription price');
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

test('Offres reprend le kilométrage du profil et les anciens tris ont disparu', async () => {
    const [html, controller, view] = await Promise.all([
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../src/ui/controllers/profile-controls.js', import.meta.url), 'utf8'),
        readFile(new URL('../src/ui/views/comparison-view.js', import.meta.url), 'utf8')
    ]);
    assert.doesNotMatch(html, /id="compare-km"|id="compare-profile-link"|Trier par|costPer100km|monthlyCost/);
    // Seuls sélecteurs autorisés : le choix du modèle de véhicule (Mon profil et premier lancement).
    assert.deepEqual(html.match(/<select[^>]*>/g), ['<select class="vehicle-model-select" id="vehicle-model">', '<select class="landing-select" id="landing-car-select">']);
    assert.match(controller, /getMonthlyKm/);
    assert.match(controller, /setMonthlyKm/);
    assert.doesNotMatch(view, /currentSort|nextSortDirection|compare-sort-select/);
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

test('Offres propose deux vues, par prix et par réseau, en FR et EN', async () => {
    const [html, i18n, app] = await Promise.all([
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../src/i18n/i18n.js', import.meta.url), 'utf8'),
        readFile(new URL('../app.js', import.meta.url), 'utf8')
    ]);
    assert.match(html, /<h2 data-i18n="comparison\.heading\.title" id="compare-title">Offres<\/h2>/);
    assert.match(html, /data-offers-mode="price"[\s\S]*data-offers-mode="network"/);
    assert.match(html, /id="offers-by-network"[\s\S]*id="operators-compact"/);
    assert.match(i18n, /'offers\.mode\.network': 'By network'/);
    assert.match(app, /document\.getElementById\('offers-by-network'\)\.hidden = !byNetwork;/);
    assert.match(i18n, /comparison\.estimatedCost/);
    assert.match(i18n, /comparison\.notProfitable/);
});

test('app transmet la référence tarifaire aux données comparées', async () => {
    const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
    assert.match(app, /ref:\s+formula\.ref,/);
});

test('les lignes d’Offres tiennent en largeur : nom compressible, coût insécable', async () => {
    const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
    assert.match(css, /#tab-ranking \.compare-item \{ display:grid; grid-template-columns:20px 32px minmax\(0, 1fr\) auto;/);
    assert.match(css, /#tab-ranking \.compare-identity \{ display:flex; flex-direction:column; gap:3px; min-width:0; \}/);
    assert.match(css, /#tab-ranking \.compare-cost strong \{[^}]*white-space:nowrap/);
});

test('Mon offre et Offres partagent la même ligne de profil au-dessus de leur contenu', async () => {
    const [css, html] = await Promise.all([
        readFile(new URL('../styles.css', import.meta.url), 'utf8'),
        readFile(new URL('../index.html', import.meta.url), 'utf8')
    ]);
    const stickyStart = html.indexOf('<div class="sticky-top" id="sticky-top">');
    const stickyEnd = html.indexOf('</div><!-- /sticky-top -->', stickyStart);
    const compareStart = html.indexOf('<div class="tab-content" id="tab-ranking">');
    const profileStart = html.indexOf('<div class="tab-content active" id="tab-profile">');
    assert.ok(stickyStart >= 0 && stickyEnd > stickyStart);
    assert.match(html.slice(stickyStart, stickyEnd), /id="profile-summary"/);
    assert.ok(stickyEnd < compareStart && stickyEnd < profileStart);
    assert.equal((html.match(/id="sticky-top"/g) || []).length, 1);
    assert.match(css, /\.sticky-top\s*\{[\s\S]*?position:\s*sticky;/);
    assert.match(css, /\.bottom-nav\s*\{[\s\S]*?position:\s*fixed/);
});
