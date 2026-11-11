import test from 'node:test';
import assert from 'node:assert/strict';
import { setLanguage, t } from '../src/i18n/i18n.js';
import {
    nearbyFormulas,
    profileAnnualAmount,
    profileMonthlyAmount,
    profileShareStatusLabel,
    profileThresholdLabel,
    profileActionsHtml,
    renderProfileHero,
    renderProfileShortlist,
    renderProfileView,
    whyChoiceHtml
} from '../src/ui/views/profile-view.js';

class FakeElement {
    constructor({ value = '' } = {}) {
        this.value = value;
        this.innerHTML = '';
        this.textContent = '';
        this.hidden = false;
    }
    addEventListener() {}
    querySelectorAll() { return []; }
    querySelector() { return null; }
}

function installDocument(km = 1000) {
    const elements = new Map([
        ['profile-best-card', new FakeElement()],
        ['offer-context', new FakeElement()],
        ['why-sheet-body', new FakeElement()],
        ['profile-shortlist-list', new FakeElement()],
        ['profile-all-offers-label', new FakeElement()],
        ['profile-km', new FakeElement({ value: String(km) })]
    ]);
    globalThis.document = {
        getElementById: id => elements.get(id) || null,
        createElement: () => new FakeElement(),
        dispatchEvent: () => true
    };
    return elements;
}

function formula(name, overrides = {}) {
    return {
        name,
        operator: 'Réseau officiel',
        opKey: name.toLowerCase().replaceAll(' ', '-'),
        color: 'test',
        rate: 0.40,
        rateRaw: 0.40,
        chargebackRate: null,
        cost: 0,
        period: 'none',
        monthlyCost: 0,
        km: 0,
        ...overrides
    };
}

const catalogue = [
    formula('Atlante Go - mensuel', { operator: 'Atlante', opKey: 'atlante', rate: 0.20, rateRaw: 0.20, monthlyCost: 4.99, cost: 4.99, period: 'monthly', km: 600, verifiedAt: '2026-10-19', sourceUrl: 'https://atlante.energy/fr/myatlante-app/' }),
    formula('Tarif unique', { operator: 'IECharge', opKey: 'iecharge', rate: 0.25, rateRaw: 0.25 }),
    formula('Recharge rapide DC', { operator: 'Lidl', opKey: 'lidl', rate: 0.29, rateRaw: 0.29 }),
    formula('Happy Hours - heures creuses', { operator: 'Izivia', opKey: 'iziviafast', rate: 0.30, rateRaw: 0.30 })
];
const paris = {
    label: 'Paris', radiusKm: 20,
    counts: new Map([['atlante', 1], ['lidl', 36], ['iziviafast', 57]]),
    operators: new Set(['atlante', 'iecharge', 'lidl', 'iziviafast'])
};

test('localise les états catalogue vide et kilométrage nul', () => {
    let elements = installDocument(1000);
    setLanguage('en', { persist: false, translate: false });
    renderProfileHero({ formulasData: [], consumption: 0.18, fastPercentage: 100, homeRate: 0.20, logos: {} });
    assert.match(elements.get('profile-best-card').innerHTML, /Loading prices/);

    elements = installDocument(0);
    renderProfileHero({ formulasData: [formula('Tarif unique')], consumption: 0.18, fastPercentage: 100, homeRate: 0.20, logos: {} });
    assert.match(elements.get('profile-best-card').innerHTML, /Enter your monthly mileage/);
    setLanguage('fr', { persist: false, translate: false });
});

test('localise les seuils nul, fini et infini sans modifier leur calcul', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(profileThresholdLabel({ hasSubscription: true, thresholdKm: 0 }), 'Rentable immédiatement');
    assert.equal(profileThresholdLabel({ hasSubscription: true, thresholdKm: 1050 }), '1 050 km/mois');
    assert.equal(profileThresholdLabel({ hasSubscription: true, thresholdKm: Infinity }), 'Jamais rentable');
    assert.equal(profileThresholdLabel({ hasSubscription: true, thresholdKm: Infinity, referenceUnavailable: true }), 'Non calculé');
    assert.equal(profileThresholdLabel({ hasSubscription: false, thresholdKm: 0 }), 'Sans abonnement');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(profileThresholdLabel({ hasSubscription: true, thresholdKm: 0 }), 'Breaks even immediately');
    assert.equal(profileThresholdLabel({ hasSubscription: true, thresholdKm: 1050 }), '1,050 km/month');
    assert.equal(profileThresholdLabel({ hasSubscription: true, thresholdKm: Infinity }), 'Never pays for itself');
    assert.equal(profileThresholdLabel({ hasSubscription: true, thresholdKm: Infinity, referenceUnavailable: true }), 'Not calculated');
});

test('formate exactement les coûts mensuels et annuels avec Intl', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(profileMonthlyAmount(9.99), '9,99 €/mois');
    assert.equal(profileAnnualAmount(119.88), '119,88 € par an');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(profileMonthlyAmount(9.99), '€9.99/month');
    assert.equal(profileAnnualAmount(119.88), '€119.88 per year');
});

test('Mon offre affiche un nom, un prix, les stations proches et deux actions', () => {
    const elements = installDocument(1000);
    setLanguage('fr', { persist: false, translate: false });
    renderProfileView({ formulasData: catalogue, consumption: 0.18, fastPercentage: 100, homeRate: 0.20, logos: {}, mapOperators: ['atlante'], coverage: paris });
    const card = elements.get('profile-best-card').innerHTML;
    assert.equal(elements.get('offer-context').textContent, 'Meilleure offre près de Paris');
    assert.match(card, /Atlante/);
    assert.match(card, /40,99(?: |\s)€/);
    assert.match(card, /offer-coverage--warn[^>]*>.*1 seule station à moins de 20\skm/s);
    assert.match(card, /Souscrire chez Atlante/);
    assert.match(card, /data-map-operator="atlante"/);
    assert.match(card, /data-open-why/);
    assert.doesNotMatch(card, /par an|Pourquoi ce choix \?<\/summary>|<details/);
    assert.equal(elements.get('profile-all-offers-label').textContent, 'Voir les 4 offres');
});

test('avec une ville, seuls les réseaux présents à proximité sont classés', () => {
    assert.deepEqual(nearbyFormulas(catalogue, paris).map(item => item.opKey), ['atlante', 'lidl', 'iziviafast']);
    assert.equal(nearbyFormulas(catalogue, null).length, 4);
    const roaming = formula('Electroverse', { opKey: 'electroverse' });
    assert.equal(nearbyFormulas([roaming], paris).length, 1);
});

test('« Ensuite » montre les deux offres suivantes avec écart et stations', () => {
    const elements = installDocument(1000);
    setLanguage('fr', { persist: false, translate: false });
    renderProfileView({ formulasData: catalogue, consumption: 0.18, fastPercentage: 100, homeRate: 0.20, logos: {}, coverage: paris });
    const next = elements.get('profile-shortlist-list').innerHTML;
    assert.equal((next.match(/class="offer-next-row"/g) || []).length, 2);
    assert.ok(next.indexOf('Lidl') < next.indexOf('Izivia'));
    assert.doesNotMatch(next, /IECharge/);
    assert.match(next, /36 stations proches/);
    assert.match(next, /\+11,21(?: |\s)€/);
    setLanguage('en', { persist: false, translate: false });
    renderProfileView({ formulasData: catalogue, consumption: 0.18, fastPercentage: 100, homeRate: 0.20, logos: {}, coverage: null });
    const english = elements.get('profile-shortlist-list').innerHTML;
    assert.match(english, /IECharge/);
    assert.match(elements.get('profile-best-card').innerHTML, /Enter your town to see nearby chargers/);
    setLanguage('fr', { persist: false, translate: false });
});

test('« Pourquoi ce choix ? » réunit le coût annuel, les prix, l’écart, le seuil et la source', () => {
    setLanguage('fr', { persist: false, translate: false });
    const best = { ...catalogue[0], profileMonthlyCost: 40.99, profileAnnualCost: 491.88, referenceUnavailable: true };
    const second = { ...catalogue[2], profileMonthlyCost: 52.2, profileAnnualCost: 626.4 };
    const html = whyChoiceHtml({ best, second, fastPercentage: 100 });
    assert.match(html, /491,88(?: |\s)€/);
    assert.match(html, /sur 12 mois/);
    assert.match(html, /Prix à la borne/);
    assert.match(html, /Face à Lidl/);
    assert.match(html, /134,52(?: |\s)€ de moins par an/);
    assert.match(html, /Seuil de rentabilité[\s\S]*Non calculé/);
    assert.match(html, /Vérifié le 19 octobre 2026\./);
    assert.match(html, /href="https:\/\/atlante\.energy\/fr\/myatlante-app\/"/);
    const reversed = whyChoiceHtml({ best, second: { ...second, profileAnnualCost: 400 }, fastPercentage: 100 });
    assert.match(reversed, /why-warn[^>]*>91,88(?: |\s)€ de plus par an/);
});

test('les messages de partage sont localisés', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(profileShareStatusLabel('copied'), 'Résultat copié dans le presse-papiers.');
    assert.equal(profileShareStatusLabel('shared'), 'Résultat partagé.');
    assert.equal(profileShareStatusLabel('unavailable'), 'Partage impossible sur cet appareil.');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(profileShareStatusLabel('copied'), 'Result copied to the clipboard.');
    assert.equal(profileShareStatusLabel('shared'), 'Result shared.');
    assert.equal(profileShareStatusLabel('unavailable'), 'Sharing is unavailable on this device.');
});

test('l’offre n°1 propose la page officielle et les bornes du réseau', () => {
    setLanguage('fr', { persist: false, translate: false });
    const atlante = { operator: 'Atlante', opKey: 'atlante', monthlyCost: 4.99, sourceUrl: 'https://atlante.energy/fr/myatlante-app/', mapUrl: 'https://atlante.energy/fr/#mapsBlock' };
    const html = profileActionsHtml(atlante, { mapOperators: ['atlante'] });
    assert.match(html, /href="https:\/\/atlante\.energy\/fr\/myatlante-app\/" target="_blank" rel="noopener noreferrer">Souscrire chez Atlante/);
    assert.match(html, /data-map-operator="atlante"[^>]*>.*Bornes Atlante sur la carte/);

    const iecharge = { operator: 'IECharge', opKey: 'iecharge', monthlyCost: 0, sourceUrl: 'https://example.org/tarifs' };
    assert.match(profileActionsHtml(iecharge, { mapOperators: ['iecharge'] }), /Voir l’offre chez IECharge/);

    const powerdot = { operator: 'Powerdot', opKey: 'powerdot', monthlyCost: 1.99, sourceUrl: 'https://powerdot.fr', mapUrl: 'https://powerdot.fr/carte' };
    const external = profileActionsHtml(powerdot, { mapOperators: ['atlante'] });
    assert.match(external, /href="https:\/\/powerdot\.fr\/carte"[^>]*>.*Carte des bornes Powerdot/);
    assert.doesNotMatch(external, /data-map-operator/);

    assert.equal(profileActionsHtml({ operator: 'X', opKey: 'x', monthlyCost: 0, sourceUrl: 'javascript:alert(1)' }), '');
    setLanguage('en', { persist: false, translate: false });
    assert.match(profileActionsHtml(atlante, { mapOperators: ['atlante'] }), /Subscribe with Atlante.*Atlante chargers on the map/s);
    setLanguage('fr', { persist: false, translate: false });
});

test('chaque réseau proposé sur la carte possède des stations IRVE', async () => {
    const { readFile } = await import('node:fs/promises');
    const { MAP_OPERATOR_KEYS } = await import('../src/config/app-config.js');
    const irve = JSON.parse(await readFile(new URL('../public/irve-fast.json', import.meta.url), 'utf8'));
    const present = new Set(irve.stations.map(station => station.operator));
    for (const key of MAP_OPERATOR_KEYS) assert.ok(present.has(key), `${key} absent de irve-fast.json`);
});
