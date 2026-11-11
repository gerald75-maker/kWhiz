import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyChargingTime, dependsOnChargingTime, normalizeChargingTime } from '../src/domain/charging-time.js';
import { calculateBreakeven } from '../src/domain/pricing.js';
import { setLanguage, t } from '../src/i18n/i18n.js';
import { offerDetailCalculationNote } from '../src/ui/views/offer-detail-view.js';

const tariffs = JSON.parse(await readFile(new URL('../public/tarifs.json', import.meta.url), 'utf8'));
const electra = tariffs.electra;
const byName = name => electra.formulas.find(formula => formula.name === name);
const smart = byName('Electra+ Smart - mensuel');
const payg = byName('Application Electra - prix variable');

test('le moment de recharge inconnu revient à « n’importe quand »', () => {
    assert.equal(normalizeChargingTime('offpeak'), 'offpeak');
    assert.equal(normalizeChargingTime('peak'), 'peak');
    assert.equal(normalizeChargingTime('nuit'), 'any');
    assert.equal(normalizeChargingTime(null), 'any');
});

test('seules les fourchettes calculées au milieu dépendent du moment de recharge', () => {
    assert.equal(dependsOnChargingTime(smart), true);
    assert.equal(dependsOnChargingTime(payg), true);
    assert.equal(dependsOnChargingTime(byName('Paiement par badge ou carte')), false);
    assert.equal(dependsOnChargingTime(tariffs.atlante.formulas[0]), false);
    assert.equal(applyChargingTime(tariffs.atlante.formulas[0], 'offpeak'), tariffs.atlante.formulas[0]);
});

test('Electra+ Smart : bas, milieu ou haut de la fourchette, référence décalée d’autant', () => {
    assert.equal(applyChargingTime(smart, 'any'), smart);
    const offpeak = applyChargingTime(smart, 'offpeak');
    const peak = applyChargingTime(smart, 'peak');
    assert.equal(offpeak.rate, 0.19);
    assert.equal(peak.rate, 0.41);
    // Référence = prix sans abonnement au même moment : 0,39 en heures creuses, 0,61 en pointe.
    assert.equal(offpeak.ref, 0.39);
    assert.equal(peak.ref, 0.61);
    assert.equal(applyChargingTime(payg, 'offpeak').rate, 0.39);
    assert.equal(applyChargingTime(payg, 'offpeak').ref, 0.39);
    // La remise reste de 0,20 €/kWh : le seuil de rentabilité ne bouge pas.
    assert.equal(calculateBreakeven(offpeak, 0.18).km, calculateBreakeven(smart, 0.18).km);
    // L’objet source n’est pas modifié.
    assert.equal(smart.rate, 0.3);
});

test('en heures creuses, Electra+ Smart coûte 39,19 € pour 1 000 km à 18 kWh/100 km', () => {
    const kwh = 1000 * 0.18;
    const cost = formula => Math.round((kwh * formula.rate + formula.cost) * 100) / 100;
    assert.equal(cost(smart), 58.99);
    assert.equal(cost(applyChargingTime(smart, 'offpeak')), 39.19);
    assert.equal(cost(applyChargingTime(smart, 'peak')), 78.79);
});

test('le détail de l’offre indique le prix retenu', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(offerDetailCalculationNote({ rate: 0.3 }), '');
    assert.match(offerDetailCalculationNote({ ...applyChargingTime(smart, 'offpeak'), chargingTime: 'offpeak' }), /0,19\s€\/kWh, bas de la fourchette \(heures creuses\)/);
    assert.match(offerDetailCalculationNote({ ...smart, chargingTime: 'any' }), /milieu de la fourchette/);
    setLanguage('en', { persist: false, translate: false });
    assert.match(offerDetailCalculationNote({ ...applyChargingTime(smart, 'peak'), chargingTime: 'peak' }), /high end of the range \(peak hours\)/);
    setLanguage('fr', { persist: false, translate: false });
});

test('Mon profil propose les trois moments, l’aide et la sauvegarde suivent', async () => {
    const [html, app, backup, config] = await Promise.all([
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../app.js', import.meta.url), 'utf8'),
        readFile(new URL('../src/ui/data-backup.js', import.meta.url), 'utf8'),
        readFile(new URL('../src/config/app-config.js', import.meta.url), 'utf8')
    ]);
    const sheet = html.slice(html.indexOf('id="profile-sheet"'), html.indexOf('id="why-sheet"'));
    assert.deepEqual([...sheet.matchAll(/data-charging-time="([a-z]+)"/g)].map(match => match[1]), ['offpeak', 'any', 'peak']);
    assert.match(sheet, /role="group"[^>]*id="charging-time-chips"|id="charging-time-chips"[^>]*role="group"/);
    assert.match(html, /data-i18n="help\.plan\.timing"/);
    assert.match(config, /chargingTime: 'kwhiz_charging_time'/);
    assert.match(backup, /storageKeys\.chargingTime/);
    assert.match(app, /applyChargingTime\(sourceFormula, chargingTime\)/);
    for (const language of ['fr', 'en']) {
        setLanguage(language, { persist: false, translate: false });
        for (const key of ['profile.chargingTime.label', 'profile.chargingTime.offpeak', 'profile.chargingTime.any', 'profile.chargingTime.peak', 'profile.chargingTime.hint', 'summary.offpeak', 'summary.peak', 'help.plan.timing']) {
            assert.notEqual(t(key), key, `${language} ${key}`);
        }
    }
    setLanguage('fr', { persist: false, translate: false });
});
