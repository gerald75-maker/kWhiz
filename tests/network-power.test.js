import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { localizeNetworkDescription, setLanguage } from '../src/i18n/i18n.js';
import { renderOfferDetail } from '../src/ui/views/offer-detail-view.js';
import { renderOperatorsViews } from '../src/ui/views/operators-view.js';

const teslaFrench = 'jusqu’à 250 kW (V3) et 500 kW (V4) · puissance selon le site';
const teslaEnglish = 'up to 250 kW (V3) and 500 kW (V4) · power varies by site';

async function loadCatalog() {
    return JSON.parse(await readFile(new URL('../public/tarifs.json', import.meta.url), 'utf8'));
}

function renderDetail(language, badge) {
    const body = { innerHTML: '' };
    const title = { textContent: '' };
    setLanguage(language, { persist: false, translate: false });
    renderOfferDetail({
        body,
        title,
        formula: {
            operator: 'Réseau test',
            name: 'Formule test',
            badge,
            rate: 0.5,
            cost: 0,
            monthlyCost: 0,
            period: 'none',
            costPer100km: 9,
            km: 0,
            pricingType: 'fixed',
            calculationBasis: 'official',
            chargebackRate: null
        }
    });
    return body.innerHTML;
}

function renderOperator(language, name, badge) {
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
    renderOperatorsViews({
        operators: {
            tested: {
                name,
                color: 'tested',
                badge,
                formulas: [{
                    name: 'Tarif unique',
                    cost: 0,
                    period: 'none',
                    rate: 0.5,
                    ref: 0.5,
                    pricingType: 'fixed',
                    calculationBasis: 'official'
                }]
            }
        },
        consumption: 18,
        logos: {}
    });
    return containers.get('operators-compact').children[0].innerHTML;
}

test('le catalogue porte uniquement les nouvelles puissances IZIVIA et Tesla', async () => {
    const catalog = await loadCatalog();
    assert.equal(catalog.iziviafast.badge, '150 kW DC');
    assert.equal(catalog.tesla.badge, teslaFrench);
    assert.equal(catalog.fastned.badge, '300 kW');
    assert.equal(catalog.iziviafast.verifiedAt, '2026-07-27');
    assert.equal(catalog.tesla.verifiedAt, '2026-07-27');
});

test('IZIVIA conserve 150 kW DC dans les deux langues et dans les deux vues', () => {
    assert.match(renderDetail('fr', '150 kW DC'), /Réseau : 150 kW DC/);
    assert.match(renderDetail('en', '150 kW DC'), /Network: 150 kW DC/);
    assert.match(renderOperator('fr', 'IZIVIA Fast chez McDonald’s', '150 kW DC'), /Bornes 150 kW DC/);
    assert.match(renderOperator('en', 'IZIVIA Fast chez McDonald’s', '150 kW DC'), /Chargers 150 kW DC/);
});

test('Tesla conserve la réserve par site et bascule immédiatement en FR et EN', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(localizeNetworkDescription(teslaFrench), teslaFrench);
    assert.match(renderDetail('fr', teslaFrench), new RegExp(`Réseau : ${teslaFrench.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.match(renderOperator('fr', 'Tesla Supercharger', teslaFrench), /puissance selon le site/);

    setLanguage('en', { persist: false, translate: false });
    assert.equal(localizeNetworkDescription(teslaFrench), teslaEnglish);
    assert.match(renderDetail('en', teslaFrench), /Network: up to 250 kW \(V3\) and 500 kW \(V4\) · power varies by site/);
    assert.match(renderOperator('en', 'Tesla Supercharger', teslaFrench), /Chargers up to 250 kW \(V3\) and 500 kW \(V4\) · power varies by site/);
});
