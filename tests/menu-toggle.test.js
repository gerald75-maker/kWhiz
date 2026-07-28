import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const navigation = await readFile(new URL('../src/ui/navigation.js', import.meta.url), 'utf8');
const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('un second clic sur Menu ferme le panneau sans changer de vue', () => {
    assert.match(navigation, /if \(drawer\?\.classList\.contains\('open'\)\) \{[\s\S]*?closeDrawer\(\);[\s\S]*?return;/);
    assert.match(navigation, /event\.preventDefault\(\);/);
    assert.match(navigation, /event\.stopPropagation\(\);/);
});

test('le bouton Menu expose correctement son état ouvert', () => {
    assert.match(indexHtml, /id="bnav-menu"[^>]*aria-expanded="false"|aria-expanded="false"[^>]*id="bnav-menu"/);
    assert.match(navigation, /setAttribute\('aria-expanded', 'true'\)/);
    assert.match(navigation, /setAttribute\('aria-expanded', 'false'\)/);
});
