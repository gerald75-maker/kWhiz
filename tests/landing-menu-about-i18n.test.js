import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setLanguage, t } from '../src/i18n/i18n.js';

const [html, i18nSource, appSource, navigationSource, themeSource] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/i18n/i18n.js', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/ui/navigation.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/ui/theme.js', import.meta.url), 'utf8')
]);

function fragment(start, end) {
  return html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
}

test('l’introduction complète repose sur landing.* en FR et EN', () => {
  const landing = fragment('id="landing-overlay"', '<!-- Popup de mise à jour');
  for (const key of ['landing.title', 'landing.step.profile', 'landing.step.compare', 'landing.step.map', 'landing.continue', 'landing.help']) {
    assert.match(landing, new RegExp(`data-i18n="${key.replaceAll('.', '\\.')}"`));
  }
  assert.equal((landing.match(/<li /g) || []).length, 3);
  setLanguage('fr', { persist: false, translate: false });
  assert.equal(t('landing.continue'), 'Commencer');
  setLanguage('en', { persist: false, translate: false });
  assert.equal(t('landing.title'), 'Find the right fast-charging plan for your usage');
  assert.equal(t('landing.help'), 'How does kWhiz work?');
});

test('le menu complet utilise ses clés sans modifier son ordre ni ses fonctions', () => {
  const menu = fragment('id="menu-drawer"', '<script src="./app.js"');
  for (const key of [
    'menu.title', 'menu.subtitle', 'menu.closeLabel', 'menu.sections.learn', 'menu.sections.application',
    'menu.sections.about', 'menu.items.help', 'menu.items.helpDescription', 'menu.items.introduction',
    'menu.items.introductionDescription', 'menu.items.prices', 'menu.items.pricesDescription',
    'menu.items.appearance', 'menu.items.settings', 'menu.items.settingsDescription',
    'menu.items.about', 'menu.items.aboutDescription', 'menu.dataSourced'
  ]) assert.match(menu, new RegExp(`data-i18n(?:-aria-label)?="${key.replaceAll('.', '\\.')}"`), key);

  const order = ['menu-help', 'menu-landing', 'menu-infos', 'menu-theme', 'menu-language-fr', 'menu-settings', 'menu-about'];
  order.reduce((previous, id) => {
    const position = menu.indexOf(`id="${id}"`);
    assert.ok(position > previous, id);
    return position;
  }, -1);
  assert.match(themeSource, /t\('theme\.dark'\).*t\('theme\.light'\)/s);
  assert.match(appSource, /installSection\.hidden = isStandalone/);
});

test('À propos est complet en FR et EN et préserve version, e-mail et URL', () => {
  const about = fragment('id="page-about"', '<!-- Page : Données et réglages');
  for (const key of ['about.title', 'about.tagline', 'about.scope', 'about.privacy', 'about.version', 'about.enjoy', 'about.feedback', 'about.otherApps']) {
    assert.match(about, new RegExp(`data-i18n="${key.replaceAll('.', '\\.')}"`), key);
  }
  assert.match(about, /<span>__VERSION__<\/span>/);
  assert.match(about, /href="mailto:kwhiz@aubard\.net">kwhiz@aubard\.net<\/a>/);
  assert.match(about, /href="https:\/\/apps\.aubard\.net"/);
  setLanguage('en', { persist: false, translate: false });
  assert.equal(t('about.title'), 'About');
  assert.match(t('about.scope'), /operating in France/);
  assert.match(t('about.privacy'), /stored locally/);
});

test('la bascule de langue conserve les couches ouvertes et le focus', () => {
  const callback = appSource.slice(appSource.indexOf('onLanguageChange(() => {'), appSource.indexOf('\n    });', appSource.indexOf('onLanguageChange(() => {')));
  assert.doesNotMatch(callback, /hideLanding|closeDrawer|closeAllPages|switchView/);
  assert.match(appSource, /landingTrigger = document\.activeElement/);
  assert.match(appSource, /document\.getElementById\('landing-start'\)\?\.focus\(\)/);
  assert.match(appSource, /landingTrigger instanceof HTMLElement/);
  assert.match(navigationSource, /on\('menu-landing'.*closeDrawer\(\).*onShowLanding/s);
});

test('les anciennes correspondances exactes du lot ont disparu', () => {
  const legacy = i18nSource.slice(i18nSource.indexOf('const phrases = {'), i18nSource.indexOf('\n};', i18nSource.indexOf('const phrases = {')));
  for (const phrase of [
    'Trouvez l’offre de recharge rapide adaptée à votre usage', 'Commencer', 'Comment fonctionne kWhiz',
    'Fermer le menu', 'À propos de kWhiz', 'Projet, version et contact',
    'kWhiz rend les tarifs de recharge rapide plus faciles à comprendre et à comparer.',
    'Actualisation, sauvegarde et installation', 'Comparateur de recharge rapide', 'Menu kWhiz',
    'Apparence', 'Mode clair ou sombre', 'Données sourcées'
  ]) assert.doesNotMatch(legacy, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), phrase);
});
