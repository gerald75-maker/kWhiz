import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatTariffsStatusLine, setLanguage, t } from '../src/i18n/i18n.js';
import { renderTarifsDateBanner } from '../src/ui/views/comparison-view.js';

class FakeClassList {
    constructor() { this.values = new Set(); }
    add(value) { this.values.add(value); }
    toggle(value, force) { force ? this.values.add(value) : this.values.delete(value); }
}

function installStatusDocument() {
    const elements = new Map(['tarifs-update-banner', 'tarifs-update-text', 'infos-tarifs-date'].map(id => [id, {
        id,
        textContent: '',
        classList: new FakeClassList()
    }]));
    globalThis.document = {
        getElementById: id => elements.get(id) || null,
        dispatchEvent: () => true
    };
    return elements;
}

test('localise la date et la provenance des tarifs en français et en anglais', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(formatTariffsStatusLine('2026-08-06', 'online'), '6 août 2026 · source en ligne');
    assert.equal(formatTariffsStatusLine('2026-08-06', 'localCache'), '6 août 2026 · cache local');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(formatTariffsStatusLine('2026-08-06', 'online'), '6 August 2026 · online source');
    assert.equal(formatTariffsStatusLine('2026-08-06', 'localCache'), '6 August 2026 · local cache');
});

test('la bannière et la page Tarifs et sources deviennent entièrement anglaises', () => {
    const elements = installStatusDocument();
    setLanguage('en', { persist: false, translate: false });
    renderTarifsDateBanner('2026-08-06', false, { state: 'fresh', ageDays: 3 }, 'online');
    assert.equal(elements.get('tarifs-update-text').textContent, 'Prices checked on 6 August 2026 · online source');
    assert.equal(elements.get('infos-tarifs-date').textContent, 'Prices checked on 6 August 2026 · online source');
    assert.doesNotMatch(elements.get('tarifs-update-text').textContent, /Tarifs|août|source en ligne/);

    renderTarifsDateBanner('2026-01-01', false, { state: 'critical', ageDays: 217 }, 'localCache');
    assert.equal(elements.get('tarifs-update-text').textContent, '⚠️ Prices are too old (217 days) — check before choosing');
});

test('la carte d’état dispose de messages anglais complets', () => {
    setLanguage('en', { persist: false, translate: false });
    assert.equal(t('tariffs.status.loading'), 'Loading…');
    assert.equal(t('tariffs.status.unavailable'), 'Unavailable — keeping the latest calculations');
    assert.equal(t('tariffs.freshness.unknown'), 'Unknown freshness');
    assert.equal(t('appStatus.ready'), 'Installed version ready to check');
    assert.equal(t('appStatus.badge.current'), 'Up to date');
});

test('les instructions iOS et Android reposent sur des fragments stables sans perdre marques ni icônes', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const ios = html.match(/<div id="install-ios">([\s\S]*?)<\/div>/)?.[1] || '';
    const android = html.match(/<div id="install-android">([\s\S]*?)<\/div><\/div>/)?.[1] || '';
    for (const key of ['install.openIn', 'install.tap', 'install.choose', 'install.thenConfirm', 'install.ios.addToHomeScreen']) {
        assert.match(ios, new RegExp(`data-i18n="${key.replaceAll('.', '\\.')}"`));
    }
    for (const key of ['install.openIn', 'install.openMenu', 'install.choose', 'install.or', 'install.thenConfirm', 'install.android.addToHomeScreen', 'install.installApp']) {
        assert.match(android, new RegExp(`data-i18n="${key.replaceAll('.', '\\.')}"`));
    }
    assert.match(ios, /Safari/);
    assert.match(ios, /logos\/share\.png/);
    assert.match(android, /Chrome/);
    assert.match(android, />⋮</);

    setLanguage('en', { persist: false, translate: false });
    const englishInstructions = [
        t('install.openIn'), t('install.tap'), t('install.openMenu'), t('install.choose'),
        t('install.or'), t('install.thenConfirm'), t('install.share'),
        t('install.ios.addToHomeScreen'), t('install.android.addToHomeScreen'), t('install.installApp')
    ].join(' ');
    assert.doesNotMatch(englishInstructions, /Appuyez sur|Choisissez|Ouvrez le menu|\bou\b|puis confirmez/);
});

test('le changement de langue rerend les états conservés sans relancer le chargement', async () => {
    const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
    const callback = source.slice(source.indexOf('onLanguageChange(() => {'), source.indexOf('\n    });', source.indexOf('onLanguageChange(() => {')));
    assert.match(callback, /renderApplicationStatus\(\)/);
    assert.match(callback, /setTariffsStatus\(currentTariffsStatus\)/);
    assert.doesNotMatch(callback, /loadTarifs\(|loadTariffs\(|fetch\(/);
});
