import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, navigation, app] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('src/ui/navigation.js', root), 'utf8'),
    readFile(new URL('app.js', root), 'utf8')
]);

function fragment(start, end) {
    const from = html.indexOf(start);
    const to = html.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `fragment ${start} introuvable`);
    return html.slice(from, to);
}

test('le panneau Menu suit les sections Comprendre, Application, puis À propos', () => {
    const menu = fragment('id="menu-drawer"', '<script src="./app.js"');
    const ids = [...menu.matchAll(/id="(menu-(?:help|landing|infos|theme|settings|about))"/g)]
        .map(match => match[1]);
    assert.deepEqual(ids, [
        'menu-help', 'menu-landing', 'menu-infos',
        'menu-theme', 'menu-settings',
        'menu-about'
    ]);
    assert.match(menu, /id="menu-landing"/);
    assert.match(navigation, /on\('menu-landing', 'click', \(\) => \{ closeDrawer\(\); onShowLanding\?\.\(\); \}\)/);
});

test('les données, la sauvegarde et l’installation partagent une page utile', () => {
    const settings = fragment('id="page-settings"', '<!-- Page : Plus d\'infos');
    assert.match(navigation, /on\('menu-settings', 'click', \(\) => openPage\('page-settings'\)\)/);
    assert.match(settings, /id="about-app-status"/);
    assert.match(settings, /id="about-tariffs-freshness"/);
    assert.match(settings, /Actualiser l’application et les tarifs/);
    assert.match(settings, /id="about-export-data"/);
    assert.match(settings, /id="about-import-data"/);
    assert.match(settings, /id="settings-install"/);
    assert.doesNotMatch(app, /installBlock\.hidden/);
});

test('les planificateurs nominatifs ont quitté le menu et l’aide conserve la limite essentielle', () => {
    const menu = fragment('id="menu-drawer"', '<script src="./app.js"');
    const help = fragment('id="page-aide"', 'id="page-infos"');
    assert.doesNotMatch(menu, /menu-planners|Planificateurs d’itinéraire/);
    assert.doesNotMatch(help, /Besoin d’un véritable planificateur de recharge/);
    for (const name of ['myAtlante', 'ABRP', 'Chargemap', 'IECharge', 'Electus']) assert.doesNotMatch(help, new RegExp(name));
    assert.match(help, /ne planifie pas les arrêts selon votre véhicule/);
});

test('l’introduction simplifiée ouvre Aide et FAQ depuis son lien secondaire', () => {
    const landing = fragment('id="landing-overlay"', '<!-- Popup de mise à jour');
    assert.match(landing, /Trouvez l’offre de recharge rapide adaptée à votre usage/);
    assert.equal((landing.match(/<li\b/g) || []).length, 3);
    assert.match(landing, /id="landing-start"[^>]*>Commencer</);
    assert.match(landing, /id="landing-help-link">Comment fonctionne kWhiz/);
    assert.match(html, /<div[^>]*aria-modal="true"[^>]*id="landing-overlay"[^>]*>/);
    assert.doesNotMatch(landing, /Installer kWhiz|install-ios|install-android/);
    assert.match(app, /hideLanding\(\);[\s\S]*navigation\?\.openPage\('page-aide'\)/);
});

test('À propos est concis et ne reprend pas le mode d’emploi', () => {
    const about = fragment('id="page-about"', '<!-- Page : Données et réglages');
    assert.match(about, /gratuit/);
    assert.match(about, /localement sur votre appareil/);
    assert.match(about, /__VERSION__/);
    assert.match(about, /mailto:kwhiz@aubard.net/);
    assert.match(about, /apps.aubard.net/);
    assert.doesNotMatch(about, /origin-label[^>]*>[\s\S]*(Mon choix|Comparer|Opérateurs)/);
    assert.doesNotMatch(about, /about-export-data|install-steps|Revoir l’introduction/);
});
