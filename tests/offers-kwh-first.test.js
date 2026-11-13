import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PERIOD } from '../src/domain/pricing.js';
import { setLanguage } from '../src/i18n/i18n.js';
import { renderComparisonTable } from '../src/ui/views/comparison-view.js';
import { offerNetworkCardHtml } from '../src/ui/views/profile-view.js';

const profile = { monthlyKm: 1000, consumption: 0.18, fastPercentage: 100, homeRate: 0.20 };

function formula(name, { rate, ref = rate, monthlyCost = 0, cost = monthlyCost, period = monthlyCost ? PERIOD.MONTHLY : PERIOD.NONE, km = monthlyCost ? 1000 : 0, ...extra }) {
    return { name, operator: name, opKey: name.toLowerCase(), rate, ref, monthlyCost, cost, period, km, ...extra };
}

function render(formulas) {
    const list = { innerHTML: '', onclick: null, onkeydown: null };
    const count = { textContent: '' };
    globalThis.document = { getElementById: id => id === 'ranking-list' ? list : id === 'compare-count' ? count : { textContent: '' }, dispatchEvent: () => true };
    setLanguage('fr', { persist: false, translate: false });
    renderComparisonTable(formulas, profile);
    const rows = list.innerHTML.split('<button').slice(1);
    return { rows, count: count.textContent };
}

const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('Offres met le prix du kWh en avant et le coût mensuel en second', () => {
    const { rows, count } = render([formula('Fixe', { rate: 0.25 }), formula('Chère', { rate: 0.60 })]);
    assert.match(rows[0], /<span class="compare-cost"><strong>0,25\s€<span class="compare-unit">\/kWh<\/span><\/strong><span class="compare-gap is-lowest">45,00\s€\/mois<\/span>/);
    assert.match(rows[1], /<strong>0,60\s€<span class="compare-unit">\/kWh<\/span><\/strong><span class="compare-gap">108,00\s€\/mois<\/span>/);
    assert.doesNotMatch(rows.join(''), /Meilleur coût|\+63,00/);
    assert.equal(count, '2 formules, classées par coût mensuel', 'l’ordre du classement est annoncé');
});

test('un tarif fixe n’est pas répété sous le nom de la formule', () => {
    const { rows } = render([formula('Fixe', { rate: 0.25 })]);
    assert.doesNotMatch(rows[0], /compare-rate-summary/);
    assert.match(text(rows[0]), /Fixe · Fixe Sans abonnement/);
});

test('le prix retenu est celui de Mon offre, avec ce qu’il ne dit pas en sous-ligne', () => {
    const { rows } = render([
        formula('ChargeBack', { rate: 0.145, rateRaw: 0.29, chargebackRate: 0.145, ref: 0.29, monthlyCost: 4.99 }),
        formula('Fourchette', { rate: 0.30, rateMin: 0.19, rateMax: 0.41, pricingType: 'range' }),
        formula('Station', { rate: 0.35, pricingType: 'station' })
    ]);
    const byName = name => rows.find(row => row.includes(`${name} · ${name}`));
    assert.match(byName('ChargeBack'), /<strong>≈ 0,145\s€</);
    assert.match(byName('ChargeBack'), /compare-rate-summary">0,29\s€\/kWh à la borne<\/span> · 4,99\s€\/mois/);
    assert.match(byName('Fourchette'), /<strong>≈ 0,30\s€</);
    assert.match(byName('Fourchette'), /compare-rate-summary">0,19\s€–0,41\s€\/kWh</);
    assert.match(byName('Station'), /<strong>≈ 0,35\s€</);
    assert.match(byName('Station'), /Tarif variable/);
});

test('les cartes de Mon offre ne répètent ni l’étiquette ni la ligne de profil', () => {
    setLanguage('fr', { persist: false, translate: false });
    const plan = { operator: 'IECharge', opKey: 'iecharge', name: 'Tarif unique', rate: 0.25, monthlyCost: 0, color: 'iecharge' };
    const reference = offerNetworkCardHtml(plan, { consumption: 0.18, charge: { kwh: 50, fromVehicle: false } });
    assert.match(reference, /Recharge de 50\skWh/);
    assert.equal((reference.match(/50\skWh/g) || []).length, 1, 'la recharge de référence est nommée une seule fois');
    assert.doesNotMatch(reference, /18\skWh/, 'la consommation figure déjà dans la ligne de profil');
    assert.equal((reference.match(/offer-stat-sub/g) || []).length, 0);

    const vehicle = offerNetworkCardHtml(plan, { consumption: 0.18, charge: { kwh: 51.1, fromVehicle: true } });
    assert.match(vehicle, /Recharge 10→80\s%/);
    assert.match(vehicle, /<dd class="offer-stat-sub">51\skWh<\/dd>/, 'avec un modèle, l’énergie de la recharge reste indiquée');
});

test('sans lieu connu, la carte invite à en choisir un au lieu de lister le centre de la France', async () => {
    const [source, html, css] = await Promise.all([
        readFile(new URL('../src/ui/stations-map.js', import.meta.url), 'utf8'),
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../styles.css', import.meta.url), 'utf8')
    ]);
    assert.match(source, /let placeKnown = false;/);
    assert.match(source, /if \(!placeKnown && !routeStationMetrics && !selectedStationId\) \{\s*list\.innerHTML = `<p class="map-empty map-empty--place">\$\{t\('map\.list\.needPlace'\)\}<\/p>`;\s*return;/);
    // Position, ville, zone de recharge, trajet ou carte déplacée : chacun fixe un lieu.
    assert.ok((source.match(/placeKnown = true;/g) || []).length >= 6);
    assert.match(source, /map\.on\('dragstart zoomstart', \(\) => \{\s*placeKnown = true;/);
    assert.match(html, /<h3 id="map-list-title" data-i18n="map\.list\.all">Stations<\/h3>/);
    assert.match(css, /\.map-panel\[data-place="none"\] \.map-sort \{ display:none; \}/);
});
