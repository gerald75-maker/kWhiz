import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setLanguage, t } from '../src/i18n/i18n.js';

// index.html porte le texte français affiché avant le démarrage du JavaScript ; le dictionnaire
// de src/i18n/i18n.js le remplace ensuite. Ce test garantit que les deux disent la même chose,
// pour tout élément et tout attribut traduit, sans liste à tenir à la main.

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const decode = value => value.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, entity => ENTITIES[entity]);
const normalize = value => decode(value).replace(/\s+/g, ' ').trim();

test('le texte statique de index.html est identique au dictionnaire français', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    setLanguage('fr', { persist: false, translate: false });
    const differences = [];
    let checked = 0;

    // Éléments feuilles : <balise … data-i18n="clé" …>texte</balise>
    for (const match of html.matchAll(/<([a-z0-9]+)\b[^>]*\sdata-i18n="([^"]+)"[^>]*>([^<]*)<\/\1>/g)) {
        const [, , key, text] = match;
        const expected = t(key);
        if (expected.includes('{')) continue; // gabarit rempli à l'exécution
        checked += 1;
        if (normalize(text) !== normalize(expected)) differences.push(`${key} : « ${normalize(text)} » ≠ « ${normalize(expected)} »`);
    }

    // Attributs traduits : aria-label, placeholder, title, alt
    for (const [suffix, attribute] of [['aria-label', 'aria-label'], ['placeholder', 'placeholder'], ['title', 'title'], ['alt', 'alt']]) {
        for (const match of html.matchAll(new RegExp(`<[a-z0-9]+\\b[^>]*\\sdata-i18n-${suffix}="([^"]+)"[^>]*>`, 'g'))) {
            const tag = match[0];
            const key = match[1];
            const value = tag.match(new RegExp(`\\s${attribute}="([^"]*)"`))?.[1];
            const expected = t(key);
            if (value === undefined || expected.includes('{')) continue;
            checked += 1;
            if (normalize(value) !== normalize(expected)) differences.push(`${key} (${attribute}) : « ${normalize(value)} » ≠ « ${normalize(expected)} »`);
        }
    }

    assert.ok(checked > 150, `seulement ${checked} textes contrôlés : l'analyse de index.html ne fonctionne plus`);
    assert.deepEqual(differences, []);
});
