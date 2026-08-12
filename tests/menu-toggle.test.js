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

test('Menu ferme toute page issue du menu sans rouvrir le tiroir', () => {
    const handler = navigation.slice(navigation.indexOf("on('bnav-menu'"), navigation.indexOf("on('menu-drawer-backdrop'"));
    assert.match(handler, /document\.querySelector\('\.page-overlay\.open'\)/);
    assert.match(handler, /if \(openPage\) \{\s*closeAllPages\(\);\s*return;/);
    assert.ok(handler.indexOf('if (openPage)') < handler.indexOf("drawer?.classList.contains('open')"));
    assert.ok(handler.indexOf('return;') < handler.lastIndexOf('openDrawer();'));
});

test('les quatre pages du menu utilisent le gestionnaire centralisé', () => {
    for (const [trigger, page] of [['menu-help', 'page-aide'], ['menu-about', 'page-about'], ['menu-infos', 'page-infos'], ['menu-settings', 'page-settings']]) {
        assert.match(navigation, new RegExp(`on\\('${trigger}', 'click', \\(\\) => openPage\\('${page}'\\)\\)`));
    }
    assert.match(navigation, /closeAllPages[\s\S]*setActiveNav\(`bnav-\$\{currentView\}`\)/);
    assert.match(navigation, /closeAllPages[\s\S]*aria-expanded', 'false'/);
});

test('le bouton Menu expose correctement son état ouvert', () => {
    assert.match(indexHtml, /id="bnav-menu"[^>]*aria-expanded="false"|aria-expanded="false"[^>]*id="bnav-menu"/);
    assert.match(navigation, /setAttribute\('aria-expanded', 'true'\)/);
    assert.match(navigation, /setAttribute\('aria-expanded', 'false'\)/);
});
