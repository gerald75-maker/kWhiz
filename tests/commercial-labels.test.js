import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { localizeCommercialLabel, localizeNetworkDescription, setLanguage } from '../src/i18n/i18n.js';
import { buildShareText } from '../src/ui/share-result.js';
import { renderOfferDetail } from '../src/ui/views/offer-detail-view.js';

const expected = new Map([
    ['Application ENGIE Vianeo — sans abonnement', 'ENGIE Vianeo app — no subscription'],
    ['Carte bancaire ENGIE Vianeo', 'ENGIE Vianeo bank card'],
    ['Tarif unique', 'Standard price'],
    ['Application Electra - prix variable', 'Electra app — variable price'],
    ['Electra+ Essential - mensuel', 'Electra+ Essential — monthly'],
    ['Electra+ Essential - annuel', 'Electra+ Essential — annual'],
    ['Electra+ Smart - mensuel', 'Electra+ Smart — monthly'],
    ['Electra+ Smart - annuel', 'Electra+ Smart — annual'],
    ['Paiement par badge ou carte', 'Charging card or bank card payment'],
    ['Sans abonnement', 'No subscription'],
    ['Abonnement mensuel', 'Monthly subscription'],
    ['Abonnement annuel', 'Annual subscription'],
    ['Paiement direct', 'Direct payment'],
    ['Application IONITY', 'IONITY app'],
    ['IONITY Motion - mensuel', 'IONITY Motion — monthly'],
    ['IONITY Motion 365 - annuel', 'IONITY Motion 365 — annual'],
    ['IONITY Power - mensuel', 'IONITY Power — monthly'],
    ['IONITY Power 365 - annuel', 'IONITY Power 365 — annual'],
    ['Recharge rapide DC', 'DC fast charging'],
    ['Atlante Go - mensuel', 'Atlante Go — monthly'],
    ['Happy Hours - heures creuses', 'Happy Hours — off-peak'],
    ['Tarif standard', 'Standard price'],
    ['IZIVIA Fast chez McDonald’s', 'IZIVIA Fast at McDonald’s'],
    ['Application Fastned - remise 10 %', 'Fastned app — 10% discount'],
    ['Abonnement Gold - remise 30 %', 'Gold subscription — 30% discount'],
    ['Sans forfait', 'No subscription'],
    ['Carte bancaire', 'Bank card'],
    ['Powerdot - AC jusqu’à 22 kW', 'Powerdot — AC up to 22 kW'],
    ['Powerdot - AC, remise 28 %', 'Powerdot — AC, 28% discount'],
    ['Powerdot - DC au-delà de 100 kW', 'Powerdot — DC above 100 kW'],
    ['Powerdot - DC, remise 28 %', 'Powerdot — DC, 28% discount'],
    ['IONITY via Electroverse - sans abonnement', 'IONITY via Electroverse — no subscription'],
    ['IONITY via Electroverse - remise annoncée', 'IONITY via Electroverse — advertised discount']
]);

test('conserve les valeurs sources en français et utilise seulement les correspondances exactes en anglais', () => {
    setLanguage('fr', { persist: false, translate: false });
    for (const source of expected.keys()) assert.equal(localizeCommercialLabel(source), source);

    setLanguage('en', { persist: false, translate: false });
    for (const [source, english] of expected) assert.equal(localizeCommercialLabel(source), english);
    assert.equal(localizeCommercialLabel('Formule inconnue - mensuel'), 'Formule inconnue - mensuel');
    assert.equal(localizeCommercialLabel('IECharge'), 'IECharge');
    assert.equal(localizeCommercialLabel('ChargeBack'), 'ChargeBack');
});

test('couvre tous les descriptifs français détectés dans les noms du catalogue', async () => {
    const catalog = JSON.parse(await readFile(new URL('../public/tarifs.json', import.meta.url), 'utf8'));
    const names = Object.values(catalog)
        .filter(operator => Array.isArray(operator?.formulas))
        .flatMap(operator => [operator.name, ...operator.formulas.map(formula => formula.name)]);
    const frenchTerms = /\b(application|prix|mensuel|annuel|sans|abonnement|paiement|recharge|jusqu|heures|chez|tarif|remise|forfait|carte)\b|au-delà/i;
    const uncovered = names.filter(name => frenchTerms.test(name) && !expected.has(name));

    assert.deepEqual([...new Set(uncovered)].sort(), []);
});

test('le catalogue actif exclut Stations-e sans altérer les autres opérateurs', async () => {
    const catalog = JSON.parse(await readFile(new URL('../public/tarifs.json', import.meta.url), 'utf8'));
    const operators = Object.entries(catalog).filter(([, operator]) => Array.isArray(operator?.formulas));
    assert.equal(operators.some(([key]) => key === 'statione'), false);
    assert.equal(operators.length, 12);
    assert.equal(operators.reduce((total, [, operator]) => total + operator.formulas.length, 0), 39);
    assert.ok(catalog.atlante.formulas.some(formula => formula.id === 'atlante-go'));
    assert.ok(catalog.ionity.formulas.length > 0);
});

test('les préférences historiques Stations-e sont ignorées sans bloquer les autres vues', async () => {
    const [appSource, mapSource] = await Promise.all([
        readFile(new URL('../app.js', import.meta.url), 'utf8'),
        readFile(new URL('../src/ui/stations-map.js', import.meta.url), 'utf8')
    ]);
    assert.match(appSource, /Object\.fromEntries\([\s\S]*key !== 'statione'/);
    assert.match(mapSource, /filter\(key => Object\.hasOwn\(LABELS, key\)\)/);
    assert.doesNotMatch(mapSource, /LABELS\.statione/);
});

test('localise exactement toutes les descriptions françaises de réseau du catalogue', async () => {
    const descriptions = new Map([
        ['Recharge DC ultra-rapide de 300 à 400 kW selon le site', 'Ultra-fast DC charging from 300 to 400 kW depending on the site'],
        ['Jusqu’à 600 kW selon le site', 'Up to 600 kW depending on the site'],
        ['itinérance multiréseaux', 'multi-network roaming'],
        ['jusqu’à 320 kW', 'up to 320 kW'],
        ['jusqu’à 400 kW', 'up to 400 kW'],
        ['jusqu’à 250 kW (V3) et 500 kW (V4) · puissance selon le site', 'up to 250 kW (V3) and 500 kW (V4) · power varies by site']
    ]);
    const catalog = JSON.parse(await readFile(new URL('../public/tarifs.json', import.meta.url), 'utf8'));
    const catalogDescriptions = Object.values(catalog)
        .filter(operator => Array.isArray(operator?.formulas))
        .map(operator => operator.badge)
        .filter(Boolean);
    const frenchDescriptions = catalogDescriptions.filter(value => /recharge|jusqu’à|itinérance|puissance selon/i.test(value));

    assert.deepEqual([...new Set(frenchDescriptions)].sort(), [...descriptions.keys()].sort());
    setLanguage('fr', { persist: false, translate: false });
    for (const source of catalogDescriptions) assert.equal(localizeNetworkDescription(source), source);
    setLanguage('en', { persist: false, translate: false });
    for (const [source, english] of descriptions) assert.equal(localizeNetworkDescription(source), english);
    assert.equal(localizeNetworkDescription('500 kW'), '500 kW');
    assert.equal(localizeNetworkDescription('Jusqu’à 600 kW selon le site'), 'Up to 600 kW depending on the site');
    assert.equal(localizeNetworkDescription('description inconnue'), 'description inconnue');
});

test('Atlante conserve la réserve de puissance selon le site', async () => {
    const catalog = JSON.parse(await readFile(new URL('../public/tarifs.json', import.meta.url), 'utf8'));
    assert.equal(catalog.atlante.badge, 'Jusqu’à 600 kW selon le site');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(localizeNetworkDescription(catalog.atlante.badge), 'Up to 600 kW depending on the site');
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(localizeNetworkDescription(catalog.atlante.badge), 'Jusqu’à 600 kW selon le site');
});

test('le détail et le partage utilisent la même localisation commerciale', () => {
    setLanguage('en', { persist: false, translate: false });
    const body = { innerHTML: '' };
    const title = { textContent: '' };
    renderOfferDetail({
        body,
        title,
        formula: {
            operator: 'IZIVIA Fast chez McDonald’s',
            name: 'Happy Hours - heures creuses',
            rate: 0.30,
            cost: 0,
            monthlyCost: 0,
            costPer100km: 5.40,
            km: 0,
            pricingType: 'fixed',
            calculationBasis: 'official',
            chargebackRate: null
        }
    });
    assert.match(title.textContent, /IZIVIA Fast at McDonald’s - Happy Hours — off-peak/);
    assert.match(body.innerHTML, /IZIVIA Fast at McDonald’s/);
    assert.match(body.innerHTML, /Happy Hours — off-peak/);

    const shared = buildShareText({
        operator: 'Atlante',
        formula: 'Atlante Go - mensuel',
        monthlyCost: 9.99,
        annualCost: 119.88,
        km: 1000,
        fastPercentage: 100
    });
    assert.match(shared, /Atlante · Atlante Go — monthly/);
});

test('la bascule EN vers FR est immédiate et ne modifie pas tarifs.json', async () => {
    const sourceBefore = await readFile(new URL('../public/tarifs.json', import.meta.url), 'utf8');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(localizeCommercialLabel('Tarif unique'), 'Standard price');
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(localizeCommercialLabel('Tarif unique'), 'Tarif unique');
    const sourceAfter = await readFile(new URL('../public/tarifs.json', import.meta.url), 'utf8');
    assert.equal(sourceAfter, sourceBefore);
});

test('les cinq surfaces demandées appellent la fonction centralisée', async () => {
    const files = [
        '../src/ui/views/profile-view.js',
        '../src/ui/views/comparison-view.js',
        '../src/ui/views/operators-view.js',
        '../src/ui/views/offer-detail-view.js',
        '../src/ui/share-result.js'
    ];
    for (const file of files) {
        const source = await readFile(new URL(file, import.meta.url), 'utf8');
        assert.match(source, /localizeCommercialLabel\(/, file);
    }
});
