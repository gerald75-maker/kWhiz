import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setLanguage, t } from '../src/i18n/i18n.js';

const root = new URL('../', import.meta.url);
const [html, i18nSource] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('src/i18n/i18n.js', root), 'utf8')
]);
const help = html.slice(html.indexOf('id="page-aide"'), html.indexOf('<details class="help-topic"><summary data-i18n="faq.title"'));

test('l’aide générale utilise des clés structurées dans l’ordre actuel', () => {
  const orderedSections = [
    'help.gettingStarted.title', 'help.results.title', 'help.map.title',
    'help.route.title', 'help.planners.title'
  ];
  let previous = -1;
  for (const key of orderedSections) {
    const position = help.indexOf(`data-i18n="${key}"`);
    assert.ok(position > previous, `${key} doit conserver sa position`);
    previous = position;
  }
  assert.match(help, /data-i18n="help\.title"/);
  assert.match(help, /data-i18n-aria-label="help\.closeLabel"/);
  assert.equal((help.match(/<ol class="help-ordered-list">/g) || []).length, 2);
  assert.equal((help.match(/<details class="help-topic">/g) || []).length, 5);
  assert.doesNotMatch(help, /<details[^>]+name=/);
});

test('le contenu complet existe en français et en anglais sans traduire les marques', () => {
  setLanguage('fr', { persist: false, translate: false });
  assert.equal(t('help.title'), 'Aide et FAQ');
  assert.match(t('help.map.locationAfter'), /kWhiz/);
  assert.match(t('help.route.introAfter'), /OpenRouteService/);
  assert.match(t('help.map.irveNote'), /IRVE/);

  setLanguage('en', { persist: false, translate: false });
  assert.equal(t('help.title'), 'Help and FAQ');
  assert.equal(t('help.map.title'), 'Using the map');
  assert.match(t('help.map.directionsAfter'), /Apple Maps, Google Maps or Waze/);
  assert.match(t('help.route.introAfter'), /OpenRouteService/);
  for (const fragment of ['Sélectionnez', 'Appuyez', 'Utilisez', 'Il ne tient compte', 'itinéraires adaptés']) {
    const values = [...i18nSource.matchAll(/'help\.[^']+':\s*'([^']*)'/g)].map(match => match[1]);
    assert.doesNotMatch(values.slice(values.length / 2).join(' '), new RegExp(fragment));
  }
});

test('les liens et les marques des planificateurs restent intacts', () => {
  for (const [brand, url] of [
    ['myAtlante', 'https://atlante.energy/fr/myatlante-app/'],
    ['ABRP', 'https://abetterrouteplanner.com/'],
    ['Chargemap', 'https://chargemap.com/fr-fr/mobile'],
    ['IECharge', 'https://iecharge.io/'],
    ['Electus', 'https://electus.app/']
  ]) {
    assert.match(help, new RegExp(`href="${url.replaceAll('/', '\\/')}"[^>]*><strong>${brand}</strong>`));
  }
});

test('la bascule de langue ne pilote ni fermeture ni exclusivité des accordéons', () => {
  const translateDocument = i18nSource.slice(i18nSource.indexOf('export function translateDocument'), i18nSource.indexOf('export function setLanguage'));
  assert.doesNotMatch(translateDocument, /\.open|removeAttribute\(['"]open|aria-expanded/);
  assert.doesNotMatch(help, /onclick=|data-accordion|innerHTML/);
});

test('les anciennes correspondances exactes de l’aide générale ont disparu', () => {
  const phrases = i18nSource.slice(i18nSource.indexOf('const phrases ='), i18nSource.indexOf('function translateText'));
  for (const oldText of [
    'Aide et FAQ', 'Bien démarrer', 'Comprendre les résultats', 'Utiliser la carte',
    'Besoin d’un véritable planificateur de recharge ?', 'Réglez votre',
    'Les prix variables restent des estimations :', 'Sélectionnez les opérateurs, ouvrez'
  ]) assert.doesNotMatch(phrases, new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(phrases, /Questions fréquentes/);
  assert.match(i18nSource, /'faq\.title': 'Questions fréquentes'/);
  assert.match(phrases, /Tarifs et sources/);
});
