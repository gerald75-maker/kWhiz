import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setLanguage, t, translateDocument } from '../src/i18n/i18n.js';

const root = new URL('../', import.meta.url);
const [html, i18nSource] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('src/i18n/i18n.js', root), 'utf8')
]);
const help = html.slice(html.indexOf('id="page-aide"'), html.indexOf('id="page-infos"'));

test('l’aide contient exactement quatre accordéons natifs indépendants', () => {
  const keys = ['help.plan.title', 'help.prices.title', 'help.map.title', 'help.route.title'];
  assert.equal((help.match(/<details class="help-topic">/g) || []).length, 4);
  assert.equal((help.match(/<summary data-i18n=/g) || []).length, 4);
  for (const key of keys) assert.match(help, new RegExp(`data-i18n="${key.replace('.', '\\.')}"`));
  assert.doesNotMatch(help, /<details[^>]+name=|data-accordion|onclick=|innerHTML/);
});

test('le contenu essentiel existe en français et en anglais', () => {
  setLanguage('fr', { persist: false, translate: false });
  assert.equal(t('help.title'), 'Aide');
  assert.match(t('help.plan.profile'), /Mon choix.*Comparer.*abonnement compris/);
  assert.match(t('help.prices.estimate'), /seuil de rentabilité/);
  assert.match(t('help.prices.variable'), /station.*heure.*affluence.*moyen de paiement/);
  assert.match(t('help.map.usage'), /Plans, Google Maps ou Waze/);
  assert.match(t('help.map.updated'), /date affichée sous le compteur/);
  assert.match(t('help.map.statuses'), /Vert.*Orange.*Rouge.*Gris/);
  assert.match(t('help.map.privacy'), /reste sur votre appareil/);
  assert.match(t('help.route.limit'), /ne planifie pas les arrêts/);
  assert.match(t('help.route.privacy'), /OpenRouteService/);

  setLanguage('en', { persist: false, translate: false });
  assert.equal(t('help.title'), 'Help');
  assert.equal(t('help.plan.title'), 'Choosing a plan');
  assert.equal(t('help.prices.title'), 'Understanding prices');
  assert.match(t('help.map.usage'), /Apple Maps, Google Maps or Waze/);
  assert.match(t('help.map.statuses'), /Green.*Orange.*Red.*Grey/);
  assert.match(t('help.route.limit'), /does not plan stops/);
  assert.match(t('help.route.privacy'), /OpenRouteService/);
});

test('la bascule de langue conserve plusieurs accordéons ouverts', () => {
  const details = [{ open: true }, { open: true }, { open: false }, { open: true }];
  const nodes = [
    { dataset: { i18n: 'help.plan.title' }, textContent: '' },
    { dataset: { i18n: 'help.route.title' }, textContent: '' }
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
  try {
    setLanguage('en', { persist: false, translate: false });
    translateDocument({ querySelectorAll: () => [] });
    assert.deepEqual(details.map(item => item.open), [true, true, false, true]);
    assert.equal(nodes[0].textContent, 'Choosing a plan');
    setLanguage('fr', { persist: false, translate: false });
    translateDocument({ querySelectorAll: () => [] });
    assert.deepEqual(details.map(item => item.open), [true, true, false, true]);
    assert.equal(nodes[0].textContent, 'Choisir une offre');
  } finally {
    globalThis.document = previousDocument;
    globalThis.NodeFilter = previousNodeFilter;
    globalThis.Node = previousNode;
  }
});

test('la FAQ, les planificateurs et les répétitions retirées sont absents de la fenêtre', () => {
  assert.doesNotMatch(help, /Questions fréquentes|Frequently asked questions|help-faq|faq\./);
  assert.doesNotMatch(help, /myAtlante|ABRP|Chargemap|IECharge|Electus/);
  assert.doesNotMatch(help, /Base nationale IRVE|Me localiser|Recentrer|>Tous<|>Aucun</);
  assert.doesNotMatch(i18nSource, /'help\.planners\./);
});
