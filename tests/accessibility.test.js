import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeOverlappingGroups, MIN_CLUSTER_GAP_PX } from '../src/ui/map-clusters.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [css, html] = await Promise.all([read('styles.css'), read('index.html')]);

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `règle introuvable : ${selector}`);
  return match[1];
}

// Un panneau masqué par la seule opacité reste atteignable avec Tab (WCAG 2.4.3, 4.1.2).
for (const [closed, open, delay] of [
  ['.help-overlay', '.help-overlay.open', '0.22s'],
  ['.page-overlay.aux-drawer', '.page-overlay.aux-drawer.open', '.22s'],
  ['.landing-overlay.hidden', null, '0.35s']
]) {
  test(`${closed} fermé est retiré du clavier et des lecteurs d’écran`, () => {
    const body = rule(closed);
    assert.match(body, /visibility:\s*hidden/);
    assert.match(body, new RegExp(`visibility 0s linear ${delay.replace('.', '\\.')}`), 'le fondu de fermeture doit être conservé');
    if (open) {
      const openBody = rule(open);
      assert.match(openBody, /visibility:\s*visible/);
      assert.match(openBody, /visibility 0s(?!\s*linear)/, 'l’ouverture doit rendre le panneau visible sans délai');
    }
  });
}

test('la page a un seul landmark main qui contient les vues', () => {
  assert.equal(html.match(/<main\b/g)?.length, 1);
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  for (const id of ['sticky-top', 'tab-ranking', 'tab-map', 'tab-profile', 'tarifs-update-banner']) {
    assert.ok(main.includes(`id="${id}"`), `#${id} doit être dans <main>`);
  }
  for (const id of ['landing-overlay', 'page-settings', 'bottom-nav', 'menu-drawer']) {
    assert.ok(!main.includes(`id="${id}"`), `#${id} ne doit pas être dans <main>`);
  }
});

test('la carte nommée a un rôle qui autorise aria-label', () => {
  assert.match(html, /<div[^>]*aria-label="[^"]+"[^>]*role="region"[^>]*id="stations-map"/);
});

test('le titre principal n’annonce pas « kWhiz » deux fois', () => {
  const h1 = html.match(/<h1[^>]*id="app-title"[^>]*>([\s\S]*?)<\/h1>/)[1];
  const label = h1.match(/aria-label="([^"]*)"/)[1];
  assert.doesNotMatch(label, /kWhiz/);
});

test('deux groupes de stations proches à l’écran sont fusionnés', () => {
  const point = station => station;
  const a = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
  const b = [{ x: 30, y: 0 }, { x: 40, y: 0 }];
  const far = [{ x: 200, y: 0 }, { x: 210, y: 0 }];
  const groups = mergeOverlappingGroups([a, b, far], point);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map(group => group.length).sort(), [2, 4]);
});

test('les groupes restants sont espacés d’au moins MIN_CLUSTER_GAP_PX', () => {
  const groups = [];
  for (let i = 0; i < 12; i++) groups.push([{ x: i * 20, y: 0 }, { x: i * 20 + 2, y: 3 }]);
  const merged = mergeOverlappingGroups(groups, station => station);
  const centers = merged.map(group => ({
    x: group.reduce((sum, s) => sum + s.x, 0) / group.length,
    y: group.reduce((sum, s) => sum + s.y, 0) / group.length
  }));
  for (let i = 0; i < centers.length; i++) {
    for (let j = i + 1; j < centers.length; j++) {
      assert.ok(Math.hypot(centers[i].x - centers[j].x, centers[i].y - centers[j].y) >= MIN_CLUSTER_GAP_PX);
    }
  }
  assert.equal(merged.flat().length, 24, 'aucune station perdue');
});

test('la station sélectionnée et les stations isolées ne sont jamais absorbées', () => {
  const selected = [{ id: 'sel', x: 5, y: 0 }];
  const single = [{ id: 'one', x: 8, y: 0 }];
  const cluster = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
  const merged = mergeOverlappingGroups([selected, single, cluster], station => station, {
    isPinned: group => group[0].id === 'sel'
  });
  assert.equal(merged.length, 3);
});

test('.text-strong suit le thème (titres iOS / Android lisibles en clair)', () => {
  const rules = [...css.matchAll(/(?:^|\n)\.text-strong\s*\{([^}]*)\}/g)].map(match => match[1]);
  assert.equal(rules.length, 1, 'une seule règle .text-strong');
  assert.match(rules[0], /color:\s*var\(--text-primary\)/);
});
