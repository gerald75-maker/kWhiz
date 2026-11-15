import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { LOGOS } from '../src/config/app-config.js';
import { operatorLogoAssets } from '../scripts/inject-build-vars.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('tous les logos d’opérateurs sont précachés pour le hors ligne', () => {
  const assets = operatorLogoAssets();
  for (const logo of Object.values(LOGOS)) assert.ok(assets.includes(logo), `${logo} absent du précache`);
});

test('chaque logo déclaré existe et reste léger', async () => {
  for (const logo of Object.values(LOGOS)) {
    const path = `public/${logo.replace(/^\.\//, '')}`;
    await access(new URL(path, root));
    const { size } = await import('node:fs/promises').then(fs => fs.stat(new URL(path, root)));
    assert.ok(size <= 20 * 1024, `${logo} pèse ${size} octets (20 Ko maximum)`);
  }
});

test('public/logos ne contient que des fichiers utilisés', async () => {
  const sources = (await Promise.all([
    'index.html', 'app.js', 'styles.css', 'src/config/app-config.js'
  ].map(read))).join('\n');
  const files = (await readdir(new URL('public/logos/', root), { withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => entry.name);
  const unused = files.filter(name => !sources.includes(`logos/${name}`));
  assert.deepEqual(unused, [], `fichiers inutilisés : ${unused.join(', ')}`);
});

test('l’icône Partager garde ses proportions et porte son nom dans alt', async () => {
  const html = await read('index.html');
  const img = html.match(/<img[^>]*src="\.\/logos\/share\.png"[^>]*>/)[0];
  assert.match(img, /alt="Partager"/);
  assert.match(img, /data-i18n-alt="install\.share"/);
  assert.doesNotMatch(img, /aria-label/);
  // Fichier source 50 × 63 : 18 px de large donnent 23 px de haut.
  assert.match(img, /width="18"/);
  assert.match(img, /height="23"/);
});
