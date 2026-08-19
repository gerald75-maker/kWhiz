import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setLanguage } from '../src/i18n/i18n.js';
import {
    offerDetailPricingLabel,
    offerDetailSubscriptionLabel,
    offerDetailThresholdLabel,
    renderOfferDetail
} from '../src/ui/views/offer-detail-view.js';

function formula(overrides = {}) {
    return {
        operator: 'Opérateur Officiel',
        name: 'Formule Signature',
        opKey: 'official',
        rate: 0.49,
        cost: 0,
        monthlyCost: 0,
        period: 'none',
        costPer100km: 8.82,
        km: 0,
        pricingType: 'fixed',
        calculationBasis: 'official',
        chargebackRate: null,
        verifiedAt: '2026-08-06',
        validUntil: null,
        sourceUrl: 'https://example.test/source',
        mapUrl: 'https://example.test/map',
        badge: '300 kW',
        note: 'Tarif national direct confirmé par IECharge.',
        ...overrides
    };
}

function render(currentFormula) {
    const body = { innerHTML: '' };
    const title = { textContent: '' };
    renderOfferDetail({
        body,
        title,
        formula: currentFormula,
        evolution: { state: 'unknown', deltaRate: 0 }
    });
    return { body, title };
}

test('rend une offre sans abonnement en français et en anglais sans traduire son identité', () => {
    const currentFormula = formula({ validUntil: '2026-08-31', calculationBasis: 'estimate' });
    setLanguage('fr', { persist: false, translate: false });
    const french = render(currentFormula);
    assert.match(french.body.innerHTML, /Prix de l’énergie/);
    assert.match(french.body.innerHTML, /Sans abonnement/);
    assert.match(french.body.innerHTML, /Sans seuil/);
    assert.match(french.body.innerHTML, /Vérifié le 6 août 2026/);
    assert.match(french.body.innerHTML, /Conditions valables jusqu’au 31\/08\/2026/);
    assert.match(french.body.innerHTML, /une estimation, pas un prix garanti/);
    assert.match(french.body.innerHTML, /Tarif national direct confirmé par IECharge\./);

    setLanguage('en', { persist: false, translate: false });
    const english = render(currentFormula);
    assert.match(english.body.innerHTML, /Energy price/);
    assert.match(english.body.innerHTML, /No subscription/);
    assert.match(english.body.innerHTML, /No break-even point/);
    assert.match(english.body.innerHTML, /Verified on 6 August 2026/);
    assert.match(english.body.innerHTML, /Terms valid until 31\/08\/2026/);
    assert.match(english.body.innerHTML, /an estimate, not a guaranteed price/);
    assert.match(english.body.innerHTML, /Nationwide direct price confirmed by IECharge\./);
    assert.match(english.body.innerHTML, /Opérateur Officiel/);
    assert.match(english.body.innerHTML, /Formule Signature/);
    assert.doesNotMatch(english.body.innerHTML, /Prix de l’énergie|Vérifié le|Consulter la source officielle|Voir les bornes de l’opérateur/);
});

test('localise les abonnements mensuel et annuel avec leur équivalent mensuel', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.match(offerDetailSubscriptionLabel(formula({ cost: 9.99, monthlyCost: 9.99, period: 'monthly' })), /9,99 €\/mois/);
    assert.match(offerDetailSubscriptionLabel(formula({ cost: 60, monthlyCost: 5, period: 'annual' })), /60,00 €\/an, soit 5,00 €\/mois/);

    setLanguage('en', { persist: false, translate: false });
    assert.equal(offerDetailSubscriptionLabel(formula({ cost: 9.99, monthlyCost: 9.99, period: 'monthly' })), '€9.99/month');
    assert.equal(offerDetailSubscriptionLabel(formula({ cost: 60, monthlyCost: 5, period: 'annual' })), '€60.00/year, equivalent to €5.00/month');
});

test('traite les seuils fini, nul et infini dans les deux langues', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(offerDetailThresholdLabel(0), 'Sans seuil');
    assert.equal(offerDetailThresholdLabel(Infinity), 'Non rentable');
    assert.equal(offerDetailThresholdLabel(1050), '1 050 km/mois');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(offerDetailThresholdLabel(0), 'No break-even point');
    assert.equal(offerDetailThresholdLabel(Infinity), 'Not cost-effective');
    assert.equal(offerDetailThresholdLabel(1050), '1,050 km/month');
    assert.equal(offerDetailThresholdLabel(Infinity, { referenceUnavailable: true }), 'Variable reference · break-even not calculated');
});

test('localise les tarifs fixe, variable, plage et remise avec Intl', () => {
    setLanguage('en', { persist: false, translate: false });
    assert.equal(offerDetailPricingLabel(formula()), '€0.490/kWh');
    assert.equal(offerDetailPricingLabel(formula({ pricingType: 'station' })), 'Variable price · estimated €0.490/kWh');
    assert.equal(offerDetailPricingLabel(formula({ pricingType: 'range', rateMin: 0.39, rateMax: 0.69 })), '€0.39–€0.69/kWh');
    assert.equal(offerDetailPricingLabel(formula({ pricingType: 'discount', rateMin: 0.39, rateMax: 0.69, discountPerKwh: 0.10 })), '€0.10/kWh discount · €0.39–€0.69/kWh');
});

test('un changement de langue rerend le détail en place sans remplacer ses éléments', () => {
    const body = { innerHTML: '' };
    const title = { textContent: '' };
    const bodyReference = body;
    const titleReference = title;
    const currentFormula = formula({ cost: 9.99, monthlyCost: 9.99, period: 'monthly', km: 850, badge: 'jusqu’à 50 kW DC' });
    setLanguage('fr', { persist: false, translate: false });
    renderOfferDetail({ body, title, formula: currentFormula });
    assert.match(body.innerHTML, /Abonnement/);
    assert.match(body.innerHTML, /Réseau : jusqu’à 50 kW DC/);
    setLanguage('en', { persist: false, translate: false });
    renderOfferDetail({ body, title, formula: currentFormula });
    assert.match(body.innerHTML, /Subscription/);
    assert.match(body.innerHTML, /Network: up to 50 kW DC/);
    assert.doesNotMatch(body.innerHTML, /jusqu’à/);
    assert.equal(title.textContent, 'Opérateur Officiel - Formule Signature');
    assert.equal(body, bodyReference);
    assert.equal(title, titleReference);
});

test('rend IECharge une seule fois avec sa date de vérification propre', () => {
    setLanguage('fr', { persist: false, translate: false });
    const currentFormula = formula({
        operator: 'IECharge', name: 'Tarif unique', opKey: 'iecharge', rate: 0.25,
        verifiedAt: '2026-07-27', sourceUrl: 'https://iecharge.io/fr/prix/'
    });
    const body = { innerHTML: '' };
    const title = { textContent: '' };
    renderOfferDetail({
        body,
        title,
        formula: currentFormula,
        historyEntries: [{ rate: 0.25, cost: 0, period: 'none', verifiedAt: '2026-07-27' }],
        evolution: { state: 'unknown', deltaRate: 0 }
    });
    assert.match(body.innerHTML, /Vérifié le 27 juillet 2026/);
    assert.match(body.innerHTML, /27 juil\. 2026<\/time><strong>0,250[^<]*€\/kWh<\/strong>/);
    assert.equal((body.innerHTML.match(/27 juil\. 2026/g) || []).length, 1);
    assert.doesNotMatch(body.innerHTML, /6 août 2026/);
    assert.match(body.innerHTML, /https:\/\/iecharge\.io\/fr\/prix\//);
});

test('le cycle modal existant reste branché au détail et les anciennes phrases ne pilotent plus son rendu', async () => {
    const [appSource, html, viewSource] = await Promise.all([
        readFile(new URL('../app.js', import.meta.url), 'utf8'),
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../src/ui/views/offer-detail-view.js', import.meta.url), 'utf8')
    ]);
    assert.match(appSource, /openModal\('formula-detail-overlay', trigger\)/);
    assert.match(appSource, /renderCurrentFormulaDetail\(\)/);
    assert.match(html, /id="formula-detail-close"/);
    assert.match(html, /data-i18n-aria-label="offerDetail\.closeLabel"/);
    assert.match(viewSource, /t\('offerDetail\./);
    assert.doesNotMatch(viewSource, />Prix de l’énergie<|>Abonnement<|>Coût estimé<|>Seuil de rentabilité</);
});

test('le groupe de badges du détail est neutre et les badges individuels restent flexibles', async () => {
    const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
    assert.match(css, /\.formula-detail-badges\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap[^}]*border:\s*0[^}]*background:\s*transparent/);
    assert.match(css, /\.detail-badge\s*\{[^}]*border:\s*1px/);
    assert.doesNotMatch(css, /\.formula-detail-badges\s*\{[^}]*overflow-x/);
});
