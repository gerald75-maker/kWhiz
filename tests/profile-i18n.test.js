import test from 'node:test';
import assert from 'node:assert/strict';
import { setLanguage, t } from '../src/i18n/i18n.js';
import {
    nearbyFormulas,
    profileAnnualAmount,
    profileMonthlyAmount,
    profileShareStatusLabel,
    profileThresholdLabel,
    chargeSize,
    offerNetworkNote,
    subscriptionPayback,
    topNetworks,
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
        ['offer-trio', new FakeElement()],
        ['offer-month', new FakeElement()],
        ['offer-intro', new FakeElement()],
        ['offer-context', new FakeElement()],
        ['why-sheet-body', new FakeElement()],
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
    renderProfileView({ formulasData: [], consumption: 0.18, fastPercentage: 100, homeRate: 0.20, logos: {} });
    assert.match(elements.get('offer-trio').innerHTML, /Loading prices/);
    assert.equal(elements.get('offer-month').hidden, true);

    elements = installDocument(0);
    renderProfileView({ formulasData: [formula('Tarif unique')], consumption: 0.18, fastPercentage: 100, homeRate: 0.20, logos: {} });
    assert.match(elements.get('offer-trio').innerHTML, /Enter your monthly mileage/);
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

test('Mon offre montre trois réseaux à égalité : prix au kWh, recharge, 100 km et abonnement', () => {
    const elements = installDocument(1000);
    setLanguage('fr', { persist: false, translate: false });
    renderProfileView({ formulasData: catalogue, consumption: 0.18, fastPercentage: 100, homeRate: 0.20, logos: {}, mapOperators: ['atlante', 'lidl'], coverage: paris, vehicle: { usableKwh: 70 } });
    const trio = elements.get('offer-trio').innerHTML;
    assert.equal(elements.get('offer-context').textContent, 'Vos 3 réseaux les moins chers près de Paris');
    assert.equal((trio.match(/<article class="offer-net/g) || []).length, 3);
    assert.ok(trio.indexOf('Atlante') < trio.indexOf('Lidl') && trio.indexOf('Lidl') < trio.indexOf('Izivia'));
    assert.doesNotMatch(trio, /IECharge/);
    // Atlante : 0,20 €/kWh, recharge 10 → 80 % de 70 kWh = 49 kWh = 9,80 €, 18 kWh aux 100 km = 3,60 €.
    assert.match(trio, /0,20(?: |\s)€/);
    assert.match(trio, /Recharge 10→80\s%[\s\S]*9,80(?: |\s)€[\s\S]*49\skWh/);
    assert.match(trio, /Aux 100\skm[\s\S]*3,60(?: |\s)€/);
    assert.match(trio, /Abonnement[\s\S]*4,99(?: |\s)€[\s\S]*par mois/);
    assert.match(trio, /offer-net-stations--warn">1 seule station à 20\skm/);
    assert.match(trio, /36 stations à 20\skm/);
    assert.match(trio, /data-map-operator="atlante"/);
    assert.match(trio, /data-detail="atlante::Atlante Go - mensuel"/);
    assert.doesNotMatch(trio, /\/mois<\/span>|Souscrire/);
    assert.equal(elements.get('profile-all-offers-label').textContent, 'Voir les 4 offres');
});

test('avec une ville, seuls les réseaux présents à proximité sont classés', () => {
    assert.deepEqual(nearbyFormulas(catalogue, paris).map(item => item.opKey), ['atlante', 'lidl', 'iziviafast']);
    assert.equal(nearbyFormulas(catalogue, null).length, 4);
    const roaming = formula('Electroverse', { opKey: 'electroverse' });
    assert.equal(nearbyFormulas([roaming], paris).length, 1);
});

test('« Votre mois » donne les kWh, la fourchette de budget et le remboursement de l’abonnement', () => {
    const elements = installDocument(1000);
    setLanguage('fr', { persist: false, translate: false });
    renderProfileView({ formulasData: catalogue, consumption: 0.18, fastPercentage: 90, homeRate: 0.20, logos: {}, coverage: paris, vehicle: { usableKwh: 70 } });
    const month = elements.get('offer-month').innerHTML;
    assert.equal(elements.get('offer-month').hidden, false);
    assert.match(month, /Votre mois\s:\s180\skWh/);
    assert.match(month, /dont 18\skWh à la maison \(3,60(?: |\s)€\)/);
    assert.match(month, /tout chez Atlante/);
    assert.match(month, /tout chez Izivia/);
    // Atlante Go (4,99 €) face à Lidl : 4,99 / (0,29 − 0,20) = 55,4 → 56 kWh, soit 2 recharges de 49 kWh.
    assert.match(month, /Atlante Go - mensuel se rembourse dès 56\skWh par mois chargés chez Atlante plutôt que chez Lidl, soit 2 recharges\./);
    assert.match(month, /data-open-why/);
    setLanguage('en', { persist: false, translate: false });
    renderProfileView({ formulasData: catalogue, consumption: 0.18, fastPercentage: 100, homeRate: 0.20, logos: {}, coverage: null });
    assert.match(elements.get('offer-trio').innerHTML, /IECharge/);
    assert.match(elements.get('offer-intro').innerHTML, /Enter your town to see nearby chargers/);
    assert.match(elements.get('offer-trio').innerHTML, /50 kWh charge/);
    assert.match(elements.get('offer-month').innerHTML, /all at fast chargers/);
    setLanguage('fr', { persist: false, translate: false });
});

test('une seule formule par réseau, recharge type et remboursement', () => {
    const twice = [catalogue[0], { ...catalogue[0], name: 'Atlante Go - annuel' }, catalogue[2], catalogue[3], catalogue[1]];
    assert.deepEqual(topNetworks(twice).map(item => item.opKey), ['atlante', 'lidl', 'iziviafast']);
    assert.deepEqual(chargeSize({ usableKwh: 70 }), { kwh: 49, fromVehicle: true });
    assert.deepEqual(chargeSize(null), { kwh: 50, fromVehicle: false });
    assert.equal(subscriptionPayback(catalogue[0], [catalogue[0], catalogue[2]]).kwh, 56);
    assert.equal(subscriptionPayback(catalogue[2], [catalogue[0], catalogue[2]]), null);
    assert.equal(subscriptionPayback(catalogue[0], [catalogue[0]]), null);
});

test('la note du réseau explique ChargeBack, fourchette ou estimation', () => {
    setLanguage('fr', { persist: false, translate: false });
    const cb = { rate: 0.145, rateRaw: 0.29, chargebackRate: 0.145, chargebackConfig: { enabled: true, beforeDate: '2026-07-01', rateBefore: 1, rateAfter: 1, promoEndDate: '2026-12-31', rateAfterPromo: 0.5 } };
    const note = offerNetworkNote(cb, new Date('2026-11-12T12:00:00'));
    assert.match(note, /Payé 0,29(?: |\s)€\/kWh à la borne/);
    assert.match(note, /Après le 31 décembre 2026, ChargeBack à 50\s%\s: ≈ 0,193(?: |\s)€\/kWh/);
    assert.match(offerNetworkNote({ pricingType: 'discount', rate: 0.3, rateMin: 0.19, rateMax: 0.41, chargingTime: 'any' }), /entre 0,19(?: |\s)€\/kWh et 0,41(?: |\s)€\/kWh selon l’heure\. Calcul\s:/);
    assert.equal(offerNetworkNote({ pricingType: 'station', rate: 0.3 }), 'Prix estimé, variable selon la station.');
    assert.equal(offerNetworkNote({ pricingType: 'fixed', rate: 0.29 }), '');
});

test('« Pourquoi cet ordre ? » réunit le coût annuel, les prix, l’écart, le seuil et la source', () => {
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

test('un réseau hors carte kWhiz renvoie vers la carte de l’opérateur', () => {
    const elements = installDocument(1000);
    setLanguage('fr', { persist: false, translate: false });
    const powerdot = formula('Powerdot', { operator: 'Powerdot', opKey: 'powerdot', rate: 0.10, rateRaw: 0.10, mapUrl: 'https://powerdot.fr/carte' });
    renderProfileView({ formulasData: [powerdot], consumption: 0.18, fastPercentage: 100, homeRate: 0.20, logos: {}, mapOperators: ['atlante'] });
    const trio = elements.get('offer-trio').innerHTML;
    assert.match(trio, /href="https:\/\/powerdot\.fr\/carte"[^>]*aria-label="Carte des bornes Powerdot"/);
    assert.doesNotMatch(trio, /data-map-operator/);
    assert.equal(elements.get('offer-context').textContent, 'Le réseau le moins cher');
    const unsafe = formula('X', { opKey: 'x', mapUrl: 'javascript:alert(1)' });
    renderProfileView({ formulasData: [unsafe], consumption: 0.18, fastPercentage: 100, homeRate: 0.20, logos: {}, mapOperators: [] });
    assert.doesNotMatch(elements.get('offer-trio').innerHTML, /javascript:/);
});

test('chaque réseau proposé sur la carte possède des stations IRVE', async () => {
    const { readFile } = await import('node:fs/promises');
    const { MAP_OPERATOR_KEYS } = await import('../src/config/app-config.js');
    const irve = JSON.parse(await readFile(new URL('../public/irve-fast.json', import.meta.url), 'utf8'));
    const present = new Set(irve.stations.map(station => station.operator));
    for (const key of MAP_OPERATOR_KEYS) assert.ok(present.has(key), `${key} absent de irve-fast.json`);
});
