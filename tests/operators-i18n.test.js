import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setLanguage } from '../src/i18n/i18n.js';
import { buildFormulaMeta, formatOperatorPlanCost, formatOperatorSubscription, formatOperatorThreshold, renderOperatorsViews } from '../src/ui/views/operators-view.js';

const base = { name: 'Offre test', cost: 0, period: 'none', rate: 0.39, ref: 0.60, pricingType: 'fixed', calculationBasis: 'official' };

function fakeDocument(openKeys = []) {
    const container = { innerHTML: '', children: [], querySelectorAll: () => openKeys.map(operator => ({ dataset: { operator } })), appendChild(node) { this.children.push(node); } };
    const count = { innerHTML: '' };
    globalThis.document = {
        getElementById: id => id === 'operators-compact' ? container : id === 'operators-page-count' ? count : null,
        createElement: tag => ({ tagName: tag.toUpperCase(), className: '', dataset: {}, innerHTML: '', open: false, addEventListener(type, listener) { this.listener = listener; } }),
        dispatchEvent: () => true
    };
    return { container, count };
}

function render(language, operators, options = {}) {
    setLanguage(language, { persist: false, translate: false });
    const dom = fakeDocument(options.openKeys);
    renderOperatorsViews({ operators, consumption: 18, logos: {}, favorites: options.favorites || new Set(), onDetail: options.onDetail });
    return { ...dom, html: dom.container.children.map(node => node.innerHTML).join('') };
}

test('les helpers historiques restent localisés sans modifier les calculs', () => {
    const formula = { ...base, cost: 9.99, period: 'monthly', verifiedAt: '2026-07-27', sourceUrl: 'https://example.test' };
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(formatOperatorSubscription(formula), '9,99 €/mois');
    assert.equal(formatOperatorThreshold(1050), 'Rentable dès 1 050 km/mois');
    assert.equal(formatOperatorPlanCost(base), 'Sans abonnement');
    assert.match(buildFormulaMeta(formula), /Tarif fixe.*Vérifié le 27 juillet 2026.*Source officielle/);
    setLanguage('en', { persist: false, translate: false });
    assert.equal(formatOperatorSubscription(formula), '€9.99/month');
    assert.equal(formatOperatorThreshold(Infinity), 'Not cost-effective');
});

test('rend un en-tête fermé compact avec singulier/pluriel, carte et sans tarif', () => {
    const single = render('fr', { a: { name: 'Alpha', color: 'alpha', badge: '300 kW', mapUrl: 'https://example.test/map', formulas: [base] } });
    assert.match(single.html, /Alpha.*300 kW · 1 formule.*Carte/s);
    assert.doesNotMatch(single.html.split('</summary>')[0], /0,390|Vérifié|Source officielle/);
    assert.equal(single.container.children[0].tagName, 'DETAILS');
    assert.equal(single.container.children[0].open, false);
    const plural = render('en', { a: { name: 'Alpha', color: 'alpha', formulas: [base, { ...base, name: 'Second' }] } });
    assert.match(plural.html, /2 plans/);
});

test('la liste ouverte couvre prix fixe, plage, variable et abonnements', () => {
    const formulas = [
        base,
        { ...base, name: 'Range', pricingType: 'range', rateMin: 0.39, rateMax: 0.61, rate: 0.50, cost: 4.99, period: 'monthly' },
        { ...base, name: 'Variable', pricingType: 'station', rate: 0.54, cost: 49.99, period: 'annual' }
    ];
    const french = render('fr', { a: { name: 'Alpha', color: 'alpha', formulas } }, { openKeys: ['a'] });
    assert.equal(french.container.children[0].open, true);
    assert.match(french.html, /0,390.*Sans abonnement/s);
    assert.match(french.html, /0,39.*0,61.*4,99.*mois/s);
    assert.match(french.html, /Tarif variable.*49,99.*an.*4,17.*mois/s);
    assert.match(french.html, /Détails/);
    assert.doesNotMatch(french.html, /Vérifié|Source officielle|ChargeBack|formula-note|previousCost/);
});

test('préserve ouverture et favoris pendant la bascule FR/EN', () => {
    const operators = { a: { name: 'Alpha', color: 'alpha', formulas: [base] } };
    const french = render('fr', operators, { openKeys: ['a'], favorites: new Set(['a::Offre test']) });
    assert.equal(french.container.children[0].open, true);
    assert.match(french.html, /Retirer des favoris/);
    const english = render('en', operators, { openKeys: ['a'], favorites: new Set(['a::Offre test']) });
    assert.equal(english.container.children[0].open, true);
    assert.match(english.html, /Remove from favourites/);
    assert.match(english.html, /Details/);
});

test('les compteurs conservent le nombre et l’ordre des formules', () => {
    const operators = { b: { name: 'Beta', color: 'b', formulas: [base] }, a: { name: 'Alpha', color: 'a', formulas: [base, { ...base, name: 'Second' }] } };
    const { count, html } = render('fr', operators);
    assert.equal(count.innerHTML, '<strong>2</strong><span>opérateurs</span><strong>3</strong><span>formules</span>');
    assert.ok(html.indexOf('Alpha') < html.indexOf('Beta'));
    assert.ok(html.indexOf('Offre test') < html.indexOf('Second'));
});

test('la vue Opérateurs est sans tableau horizontal et le détail réutilise la modale existante', async () => {
    const source = await readFile(new URL('../src/ui/views/operators-view.js', import.meta.url), 'utf8');
    const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /<table|tarif-table|operators-detailed/);
    assert.doesNotMatch(index, /id="view-mode"|id="operators-detailed"/);
    assert.match(source, /onDetail\?\.\(detailFormula/);
    const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
    assert.match(app, /onDetail: openFormulaDetail/);
});

test('les styles restent verticaux, compacts à 320 px et accessibles', async () => {
    const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
    assert.match(css, /operator-directory-card/);
    assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\)/);
    assert.match(css, /@media \(max-width: 375px\)/);
    assert.match(css, /operator-directory-summary:focus-visible/);
    assert.match(css, /color:\s*var\(--text-primary\)/);
    assert.match(css, /color:\s*var\(--text-secondary\)/);
});

test('le retour favori est annoncé sans popup et restaure le focus', async () => {
    const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
    const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(index, /class="favorite-feedback"[^>]*id="favorite-status"[^>]*role="status"/);
    assert.match(index, /id="favorite-status"[^>]*aria-live="polite"|aria-live="polite"[^>]*id="favorite-status"/);
    assert.match(app, /favorites\.has\(id\)/);
    assert.match(app, /showFavoriteFeedback/);
    assert.match(app, /favorites\.removed.*favorites\.added/);
    assert.match(app, /dataset\.favoriteId === id\)\?\.focus\(\)/);
    assert.doesNotMatch(app, /alert\([^)]*favorites|openModal\([^)]*favorite/i);

    setLanguage('fr', { persist: false, translate: false });
    const { t } = await import('../src/i18n/i18n.js');
    assert.equal(t('favorites.added'), 'Ajouté aux favoris');
    assert.equal(t('favorites.removed'), 'Retiré des favoris');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(t('favorites.added'), 'Added to favourites');
    assert.equal(t('favorites.removed'), 'Removed from favourites');
});
