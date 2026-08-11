import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShareText, shareResult } from '../src/ui/share-result.js';
import { setLanguage } from '../src/i18n/i18n.js';

test('buildShareText produit un résumé complet en français', () => {
    setLanguage('fr', { persist: false, translate: false });
    const text = buildShareText({
        operator: 'Ionity',
        formula: 'Passport Power',
        monthlyCost: 42.5,
        annualCost: 510,
        km: 1500,
        fastPercentage: 80
    });

    assert.match(text, /Ionity · Passport Power/);
    assert.match(text, /42,50\s€\/mois/);
    assert.match(text, /510,00\s€ par an/);
    assert.match(text, /1[\s\u202f]500[\s\u202f]km\/mois/);
    assert.match(text, /80\s% de recharge rapide/);
});

test('buildShareText conserve les valeurs nulles valides', () => {
    setLanguage('fr', { persist: false, translate: false });
    const text = buildShareText({
        operator: 'Exemple',
        formula: 'Sans abonnement',
        monthlyCost: 0,
        annualCost: 0,
        km: 0,
        fastPercentage: 0
    });

    assert.match(text, /0,00\s€\/mois/);
    assert.match(text, /0[\s\u202f]km\/mois/);
    assert.match(text, /0\s% de recharge rapide/);
});

test('formate le partage en anglais avec Intl et conserve le nom commercial localisé', () => {
    setLanguage('en', { persist: false, translate: false });
    const text = buildShareText({ operator: 'IECharge', formula: 'Tarif unique', monthlyCost: 9.99, annualCost: 119.88, km: 1050, fastPercentage: 40 });
    assert.match(text, /IECharge · Standard price/);
    assert.match(text, /€9\.99\/month/);
    assert.match(text, /€119\.88 per year/);
    assert.match(text, /1,050\s?km\/month · 40% fast charging/);
    assert.doesNotMatch(text, /Mon choix|Tarif unique|par an|recharge rapide/);
});

test('utilise Web Share lorsqu’il est disponible', async () => {
    let sharedPayload;
    const result = await shareResult({ operator: 'IONITY', formula: 'Power', monthlyCost: 10, annualCost: 120, km: 1000, fastPercentage: 50, url: 'https://example.test' }, {
        navigatorRef: { share: async payload => { sharedPayload = payload; } }, documentRef: {}, locationRef: { href: 'https://ignored.test' }
    });
    assert.equal(result, 'shared');
    assert.equal(sharedPayload.url, 'https://example.test');
});

test('utilise le presse-papiers sans Web Share et signale un échec de copie', async () => {
    let copied = '';
    const payload = { operator: 'IONITY', formula: 'Power', monthlyCost: 10, annualCost: 120, km: 1000, fastPercentage: 50, url: 'https://example.test' };
    const copiedResult = await shareResult(payload, {
        navigatorRef: { clipboard: { writeText: async text => { copied = text; } } }, documentRef: {}, locationRef: { href: '' }
    });
    assert.equal(copiedResult, 'copied');
    assert.match(copied, /https:\/\/example\.test/);
    const failedResult = await shareResult(payload, {
        navigatorRef: { clipboard: { writeText: async () => { throw new Error('technical'); } } }, documentRef: {}, locationRef: { href: '' }
    });
    assert.equal(failedResult, 'copyFailed');
});
