import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

function rgb(hex) {
  return hex.match(/[\da-f]{2}/gi).map(value => Number.parseInt(value, 16) / 255);
}

function luminance(hex) {
  const channels = rgb(hex).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

function variables(block) {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map(match => [match[1], match[2]]));
}

test('le texte de l’aide dépasse WCAG AA dans les deux thèmes', () => {
  const dark = variables(css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {'))));
  const lightStart = css.indexOf('body.light {');
  const light = variables(css.slice(lightStart, css.indexOf('}', lightStart)));
  assert.ok(contrast(dark['text-primary'], dark['bg-card']) >= 4.5);
  assert.ok(contrast(light['text-primary'], light['bg-card']) >= 4.5);
});

test('le bleu reste interactif et le texte courant utilise text-primary', () => {
  assert.match(css, /\.help-topic > p\s*\{[^}]*color:var\(--text-primary\)/s);
  assert.match(css, /\.help-topic\[open\] > summary\s*\{[^}]*color:var\(--text-primary\)/s);
  assert.match(css, /\.help-topic > summary::after\s*\{[^}]*color:var\(--accent\)/s);
  assert.doesNotMatch(css, /\.help-topic > p\s*\{[^}]*color:var\(--accent\)/s);
});

test('le focus clavier de l’aide reste nettement visible', () => {
  assert.match(css, /\.help-topic > summary:focus-visible\s*\{[^}]*outline:2px solid var\(--accent\)[^}]*outline-offset/s);
});

test('Tarifs et sources partage le contraste AA de l’aide', () => {
  const dark = variables(css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {'))));
  const lightStart = css.indexOf('body.light {');
  const light = variables(css.slice(lightStart, css.indexOf('}', lightStart)));
  assert.ok(contrast(dark['text-primary'], dark['bg-card']) >= 4.5);
  assert.ok(contrast(light['text-primary'], light['bg-card']) >= 4.5);
  assert.match(css, /#page-infos \.tariffs-info-block p\s*\{[^}]*color:var\(--text-primary\)/s);
  assert.match(css, /#page-infos \.tariffs-source-list a\s*\{[^}]*color:var\(--accent\)/s);
  assert.match(css, /#page-infos \.tariffs-source-list a:focus-visible\s*\{[^}]*outline:2px solid var\(--accent\)/s);
});

test('le classement compact respecte le contraste AA en clair et sombre', () => {
  const dark = variables(css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {'))));
  const lightStart = css.indexOf('body.light {');
  const light = variables(css.slice(lightStart, css.indexOf('}', lightStart)));
  assert.ok(contrast(dark['text-secondary'], dark['bg-card']) >= 4.5);
  assert.ok(contrast(light['text-secondary'], light['bg-card']) >= 4.5);
  assert.match(css, /\.profile-ranking-identity strong[^}]*color: var\(--text-primary\)/s);
  assert.match(css, /\.profile-ranking-cost span[^}]*color: var\(--text-secondary\)/s);
  assert.match(css, /\.favorite-btn:focus-visible[^}]*outline: 2px solid/s);
});
