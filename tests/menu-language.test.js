import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initMenuLanguage } from '../src/ui/menu-language.js';

class FakeButton extends EventTarget {
    constructor(language) {
        super();
        this.dataset = { language };
        this.attributes = new Map();
        this.focused = false;
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    focus() { this.focused = true; }
}

test('le sélecteur est uniquement dans le menu, entre Apparence et Données et réglages', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const menu = html.slice(html.indexOf('id="menu-drawer"'), html.indexOf('<script src="./app.js"'));
    const settings = html.slice(html.indexOf('id="page-settings"'), html.indexOf('<!-- Page : Plus d\'infos'));
    assert.match(menu, /id="menu-language-fr"/);
    assert.match(menu, /id="menu-language-en"/);
    assert.ok(menu.indexOf('id="menu-theme"') < menu.indexOf('id="menu-language-fr"'));
    assert.ok(menu.indexOf('id="menu-language-en"') < menu.indexOf('id="menu-settings"'));
    assert.doesNotMatch(settings, /data-language=|language-choice|language-status/);
});

test('FR vers EN et EN vers FR gardent le menu ouvert, le focus et l’état accessible', () => {
    const french = new FakeButton('fr');
    const english = new FakeButton('en');
    const status = { textContent: '' };
    const drawer = { open: true };
    const storage = new Map();
    const documentElement = { lang: 'fr' };
    let language = 'fr';
    const translations = {
        fr: 'Langue modifiée.',
        en: 'Language updated.'
    };
    const documentRoot = {
        querySelectorAll: selector => selector === '[data-language]' ? [french, english] : [],
        getElementById: id => id === 'menu-language-status' ? status : null
    };
    const setLanguage = value => {
        language = value;
        documentElement.lang = value;
        storage.set('kwhiz_language', value);
    };
    initMenuLanguage({
        documentRoot,
        getLanguage: () => language,
        setLanguage,
        t: () => translations[language]
    });

    english.dispatchEvent(new Event('click'));
    assert.equal(language, 'en');
    assert.equal(documentElement.lang, 'en');
    assert.equal(storage.get('kwhiz_language'), 'en');
    assert.equal(english.attributes.get('aria-pressed'), 'true');
    assert.equal(french.attributes.get('aria-pressed'), 'false');
    assert.equal(english.focused, true);
    assert.equal(drawer.open, true);
    assert.equal(status.textContent, 'Language updated.');

    french.dispatchEvent(new Event('click'));
    assert.equal(language, 'fr');
    assert.equal(documentElement.lang, 'fr');
    assert.equal(storage.get('kwhiz_language'), 'fr');
    assert.equal(french.attributes.get('aria-pressed'), 'true');
    assert.equal(french.focused, true);
    assert.equal(drawer.open, true);
    assert.equal(status.textContent, 'Langue modifiée.');
});

test('les identifiants sont uniques et les règles mobiles évitent une largeur fixe', async () => {
    const [html, css] = await Promise.all([
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../styles.css', import.meta.url), 'utf8')
    ]);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length);
    const rules = css.slice(css.indexOf('.menu-language-item'), css.indexOf('.page-body', css.indexOf('.menu-language-item')));
    assert.match(rules, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(rules, /min-width:\s*0/);
    assert.match(rules, /max-width:\s*100%/);
    assert.doesNotMatch(rules, /width:\s*\d+px/);
});
