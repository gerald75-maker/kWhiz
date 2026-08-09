import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setLanguage, t } from '../src/i18n/i18n.js';

test('les fragments de contact About sont entièrement français ou anglais', () => {
    setLanguage('fr', { persist: false, translate: false });
    assert.deepEqual([
        t('about.enjoy'),
        t('about.feedback'),
        t('about.otherApps')
    ], [
        '🙏 Bonne utilisation !',
        'N’hésitez pas à faire part de vos remarques, suggestions ou compliments à',
        'Mes autres applications'
    ]);

    setLanguage('en', { persist: false, translate: false });
    const english = [t('about.enjoy'), t('about.feedback'), t('about.otherApps')];
    assert.deepEqual(english, [
        '🙏 Enjoy using kWhiz!',
        'Feel free to send your comments, suggestions or compliments to',
        'My other apps'
    ]);
    assert.doesNotMatch(english.join(' '), /Bonne utilisation|N’hésitez|Mes autres applications/);
});

test('les clés entourent les liens sans traduire l’email, l’URL, la flèche ou l’icône', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const about = html.slice(html.indexOf('id="page-about"'), html.indexOf('<!-- Page : Données et réglages'));
    assert.match(about, /data-i18n="about\.enjoy"/);
    assert.match(about, /data-i18n="about\.feedback"/);
    assert.match(about, /data-i18n="about\.otherApps"/);
    assert.match(about, /href="mailto:kwhiz@aubard\.net">kwhiz@aubard\.net<\/a>/);
    assert.match(about, /href="https:\/\/apps\.aubard\.net"/);
    assert.match(about, /<span aria-hidden="true">🔗<\/span>/);
    assert.match(about, /<span aria-hidden="true">→<\/span>/);
    assert.match(about, /<span>apps\.aubard\.net<\/span>/);
});

test('le changement FR ↔ EN rerend About sans fermer la page', async () => {
    const [i18nSource, appSource] = await Promise.all([
        readFile(new URL('../src/i18n/i18n.js', import.meta.url), 'utf8'),
        readFile(new URL('../app.js', import.meta.url), 'utf8')
    ]);
    const setLanguageSource = i18nSource.slice(i18nSource.indexOf('export function setLanguage'), i18nSource.indexOf('export function onLanguageChange'));
    assert.match(setLanguageSource, /translateDocument\(\)/);
    assert.match(setLanguageSource, /kwhiz:languagechange/);
    assert.doesNotMatch(setLanguageSource, /reload|location\./);
    const callback = appSource.slice(appSource.indexOf('onLanguageChange(() => {'), appSource.indexOf('\n    });', appSource.indexOf('onLanguageChange(() => {')));
    assert.doesNotMatch(callback, /closeAllPages|closeDrawer|switchView/);
});
