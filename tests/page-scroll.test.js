import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, navigation, css] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('src/ui/navigation.js', root), 'utf8'),
  readFile(new URL('styles.css', root), 'utf8')
]);

test('chaque page du menu a un bouton « Revenir en haut » accessible', () => {
  for (const id of ['page-about', 'page-settings', 'page-aide', 'page-infos']) {
    const start = html.indexOf(`id="${id}"`);
    const next = html.indexOf('class="page-overlay aux-drawer"', start + 10);
    const page = html.slice(start, next === -1 ? undefined : next);
    assert.match(page, /<button aria-label="Revenir en haut" class="page-top" data-i18n-aria-label="common\.backToTop" hidden="" type="button">/, id);
  }
  assert.match(navigation, /top\.hidden = sheet\.scrollTop < 320/);
  assert.match(css, /\.page-overlay-sheet \.page-top \{ position:sticky; bottom:14px;/);
});

test('glisser vers le bas ne ferme une page que si le geste commence en haut du contenu', () => {
  // Défaut corrigé en 2.33.3 : remonter une liste fermait la page en atteignant le haut.
  assert.match(navigation, /startedAtTop = sheet\.scrollTop <= 0;/);
  assert.match(navigation, /distance > 70 && startedAtTop && sheet\.scrollTop <= 0/);
  assert.match(navigation, /distance > 70 && drawerStartedAtTop && drawerSheet\.scrollTop <= 0/);
  assert.doesNotMatch(navigation, /distance > 70 && sheet\.scrollTop <= 0\)/);
});
