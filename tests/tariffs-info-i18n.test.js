import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setLanguage, t, translateDocument } from '../src/i18n/i18n.js';
import { tariffSources } from '../src/ui/tariffs-info.js';

const root = new URL('../', import.meta.url);
const [html, i18nSource, tariffs] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('src/i18n/i18n.js', root), 'utf8'),
  readFile(new URL('public/tarifs.json', root), 'utf8').then(JSON.parse)
]);
const infos = html.slice(html.indexOf('id="page-infos"'), html.indexOf('id="formula-detail-overlay"'));
const keys = [
  'tariffsInfo.calculationTitle', 'tariffsInfo.calculationText', 'tariffsInfo.energyFormula',
  'tariffsInfo.costFormula', 'tariffsInfo.variableTitle', 'tariffsInfo.variableText',
  'tariffsInfo.verificationTitle', 'tariffsInfo.verificationText', 'tariffsInfo.sourcesTitle'
];

test('Tarifs et sources contient exactement quatre blocs courts et structurés', () => {
  assert.equal((infos.match(/class="tariffs-info-block"/g) || []).length, 4);
  for (const key of keys) assert.match(infos, new RegExp(`data-i18n="${key.replaceAll('.', '\\.')}"`));
  assert.doesNotMatch(infos, /Notes importantes|Astuce multi-réseaux|notes-list|formula-code|infos-atlante|infos-tarifs-date/);
  assert.doesNotMatch(infos, /\d+[,.]\d+\s*€|Happy Hours|McDonald’s|Octopus Electroverse/);
});

test('la méthode est naturelle et équivalente en français et en anglais', () => {
  setLanguage('fr', { persist: false, translate: false });
  assert.match(t('tariffsInfo.calculationText'), /consommation.*kilométrage.*part de recharge rapide.*tarifs connus/);
  assert.equal(t('tariffsInfo.energyFormula'), 'Énergie consommée = distance × consommation');
  assert.match(t('tariffsInfo.variableText'), /promotions ponctuelles.*tarifs permanents/);
  assert.match(t('tariffsInfo.verificationText'), /pages officielles.*date de vérification/);

  setLanguage('en', { persist: false, translate: false });
  assert.equal(t('tariffsInfo.calculationTitle'), 'How are costs calculated?');
  assert.equal(t('tariffsInfo.costFormula'), 'Charging cost = energy × price per kWh');
  assert.match(t('tariffsInfo.variableText'), /Temporary promotions.*permanent prices/);
  assert.match(t('tariffsInfo.verificationText'), /official pages.*verification date/);
});

test('les sources proviennent de tous les opérateurs actifs et sont alphabétiques', () => {
  delete tariffs._comment;
  delete tariffs._updated;
  const sources = tariffSources(tariffs);
  const expected = Object.values(tariffs).filter(operator => operator.name && operator.sourceUrl);
  assert.equal(sources.length, expected.length);
  assert.deepEqual(sources.map(source => source.name), [...sources.map(source => source.name)].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })));
  assert.ok(sources.some(source => source.name === 'ENGIE Vianeo'));
  assert.ok(sources.every(source => source.url === tariffs[Object.keys(tariffs).find(key => tariffs[key].name === source.name)].sourceUrl));
  assert.ok(sources.every(source => ['http:', 'https:'].includes(new URL(source.url).protocol)));
  assert.ok(!sources.some(source => /Stations-e/i.test(source.name)));
  assert.deepEqual(tariffSources(), []);
  assert.deepEqual(tariffSources({ incomplete: { name: 'Sans URL' }, statione: { name: 'Stations-e', sourceUrl: 'https://example.com' } }), []);
  assert.match(infos, /id="tariffs-source-list"/);
  assert.doesNotMatch(infos, /href="https?:\/\//);
});

test('la bascule FR/EN ne ferme pas la fenêtre', () => {
  const previousDocument = globalThis.document;
  const previousNode = globalThis.Node;
  const previousNodeFilter = globalThis.NodeFilter;
  globalThis.Node = { ELEMENT_NODE: 1 };
  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  globalThis.document = { documentElement: { lang: '' }, title: '', createTreeWalker: () => ({ nextNode: () => false }), querySelector: () => null, querySelectorAll: () => [], dispatchEvent: () => {} };
  try {
    setLanguage('fr', { persist: false, translate: false });
    translateDocument({ querySelectorAll: () => [] });
    setLanguage('en', { persist: false, translate: false });
    translateDocument({ querySelectorAll: () => [] });
    assert.doesNotMatch(i18nSource.slice(i18nSource.indexOf('export function translateDocument'), i18nSource.indexOf('export function setLanguage')), /close|classList\.remove/);
  } finally {
    globalThis.document = previousDocument;
    globalThis.Node = previousNode;
    globalThis.NodeFilter = previousNodeFilter;
  }
});
