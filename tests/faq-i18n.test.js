import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setLanguage, t, translateDocument } from '../src/i18n/i18n.js';

const root = new URL('../', import.meta.url);
const [html, i18nSource] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('src/i18n/i18n.js', root), 'utf8')
]);
const faq = html.slice(html.indexOf('<details class="help-topic"><summary data-i18n="faq.title"'), html.indexOf('</div></details></div></div></div></div>'));
const topics = [
  'recommendation', 'fastShare', 'subscriptions', 'breakEven', 'ranking', 'variablePrices',
  'priceGuarantee', 'location', 'availability', 'status', 'route', 'routeLimits',
  'favorites', 'backup', 'offline', 'update'
];

test('les seize questions et réponses utilisent exclusivement faq.*', () => {
  assert.match(faq, /data-i18n="faq\.title"/);
  assert.equal((faq.match(/<details>/g) || []).length, 16);
  for (const topic of topics) {
    assert.match(faq, new RegExp(`<summary data-i18n="faq\\.${topic}\\.question">`));
    assert.match(faq, new RegExp(`<p data-i18n="faq\\.${topic}\\.answer">`));
  }
  assert.doesNotMatch(faq, /<details[^>]+name=|onclick=|data-accordion/);
});

test('la FAQ est complète en français et en anglais naturel', () => {
  setLanguage('fr', { persist: false, translate: false });
  assert.equal(t('faq.title'), 'Questions fréquentes');
  assert.match(t('faq.route.answer'), /15 km/);
  assert.match(t('faq.backup.answer'), /« Créer une sauvegarde »/);
  assert.match(t('faq.backup.answer'), /« Restaurer une sauvegarde »/);

  setLanguage('en', { persist: false, translate: false });
  assert.equal(t('faq.title'), 'Frequently asked questions');
  assert.match(t('faq.route.answer'), /within 15 km/);
  assert.match(t('faq.backup.answer'), /“Create a backup”/);
  assert.match(t('faq.backup.answer'), /“Restore a backup”/);
  const english = topics.flatMap(topic => [t(`faq.${topic}.question`), t(`faq.${topic}.answer`)]).join(' ');
  assert.doesNotMatch(english, /Réglez|kilométrage|bornes|tarifs|réglages|sauvegarde|itinéraire|abonnement/);
  for (const name of ['kWhiz', 'Safari', 'PWA', 'IRVE']) assert.match(english, new RegExp(name));
});

test('une bascule de langue conserve plusieurs réponses ouvertes', () => {
  const details = [{ open: true }, { open: false }, { open: true }];
  const nodes = [
    { dataset: { i18n: 'faq.title' }, textContent: '' },
    { dataset: { i18n: 'faq.route.question' }, textContent: '' },
    { dataset: { i18n: 'faq.route.answer' }, textContent: '' }
  ];
  const previousDocument = globalThis.document;
  const previousNodeFilter = globalThis.NodeFilter;
  const previousNode = globalThis.Node;
  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  globalThis.Node = { ELEMENT_NODE: 1 };
  globalThis.document = {
    documentElement: { lang: '' }, title: '',
    createTreeWalker: () => ({ nextNode: () => false }),
    querySelector: () => null,
    querySelectorAll: selector => selector === '[data-i18n]' ? nodes : [],
    dispatchEvent: () => {}
  };
  const rootNode = { querySelectorAll: () => [] };
  try {
    setLanguage('en', { persist: false, translate: false });
    translateDocument(rootNode);
    assert.deepEqual(details.map(item => item.open), [true, false, true]);
    assert.equal(nodes[1].textContent, 'How do I find chargers along a route?');
    setLanguage('fr', { persist: false, translate: false });
    translateDocument(rootNode);
    assert.deepEqual(details.map(item => item.open), [true, false, true]);
    assert.equal(nodes[1].textContent, 'Comment trouver les stations sur un trajet ?');
  } finally {
    globalThis.document = previousDocument;
    globalThis.NodeFilter = previousNodeFilter;
    globalThis.Node = previousNode;
  }
});

test('les anciennes correspondances exactes de la FAQ ont disparu seules', () => {
  const phrases = i18nSource.slice(i18nSource.indexOf('const phrases ='), i18nSource.indexOf('function translateText'));
  for (const oldText of [
    'Questions fréquentes', 'Comment obtenir une recommandation personnalisée ?',
    'Que signifie la part de recharge rapide ?', 'Mes réglages sont-ils sauvegardés ?',
    'Comment actualiser l’application et les tarifs ?'
  ]) assert.doesNotMatch(phrases, new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(phrases, /Tarifs et sources/);
  assert.match(i18nSource, /'tariffsInfo\.title'/);
  assert.match(i18nSource, /'help\.gettingStarted\.title'/);
});
