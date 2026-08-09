import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setLanguage, t } from '../src/i18n/i18n.js';

const iziviaKeys = [
  'izivia.title', 'izivia.descriptionBefore', 'izivia.descriptionAfter',
  'izivia.offPeak.short', 'izivia.offPeak.price', 'izivia.offPeak.hours',
  'izivia.peak.short', 'izivia.peak.price', 'izivia.peak.hours', 'izivia.tipLabel', 'izivia.tip'
];
const ionityKeys = [
  'ionityRewards.title', 'ionityRewards.introBefore', 'ionityRewards.freeKwh', 'ionityRewards.introAfter',
  'ionityRewards.fastLane.title', 'ionityRewards.fastLane.condition',
  'ionityRewards.offPeak.title', 'ionityRewards.offPeak.condition',
  'ionityRewards.warningBefore', 'ionityRewards.warningAfter'
];

test('les deux modales utilisent uniquement leurs clés structurées et conservent leur structure ARIA', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const key of [...iziviaKeys, ...ionityKeys]) {
    assert.match(html, new RegExp(`data-i18n="${key.replaceAll('.', '\\.')}"`));
  }
  for (const [overlay, title, close] of [
    ['izivia-overlay', 'izivia-title', 'izivia-close'],
    ['ionity-rewards-overlay', 'ionity-rewards-title', 'ionity-rewards-close']
  ]) {
    assert.match(html, new RegExp(`aria-labelledby="${title}"[^>]*aria-modal="true"[^>]*id="${overlay}"[^>]*role="dialog"`));
    assert.match(html, new RegExp(`<button[^>]*data-i18n-aria-label="common\\.close"[^>]*id="${close}"[^>]*type="button"`));
    assert.match(html, new RegExp(`<h3[^>]*id="${title}"`));
  }
  assert.match(html, /<strong>McDonald's<\/strong>/);
  assert.match(html, /<strong>40 kWh<\/strong>/);
  assert.match(html, /Credits &amp; Rewards/);
});

test('rend intégralement le contenu Izivia en français et en anglais', () => {
  setLanguage('fr', { persist: false, translate: false });
  assert.equal(t('izivia.offPeak.price'), 'Heures creuses : 0,30 €/kWh');
  assert.equal(t('izivia.peak.price'), 'Heures pleines : 0,35 €/kWh');
  assert.match(t('izivia.offPeak.hours'), /9 h.*11 h 30.*15 h.*18 h/);
  setLanguage('en', { persist: false, translate: false });
  const english = iziviaKeys.map(t).join(' ');
  assert.match(english, /Izivia Fast.*Happy Hours schedule/);
  assert.match(english, /Off-peak: €0\.30\/kWh/);
  assert.match(english, /Peak: €0\.35\/kWh/);
  assert.match(english, /9am.*11:30am.*3pm.*6pm/);
  assert.doesNotMatch(english, /horaires|Les bornes|appliquent|Heures creuses|Heures pleines|Astuce|Planifiez/);
});

test('rend intégralement Rewards en français et en anglais sans traduire les marques', () => {
  setLanguage('fr', { persist: false, translate: false });
  assert.match(t('ionityRewards.fastLane.condition'), /85 %.*9 h.*17 h/);
  assert.match(t('ionityRewards.warningAfter'), /IONITY.*Credits & Rewards/);
  setLanguage('en', { persist: false, translate: false });
  const english = ionityKeys.map(t).join(' ');
  assert.match(english, /IONITY Rewards/);
  assert.match(english, /Fast Lane Reward: \+5 kWh/);
  assert.match(english, /Off-Peak Reward: \+5 kWh/);
  assert.match(english, /85%.*9am.*5pm/);
  assert.match(english, /at least.*40 kWh|at least/);
  assert.doesNotMatch(english, /Programme lancé|gratuits|cumulables|Débranchez|Rechargez|Les deux bonus|Le crédit|conditions peuvent/);
});

test('la bascule de langue repose sur le rerendu en place et conserve le cycle modal', async () => {
  const [i18nSource, appSource, modalSource] = await Promise.all([
    readFile(new URL('../src/i18n/i18n.js', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/ui/modal-manager.js', import.meta.url), 'utf8')
  ]);
  assert.match(i18nSource, /document\.querySelectorAll\('\[data-i18n\]'\).*textContent = t/);
  assert.match(appSource, /\{ overlayId: 'izivia-overlay', closeId: 'izivia-close' \}/);
  assert.match(appSource, /\{ overlayId: 'ionity-rewards-overlay', closeId: 'ionity-rewards-close' \}/);
  assert.match(modalSource, /event\.key === 'Escape'/);
  assert.match(modalSource, /const focusable = getFocusable\(activeModal\)/);
  assert.match(modalSource, /element\.inert = true/);
  assert.match(modalSource, /previousFocus\.focus\(\)/);
  assert.doesNotMatch(i18nSource, /replaceChild|replaceWith/);
});

test('les anciennes correspondances exactes des modales ont été supprimées', async () => {
  const source = await readFile(new URL('../src/i18n/i18n.js', import.meta.url), 'utf8');
  const phrases = source.slice(source.indexOf('const phrases = {'), source.indexOf('function detectInitialLanguage'));
  for (const oldPhrase of [
    '🕐 Izivia Fast — horaires Happy Hours', 'Les bornes Izivia Fast chez',
    'Heures creuses : 0,30 €/kWh', 'Programme lancé en juillet 2026',
    'Débranchez avant 85 %', 'Rechargez la nuit, entre 22 h et 6 h'
  ]) assert.doesNotMatch(phrases, new RegExp(oldPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
