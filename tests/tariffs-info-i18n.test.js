import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setLanguage, t, translateDocument } from '../src/i18n/i18n.js';

const root = new URL('../', import.meta.url);
const [html, i18nSource] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('src/i18n/i18n.js', root), 'utf8')
]);
const infos = html.slice(html.indexOf('id="page-infos"'), html.indexOf('id="formula-detail-overlay"'));
const staticKeys = [
  'tariffsInfo.title', 'tariffsInfo.closeLabel', 'tariffsInfo.estimateNotice',
  'tariffsInfo.calculationTitle', 'tariffsInfo.formulaKwh', 'tariffsInfo.formulaKm',
  'tariffsInfo.notesTitle', 'tariffsInfo.iechargeNote', 'tariffsInfo.teslaNote',
  'tariffsInfo.electraNote', 'tariffsInfo.lidlNote', 'tariffsInfo.iziviaNote',
  'tariffsInfo.multiNetworkTipTitle', 'tariffsInfo.multiNetworkTipBefore', 'tariffsInfo.sourcesLabel'
];

test('Tarifs et sources utilise ses clés structurées sans toucher aux données dynamiques', () => {
  for (const key of staticKeys) assert.match(infos, new RegExp(`(?:data-i18n|data-i18n-aria-label)="${key.replaceAll('.', '\\.')}`));
  assert.match(infos, /id="infos-atlante-cb-text"/);
  assert.match(infos, /id="infos-tarifs-date"/);
  assert.match(infos, /data-i18n="tariffsInfo\.sourcesLabel"/);
  assert.doesNotMatch(infos, /innerHTML/);
});

test('les textes Tarifs et sources sont naturels en FR et EN et conservent les marques', () => {
  setLanguage('fr', { persist: false, translate: false });
  assert.equal(t('tariffsInfo.title'), 'Tarifs et sources');
  assert.ok(t('tariffsInfo.electraNote').includes('4,99 €/mois'));
  assert.match(t('tariffsInfo.iziviaNote'), /McDonald’s/);
  assert.match(t('tariffsInfo.multiNetworkTipBefore'), /réseaux partenaires/);

  setLanguage('en', { persist: false, translate: false });
  assert.equal(t('tariffsInfo.title'), 'Prices and sources');
  assert.match(t('tariffsInfo.formulaKwh'), /Min\. kWh\/month/);
  assert.ok(t('tariffsInfo.teslaNote').includes('€0.12 to €0.17/kWh'));
  assert.match(t('tariffsInfo.iziviaNote'), /McDonald’s/);
  const english = staticKeys.map(t).join(' ');
  assert.doesNotMatch(english, /Tarifs|Formule|Notes|tarif|abonnement|réseaux|application/);
  for (const name of ['IECharge', 'Tesla', 'Electra', 'Lidl', 'Izivia', 'Happy Hours', 'McDonald’s', 'Octopus Electroverse']) {
    assert.match(`${infos} ${i18nSource}`, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('les URL officielles restent inchangées et la langue ne ferme pas la fenêtre', () => {
  const urls = [...infos.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(urls, [
    'https://electroverse.com/fr-FR/map',
    'https://www.ionity.eu/fr/abonnements',
    'https://www.go-electra.com/fr/electra-plus/',
    'https://atlante.energy/fr/myatlante-app/',
    'https://iecharge.io/fr/prix/',
    'https://www.tesla.com/fr_fr/support/supercharger'
  ]);
  const details = [{ open: true }, { open: false }];
  const previousDocument = globalThis.document;
  const previousNode = globalThis.Node;
  const previousNodeFilter = globalThis.NodeFilter;
  globalThis.Node = { ELEMENT_NODE: 1 };
  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  globalThis.document = {
    documentElement: { lang: '' }, title: '',
    createTreeWalker: () => ({ nextNode: () => false }),
    querySelector: () => null,
    querySelectorAll: () => [],
    dispatchEvent: () => {}
  };
  try {
    setLanguage('fr', { persist: false, translate: false });
    translateDocument({ querySelectorAll: () => [] });
    setLanguage('en', { persist: false, translate: false });
    translateDocument({ querySelectorAll: () => [] });
    assert.deepEqual(details.map(item => item.open), [true, false]);
  } finally {
    globalThis.document = previousDocument;
    globalThis.Node = previousNode;
    globalThis.NodeFilter = previousNodeFilter;
  }
});

test('les anciennes correspondances exactes propres à Tarifs et sources ont disparu', () => {
  const phrases = i18nSource.slice(i18nSource.indexOf('const phrases ='), i18nSource.indexOf('function translateText'));
  for (const oldText of ['Tarifs et sources', 'Formule de calcul', 'Notes importantes', 'Astuce multi-réseaux', 'Sources :', 'tarif fixe de 0,25 €/kWh', 'super heures creuses de 0,12 à 0,17 €/kWh la nuit', 'permet d’accéder à de nombreux réseaux partenaires']) {
    assert.doesNotMatch(phrases, new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(i18nSource, /tariffsInfo\.atlanteChargeback\.summary/);
});
