import test from 'node:test';
import assert from 'node:assert/strict';
import { setLanguage } from '../src/i18n/i18n.js';
import {
    profileAnnualAmount,
    profileMonthlyAmount,
    profileShareStatusLabel,
    profileThresholdLabel,
    recommendationSubscriptionLabel,
    renderProfileHero,
    renderProfileRanking,
    renderProfileShortlist,
    renderProfileView
} from '../src/ui/views/profile-view.js';

class FakeElement {
    constructor({ value = '' } = {}) {
        this.value = value;
        this.innerHTML = '';
        this.children = [];
        this.className = '';
    }
    addEventListener() {}
    appendChild(child) { this.children.push(child); }
    querySelectorAll() { return []; }
    querySelector() { return null; }
}

function installDocument(km = 1000) {
    const elements = new Map([
        ['profile-best-card', new FakeElement()],
        ['profile-shortlist-list', new FakeElement()],
        ['profile-ranking-list', new FakeElement()],
        ['profile-ranking-details', new FakeElement()],
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
        profileMonthlyCost: 40,
        ...overrides
    };
}

function renderShortlist(language) {
    const elements = installDocument();
    setLanguage(language, { persist: false, translate: false });
    renderProfileShortlist([
        formula('Tarif unique', { opKey: 'iecharge', operator: 'IECharge', profileMonthlyCost: 40 }),
        formula('Atlante Go - mensuel', { opKey: 'atlante', operator: 'Atlante', cost: 9.99, period: 'monthly', monthlyCost: 9.99, profileMonthlyCost: 45 }),
        formula('Happy Hours - heures creuses', { opKey: 'izivia', operator: 'Izivia', profileMonthlyCost: 50 })
    ], {}, new Set(['atlante::Atlante Go - mensuel']));
    return elements.get('profile-shortlist-list').innerHTML;
}

test('localise les états catalogue vide et kilométrage nul', () => {
    let elements = installDocument(1000);
    setLanguage('en', { persist: false, translate: false });
    renderProfileHero({ formulasData: [], consumption: 0.18, fastPercentage: 100, homeRate: 0.20, favorites: new Set(), logos: {} });
    assert.match(elements.get('profile-best-card').innerHTML, /Loading prices/);

    elements = installDocument(0);
    renderProfileHero({ formulasData: [formula('Tarif unique')], consumption: 0.18, fastPercentage: 100, homeRate: 0.20, favorites: new Set(), logos: {} });
    assert.match(elements.get('profile-best-card').innerHTML, /Enter your monthly mileage/);
    renderProfileShortlist([], {}, new Set());
    assert.match(elements.get('profile-shortlist-list').innerHTML, /No plans available/);
});

test('localise les seuils nul, fini et infini sans modifier leur calcul', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(profileThresholdLabel({ hasSubscription: true, thresholdKm: 0 }), 'Rentable immédiatement');
    assert.equal(profileThresholdLabel({ hasSubscription: true, thresholdKm: 1050 }), '1 050 km/mois');
    assert.equal(profileThresholdLabel({ hasSubscription: true, thresholdKm: Infinity }), 'Seuil non atteignable');
    assert.equal(profileThresholdLabel({ hasSubscription: false, thresholdKm: 0 }), 'Sans abonnement');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(profileThresholdLabel({ hasSubscription: true, thresholdKm: 0 }), 'Breaks even immediately');
    assert.equal(profileThresholdLabel({ hasSubscription: true, thresholdKm: 1050 }), '1,050 km/month');
    assert.equal(profileThresholdLabel({ hasSubscription: true, thresholdKm: Infinity }), 'Break-even cannot be reached');
});

test('rend une recommandation avec abonnement, économie, domicile et favori en FR et EN', () => {
    const formulas = [
        formula('Atlante Go - mensuel', { operator: 'Atlante', opKey: 'atlante', rate: 0.20, monthlyCost: 9.99, km: 600 }),
        formula('Tarif unique', { operator: 'IECharge', opKey: 'iecharge', rate: 1.00, profileMonthlyCost: 100 })
    ];
    const favorites = new Set(['atlante::Atlante Go - mensuel']);

    let elements = installDocument(1000);
    setLanguage('fr', { persist: false, translate: false });
    renderProfileHero({ formulasData: formulas, consumption: 0.18, fastPercentage: 40, homeRate: 0.20, favorites, logos: {} });
    const french = elements.get('profile-best-card').innerHTML;
    assert.match(french, /Coût total le plus bas parmi 2 formules comparées/);
    assert.match(french, /économisés par mois face à IECharge Tarif unique/);
    assert.match(french, /Abonnement non encore rentabilisé/);
    assert.match(french, /60(?: |\s)%<\/strong> de recharge à domicile/);
    assert.match(french, /Comparaison avec votre favori/);
    assert.match(french, /45,99(?: |\s)€\/mois/);
    assert.match(french, /551,88(?: |\s)€ par an/);

    elements = installDocument(1000);
    setLanguage('en', { persist: false, translate: false });
    renderProfileHero({ formulasData: formulas, consumption: 0.18, fastPercentage: 40, homeRate: 0.20, favorites, logos: {} });
    const english = elements.get('profile-best-card').innerHTML;
    assert.match(english, /Lowest total cost among 2 plans compared/);
    assert.match(english, /saved per month compared with IECharge Standard price/);
    assert.match(english, /The subscription does not yet pay for itself/);
    assert.match(english, /60%<\/strong> home charging at €0\.20\/kWh/);
    assert.match(english, /Comparison with your favourite/);
    assert.match(english, /€45\.99\/month/);
    assert.match(english, /€551\.88 per year/);
});

test('rend une recommandation sans abonnement et le faible écart', () => {
    const elements = installDocument(500);
    setLanguage('en', { persist: false, translate: false });
    renderProfileHero({
        formulasData: [
            formula('Tarif unique', { rate: 0.40 }),
            formula('Autre formule', { rate: 0.40001 })
        ],
        consumption: 0.18,
        fastPercentage: 100,
        homeRate: 0.20,
        favorites: new Set(),
        logos: {}
    });
    const html = elements.get('profile-best-card').innerHTML;
    assert.match(html, /Very small difference/);
    assert.match(html, /No subscription: no fixed cost/);
    assert.doesNotMatch(html, /Écart très faible|Sans abonnement|aucun coût fixe/);
});

test('rend le singulier et un abonnement déjà rentabilisé', () => {
    const elements = installDocument(2000);
    setLanguage('en', { persist: false, translate: false });
    renderProfileHero({
        formulasData: [formula('Atlante Go - mensuel', {
            operator: 'Atlante',
            opKey: 'atlante',
            rate: 0.20,
            monthlyCost: 9.99,
            km: 600
        })],
        consumption: 0.18,
        fastPercentage: 100,
        homeRate: 0.20,
        favorites: new Set(),
        logos: {}
    });
    const html = elements.get('profile-best-card').innerHTML;
    assert.match(html, /Lowest total cost among 1 plan compared/);
    assert.match(html, /The subscription pays for itself at your mileage/);
});

test('localise le Top 3, ses monnaies et les aria-labels sans traduire les noms commerciaux', () => {
    const french = renderShortlist('fr');
    assert.match(french, /Tarif unique · Sans abonnement/);
    assert.match(french, /Atlante Go - mensuel · 9,99(?: |\s)€\/mois/);
    assert.match(french, /Détails ›/);
    assert.match(french, /aria-label="Voir le détail de Atlante · Atlante Go - mensuel"/);
    assert.match(french, /aria-label="Retirer des favoris"/);

    const english = renderShortlist('en');
    assert.match(english, /Standard price · No subscription/);
    assert.match(english, /Atlante Go — monthly · €9\.99\/month/);
    assert.match(english, /Happy Hours — off-peak · No subscription/);
    assert.match(english, /aria-label="Remove from favourites"/);
    assert.match(english, />€40\.00</);
    assert.doesNotMatch(english, /Sans abonnement|d’abonnement|Ajouter aux favoris|Retirer des favoris|coût le plus bas/);
});

test('affiche les abonnements mensuel et annuel puis ouvre le détail existant', () => {
    const elements = installDocument();
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(recommendationSubscriptionLabel(formula('Mensuel', { cost: 9.99, monthlyCost: 9.99, period: 'monthly' })), '9,99 €/mois');
    assert.equal(recommendationSubscriptionLabel(formula('Annuel', { cost: 49.99, monthlyCost: 49.99 / 12, period: 'annual' })), '49,99 €/an, soit 4,17 €/mois');

    const plans = [formula('Atlante Go - mensuel', { operator: 'Atlante', opKey: 'atlante', cost: 9.99, monthlyCost: 9.99 })];
    let opened = null;
    renderProfileShortlist(plans, {}, new Set(), undefined, formula => { opened = formula; });
    const trigger = {
        dataset: { detail: 'atlante::Atlante Go - mensuel' },
        closest: selector => selector === '[data-detail]' ? trigger : null
    };
    elements.get('profile-shortlist-list').onclick({ target: trigger });
    assert.equal(opened, plans[0]);
});

test('rend uniquement la suite compacte à partir de la quatrième offre', () => {
    const elements = installDocument(1000);
    setLanguage('fr', { persist: false, translate: false });
    renderProfileView({
        formulasData: [
            formula('Tarif unique', { operator: 'IECharge', opKey: 'iecharge', rate: 0.25, note: 'Note à masquer.' }),
            formula('Atlante Go - mensuel', { operator: 'Atlante', opKey: 'atlante', rate: 0.20, cost: 9.99, period: 'monthly', monthlyCost: 9.99 }),
            formula('Troisième', { operator: 'C', opKey: 'c', rate: 0.30 }),
            formula('Quatrième', { operator: 'D', opKey: 'd', rate: 0.40 }),
            formula('Cinquième', { operator: 'E', opKey: 'e', rate: 0.50 })
        ],
        consumption: 0.18,
        fastPercentage: 100,
        homeRate: 0.20,
        logos: {},
        favorites: new Set(['atlante::Atlante Go - mensuel'])
    });
    const html = elements.get('profile-ranking-list').innerHTML;
    assert.equal((html.match(/<article/g) || []).length, 2);
    assert.match(html, />4<\/span>/);
    assert.match(html, />5<\/span>/);
    assert.doesNotMatch(html, /IECharge|Atlante|Troisième|Meilleur coût/);
    assert.doesNotMatch(html, /Note à masquer|0,25|d’abonnement|Seuil|<table|<th|<td/);
});

test('masque la suite lorsqu’il n’existe pas plus de trois offres', () => {
    const elements = installDocument();
    renderProfileRanking([
        formula('Première'),
        formula('Deuxième'),
        formula('Troisième')
    ], {}, new Set());
    assert.equal(elements.get('profile-ranking-list').innerHTML, '');
    assert.equal(elements.get('profile-ranking-details').hidden, true);
});

test('préserve le nombre, l’ordre, les coûts et les écarts avec Intl en FR et EN', () => {
    const ranked = [
        formula('Première', { operator: 'A', opKey: 'a', profileMonthlyCost: 45 }),
        formula('Deuxième', { operator: 'B', opKey: 'b', profileMonthlyCost: 47.51 }),
        formula('Troisième', { operator: 'C', opKey: 'c', profileMonthlyCost: 50 }),
        formula('Quatrième', { operator: 'D', opKey: 'd', profileMonthlyCost: 55 }),
        formula('Indisponible', { operator: 'E', opKey: 'e', profileMonthlyCost: Infinity })
    ];
    for (const language of ['fr', 'en']) {
        const elements = installDocument();
        setLanguage(language, { persist: false, translate: false });
        renderProfileRanking(ranked, {}, new Set());
        const html = elements.get('profile-ranking-list').innerHTML;
        assert.equal((html.match(/<article/g) || []).length, 2);
        assert.equal(elements.get('profile-ranking-details').hidden, false);
        assert.doesNotMatch(html, /Première|Deuxième|Troisième/);
        assert.ok(html.indexOf('Quatrième') < html.indexOf('Indisponible'));
        assert.match(html, language === 'fr' ? /55,00(?: |\s)€\/mois/ : /€55\.00\/month/);
        assert.match(html, language === 'fr' ? /\+10,00(?: |\s)€/ : /\+€10\.00/);
        assert.match(html, language === 'fr' ? /Coût indisponible/ : /Cost unavailable/);
    }
});

test('formate exactement les coûts mensuels et annuels avec Intl', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(profileMonthlyAmount(9.99), '9,99 €/mois');
    assert.equal(profileAnnualAmount(119.88), '119,88 € par an');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(profileMonthlyAmount(9.99), '€9.99/month');
    assert.equal(profileAnnualAmount(119.88), '€119.88 per year');
});

test('la bascule FR ↔ EN rerend toutes les zones et localise les messages de partage', () => {
    assert.match(renderShortlist('fr'), /9,99(?: |\s)€\/mois/);
    assert.match(renderShortlist('en'), /Atlante Go — monthly · €9\.99\/month/);
    assert.match(renderShortlist('fr'), /Sans abonnement/);

    setLanguage('fr', { persist: false, translate: false });
    assert.equal(profileShareStatusLabel('copied'), 'Résultat copié dans le presse-papiers.');
    assert.equal(profileShareStatusLabel('shared'), 'Résultat partagé.');
    assert.equal(profileShareStatusLabel('unavailable'), 'Partage impossible sur cet appareil.');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(profileShareStatusLabel('copied'), 'Result copied to the clipboard.');
    assert.equal(profileShareStatusLabel('shared'), 'Result shared.');
    assert.equal(profileShareStatusLabel('unavailable'), 'Sharing is unavailable on this device.');
});
