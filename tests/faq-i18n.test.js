import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, i18n] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('src/i18n/i18n.js', root), 'utf8')
]);
const help = html.slice(html.indexOf('id="page-aide"'), html.indexOf('id="page-infos"'));
const formerTopics = [
  'recommendation', 'fastShare', 'subscriptions', 'breakEven', 'ranking', 'variablePrices',
  'priceGuarantee', 'location', 'availability', 'status', 'route', 'routeLimits',
  'favorites', 'backup', 'offline', 'update'
];

test('les seize anciennes questions et la rubrique FAQ ne sont plus rendues', () => {
  assert.doesNotMatch(help, /faq\.|help-faq|Questions fréquentes|Frequently asked questions/);
  for (const topic of formerTopics) assert.doesNotMatch(help, new RegExp(`faq\\.${topic}\\.`));
});

test('les informations indispensables issues de la FAQ ont été fusionnées', () => {
  for (const key of [
    'help.plan.profile', 'help.plan.favorites', 'help.prices.estimate',
    'help.prices.variable', 'help.map.privacy', 'help.map.statuses', 'help.route.limit'
  ]) assert.match(help, new RegExp(`data-i18n="${key.replaceAll('.', '\\.')}"`));
  assert.match(i18n, /'help\.prices\.estimate'/);
  assert.match(i18n, /'help\.route\.limit'/);
});
