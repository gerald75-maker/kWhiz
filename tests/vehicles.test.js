import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { setLanguage, t } from '../src/i18n/i18n.js';
import { offerSourceHtml } from '../src/ui/views/profile-view.js';
import { VEHICLES, VEHICLE_SOURCE, findVehicle, vehicleLabel, vehicleSliderValue, vehicleSourceUrl } from '../src/config/vehicles.js';

test('une trentaine de modèles, identifiants uniques, valeurs plausibles', () => {
    assert.ok(VEHICLES.length >= 30);
    assert.equal(new Set(VEHICLES.map(v => v.id)).size, VEHICLES.length);
    for (const v of VEHICLES) {
        assert.ok(v.whKm >= 110 && v.whKm <= 260, v.id);
        assert.ok(v.usableKwh > 15 && v.usableKwh < 110, v.id);
    }
});

test('la Ioniq 5 73 kWh de 2021 reprend les valeurs EV Database', () => {
    const ioniq = findVehicle('hyundai-ioniq5-73-2021');
    assert.equal(ioniq.whKm, 189);
    assert.equal(ioniq.usableKwh, 70);
    assert.equal(vehicleSliderValue(ioniq), 19);
    assert.equal(vehicleLabel(ioniq), 'Hyundai Ioniq 5 73 kWh propulsion (2021)');
});

test('arrondi au kWh/100 km dans les bornes du curseur', () => {
    assert.equal(vehicleSliderValue({ whKm: 133 }), 13);
    assert.equal(vehicleSliderValue({ whKm: 155 }), 16);
    assert.equal(vehicleSliderValue({ whKm: 80 }), 10);
    assert.equal(vehicleSliderValue({ whKm: 400 }), 30);
    assert.equal(findVehicle('inconnu'), null);
});

test('la source et sa date sont citées', async () => {
    assert.deepEqual({ ...VEHICLE_SOURCE }, { name: 'EV Database', url: 'https://ev-database.org/', asOf: '2026-11-11' });
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(html, /id="vehicle-model"/);
    assert.match(html, /href="https:\/\/ev-database\.org\/"/);
});

async function listFiles(dir, out = []) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
        if (entry.isDirectory()) await listFiles(full, out);
        else out.push(full);
    }
    return out;
}

test('chaque fiche EV Database a un chemin valide et une adresse cohérente', () => {
    const withPath = VEHICLES.filter(v => v.evdbPath);
    // Condition de l'accord : pas de modèle sans lien vers sa fiche.
    assert.equal(withPath.length, VEHICLES.length);
    for (const v of withPath) {
        assert.match(v.evdbPath, /^\d{3,5}\/[A-Za-z0-9-]+$/, v.id);
        assert.equal(v.sourceUrl, 'https://ev-database.org/car/' + v.evdbPath, v.id);
    }
    assert.equal(new Set(withPath.map(v => v.evdbPath)).size, withPath.length);
    for (const v of VEHICLES.filter(x => !x.evdbPath)) assert.equal(vehicleSourceUrl(v), null);
});

test('la Ioniq 5 2021 pointe vers sa fiche', () => {
    assert.equal(findVehicle('hyundai-ioniq5-73-2021').sourceUrl, 'https://ev-database.org/car/1478/Hyundai-IONIQ-5-Long-Range-2WD');
    assert.equal(vehicleSourceUrl(findVehicle('hyundai-ioniq5-73-2021')), 'https://ev-database.org/car/1478/Hyundai-IONIQ-5-Long-Range-2WD');
});

test('la source sous Mon offre cite les valeurs d’origine et la fiche', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(offerSourceHtml(null), '');
    const html = offerSourceHtml(findVehicle('hyundai-ioniq5-73-2021'));
    assert.ok(html.includes('https://ev-database.org/car/1478/Hyundai-IONIQ-5-Long-Range-2WD'));
    assert.ok(html.includes('189 Wh/km'));
    assert.ok(html.includes('70 kWh'));
    assert.ok(html.includes('target="_blank"'));
    assert.ok(html.includes('rel="noopener noreferrer"'));
    // Le nom accessible du lien reprend son texte visible.
    assert.ok(html.includes('aria-label="Source : fiche EV Database de Hyundai Ioniq 5 73 kWh propulsion (2021) (nouvel onglet)"'));
    assert.ok(html.includes('>Source : fiche EV Database <span'));
});

test('les emplacements et les textes de source existent', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(html, /id="vehicle-model-detail"/);
    assert.match(html, /id="offer-source"/);
    assert.match(html, /data-i18n="landing\.car\.source"/);
    const keys = ['consumption.model.detail', 'consumption.model.sheet', 'consumption.model.sheetLabel', 'consumption.model.rounded',
        'offer.source', 'offer.source.link', 'offer.source.linkLabel', 'landing.car.source', 'help.plan.vehicle'];
    for (const lang of ['fr', 'en']) {
        setLanguage(lang, { persist: false, translate: false });
        for (const key of keys) assert.notEqual(t(key), key, `${lang} ${key}`);
    }
    setLanguage('fr', { persist: false, translate: false });
});

test('garde-fous : relevé manuel et aucune image servie par EV Database', async () => {
    const root = new URL('../', import.meta.url);
    const collectors = [];
    for (const dir of ['scripts/', '.github/workflows/']) {
        try { collectors.push(...await listFiles(new URL(dir, root))); } catch { /* dossier absent */ }
    }
    for (const file of collectors) {
        assert.ok(!(await readFile(file, 'utf8')).toLowerCase().includes('ev-database'), file.pathname);
    }
    const files = [new URL('index.html', root), new URL('styles.css', root), ...await listFiles(new URL('src/', root))];
    const imageFromEvdb = /(<img[^>]*|url\([^)]*|["'(][^"')\s]*)ev-database\.org[^"')\s]*\.(png|jpe?g|webp|svg)|<img[^>]*ev-database\.org|url\([^)]*ev-database\.org/i;
    for (const file of files) {
        assert.ok(!imageFromEvdb.test(await readFile(file, 'utf8')), file.pathname);
    }
});
