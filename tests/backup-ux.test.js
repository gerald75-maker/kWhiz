import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initDataBackup } from '../src/ui/data-backup.js';
import { setLanguage } from '../src/i18n/i18n.js';

class FakeElement extends EventTarget {
  constructor() {
    super();
    this.textContent = '';
    this.value = '';
    this.files = [];
    this.disabled = false;
    this.dataset = {};
    this.attributes = new Map();
    this.clicks = 0;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  click() { this.clicks += 1; this.dispatchEvent(new Event('click')); }
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    dump: () => Object.fromEntries(values)
  };
}

function installEnvironment(storage = memoryStorage()) {
  const saved = Object.fromEntries(['document', 'window'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const ids = ['about-data-status', 'about-import-data-file', 'about-export-data', 'about-import-data'];
  const elements = new Map(ids.map(id => [id, new FakeElement()]));
  const documentRef = new EventTarget();
  documentRef.getElementById = id => elements.get(id) || null;
  const windowRef = new EventTarget();
  const scheduled = [];
  windowRef.setTimeout = (callback, delay) => { scheduled.push({ callback, delay }); return scheduled.length; };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: documentRef });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: windowRef });
  const downloads = [];
  let reloads = 0;
  const controller = initDataBackup({
    storageKeys: { landingSeen: 'landing', fastPercentage: 'fast', favorites: 'favorites', language: 'language', theme: 'theme' },
    storage,
    download: (filename, backup) => downloads.push({ filename, backup }),
    schedule: (callback, delay) => { scheduled.push({ callback, delay }); return scheduled.length; },
    reload: () => { reloads += 1; }
  });
  return {
    elements, storage, downloads, scheduled, controller,
    reloads: () => reloads,
    restore() {
      controller.destroy();
      for (const [name, descriptor] of Object.entries(saved)) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    }
  };
}

const backup = data => ({ format: 'kwhiz-user-data', version: 1, data });
const file = value => ({ text: async () => typeof value === 'string' ? value : JSON.stringify(value) });
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('affiche les libellés publics FR et EN sans vocabulaire Exporter ou Importer', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const key of ['backup.title', 'backup.saveButton', 'backup.saveHelp', 'backup.restoreButton', 'backup.restoreHelp']) {
    assert.match(html, new RegExp(`data-i18n="${key.replaceAll('.', '\\.')}"`));
  }
  const section = html.slice(html.indexOf('class="app-status-card data-backup-card"'), html.indexOf('</section>', html.indexOf('class="app-status-card data-backup-card"')));
  assert.doesNotMatch(section, />Exporter<|>Importer<|Exporter mes données|Importer mes données/);
  setLanguage('fr', { persist: false, translate: false });
  assert.equal((await import('../src/i18n/i18n.js')).t('backup.title'), 'Sauvegarde et restauration');
  setLanguage('en', { persist: false, translate: false });
  assert.equal((await import('../src/i18n/i18n.js')).t('backup.restoreHelp'), 'Select a previously downloaded kWhiz backup.');
});

test('une sauvegarde réussie reste visible, accessible et ne se déclenche pas deux fois', () => {
  setLanguage('fr', { persist: false, translate: false });
  const env = installEnvironment(memoryStorage({ language: 'fr', favorites: '[]' }));
  try {
    const button = env.elements.get('about-export-data');
    button.click();
    button.click();
    assert.equal(env.downloads.length, 1);
    assert.equal(button.disabled, true);
    const status = env.elements.get('about-data-status');
    assert.equal(status.textContent, 'Sauvegarde téléchargée.');
    assert.equal(status.getAttribute('role'), 'status');
    assert.equal(status.getAttribute('aria-live'), 'polite');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(status.textContent, 'Backup downloaded.');
    assert.equal(env.downloads.length, 1);
    env.scheduled.find(item => item.delay === 0).callback();
    assert.equal(button.disabled, false);
  } finally { env.restore(); }
});

test('restaure un ou plusieurs réglages et réactive le bouton', async () => {
  for (const [data, expectedFr, expectedEn] of [
    [{ theme: 'light' }, '1 réglage restauré.', '1 setting restored.'],
    [{ theme: 'light', favorites: '[1]' }, '2 réglages restaurés.', '2 settings restored.']
  ]) {
    setLanguage('fr', { persist: false, translate: false });
    const env = installEnvironment(memoryStorage({ theme: 'dark', favorites: '[]' }));
    try {
      const button = env.elements.get('about-import-data');
      const input = env.elements.get('about-import-data-file');
      button.click();
      button.click();
      assert.equal(input.clicks, 1);
      input.files = [file(backup(data))];
      input.dispatchEvent(new Event('change'));
      await settle();
      assert.equal(env.elements.get('about-data-status').textContent, expectedFr);
      assert.equal(button.disabled, false);
      setLanguage('en', { persist: false, translate: false });
      assert.equal(env.elements.get('about-data-status').textContent, expectedEn);
      assert.equal(env.scheduled.some(item => item.delay === 1600), true);
    } finally { env.restore(); }
  }
});

test('distingue les erreurs sans afficher leur détail technique', async () => {
  const cases = [
    [null, '{', 'Échec de l’importation de la sauvegarde.'],
    ['invalid', JSON.stringify(null), 'Sauvegarde invalide.'],
    ['format', JSON.stringify({ format: 'old', version: 1, data: {} }), 'Format de sauvegarde inconnu ou non pris en charge.'],
    ['data', JSON.stringify({ format: 'kwhiz-user-data', version: 1 }), 'Données de sauvegarde manquantes.']
  ];
  for (const [, contents, expected] of cases) {
    setLanguage('fr', { persist: false, translate: false });
    const env = installEnvironment();
    try {
      env.elements.get('about-import-data').click();
      const input = env.elements.get('about-import-data-file');
      input.files = [file(contents)];
      input.dispatchEvent(new Event('change'));
      await settle();
      const status = env.elements.get('about-data-status');
      assert.equal(status.textContent, expected);
      assert.equal(status.getAttribute('role'), 'alert');
      assert.equal(status.getAttribute('aria-live'), 'assertive');
      assert.doesNotMatch(status.textContent, /SyntaxError|JSON|technical|stack/i);
    } finally { env.restore(); }
  }
});

test('annuler le sélecteur ne produit aucun message et réactive le bouton', async () => {
  const env = installEnvironment();
  try {
    const button = env.elements.get('about-import-data');
    button.click();
    const input = env.elements.get('about-import-data-file');
    input.files = [];
    input.dispatchEvent(new Event('change'));
    await settle();
    assert.equal(env.elements.get('about-data-status').textContent, '');
    assert.equal(button.disabled, false);
  } finally { env.restore(); }
});
