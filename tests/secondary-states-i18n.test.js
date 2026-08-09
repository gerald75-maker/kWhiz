import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { backupStatusLabel, validateUserDataBackup } from '../src/ui/data-backup.js';
import { initNetworkStatus, networkStatusLabel } from '../src/ui/network-status.js';
import { refreshStatusLabel } from '../src/ui/pull-to-refresh.js';
import { setLanguage, t } from '../src/i18n/i18n.js';

test('localise les erreurs et comptes de sauvegarde sans exposer de message technique', () => {
  setLanguage('fr', { persist: false, translate: false });
  assert.throws(() => validateUserDataBackup(null, []), error => error.message === 'backup.invalid');
  assert.throws(() => validateUserDataBackup({ format: 'old', version: 0, data: {} }, []), error => error.message === 'backup.unsupportedFormat');
  assert.throws(() => validateUserDataBackup({ format: 'kwhiz-user-data', version: 1 }, []), error => error.message === 'backup.missingData');
  assert.equal(backupStatusLabel('backup.restoredOne', 1), '1 réglage restauré.');
  assert.equal(backupStatusLabel('backup.restoredMany', 3), '3 réglages restaurés.');
  setLanguage('en', { persist: false, translate: false });
  assert.equal(backupStatusLabel('backup.restoredOne', 1), '1 setting restored.');
  assert.equal(backupStatusLabel('backup.restoredMany', 3), '3 settings restored.');
  for (const key of ['backup.invalid', 'backup.unsupportedFormat', 'backup.missingData', 'backup.downloaded', 'backup.importFailed', 'backup.restoreFailed']) {
    assert.doesNotMatch(t(key), /Sauvegarde|sauvegarde|Données|Échec|Restauration/);
  }
});

test('localise successivement tous les états réseau', () => {
  const keys = ['network.offlineLocal', 'network.reconnecting', 'network.restored', 'network.pricesUnavailable', 'network.refreshFailed'];
  setLanguage('fr', { persist: false, translate: false });
  const french = keys.map(networkStatusLabel);
  setLanguage('en', { persist: false, translate: false });
  const english = keys.map(networkStatusLabel);
  assert.equal(english[0], 'Offline — using local data.');
  assert.equal(english[1], 'Back online — updating…');
  assert.equal(english[2], 'Connection restored — prices updated.');
  assert.notDeepEqual(english, french);
  assert.doesNotMatch(english.join(' '), /hors ligne|Connexion|tarifs|actualisation/i);
});

test('la bascule de langue rerend l’état réseau courant sans simuler une reconnexion', async () => {
  const saved = Object.fromEntries(['document', 'window', 'navigator'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const label = { textContent: '' };
  const classes = new Set();
  const status = {
    dataset: {},
    classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
    querySelector: () => label
  };
  const listeners = new Map();
  const navigatorRef = { onLine: false };
  const windowRef = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => { if (listeners.get(type) === listener) listeners.delete(type); },
    setTimeout: () => 1,
    clearTimeout: () => {}
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { getElementById: () => status, dispatchEvent: () => true } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: windowRef });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigatorRef });
  let reconnects = 0;
  try {
    setLanguage('fr', { persist: false, translate: false });
    const controller = initNetworkStatus({ onReconnect: async () => { reconnects += 1; return { ok: true }; } });
    assert.equal(label.textContent, 'Hors ligne — utilisation des données locales.');
    setLanguage('en', { persist: false, translate: false });
    assert.equal(label.textContent, 'Offline — using local data.');
    assert.equal(reconnects, 0);
    navigatorRef.onLine = true;
    await controller.update();
    assert.equal(reconnects, 1);
    assert.equal(label.textContent, 'Connection restored — prices updated.');
    setLanguage('fr', { persist: false, translate: false });
    assert.equal(label.textContent, 'Connexion rétablie — tarifs actualisés.');
    assert.equal(reconnects, 1);
    controller.destroy();
    assert.equal(listeners.size, 0);
  } finally {
    for (const [name, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});

test('localise chaque état du pull-to-refresh sans redémarrer son action', async () => {
  const states = ['idle', 'pulling', 'ready', 'refreshing', 'checking', 'updating', 'appUpdated', 'success', 'error'];
  setLanguage('fr', { persist: false, translate: false });
  assert.deepEqual(states.map(refreshStatusLabel), [
    'Tirez pour actualiser', 'Tirez pour actualiser', 'Relâchez pour actualiser', 'Actualisation…',
    'Recherche d’une nouvelle version…', 'Mise à jour de kWhiz…', 'kWhiz a été mis à jour',
    'Tarifs actualisés', 'Actualisation impossible'
  ]);
  setLanguage('en', { persist: false, translate: false });
  const english = states.map(refreshStatusLabel);
  assert.equal(english[2], 'Release to refresh');
  assert.equal(english[4], 'Checking for a new version…');
  assert.doesNotMatch(english.join(' '), /Tirez|Relâchez|Actualisation|Recherche/);

  const source = await readFile(new URL('../src/ui/pull-to-refresh.js', import.meta.url), 'utf8');
  const languageCallback = source.slice(source.indexOf('const renderLabel'), source.indexOf('const setState'));
  assert.doesNotMatch(languageCallback, /onRefresh|handleEnd|setState|scheduleReset/);
  assert.match(source, /onLanguageChange\(renderLabel\)/);
  assert.match(source, /stopLanguageListener\(\)/);
});

test('les composants conservent un état sémantique et libèrent leurs écouteurs', async () => {
  const [backup, network, refresh] = await Promise.all([
    readFile(new URL('../src/ui/data-backup.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/ui/network-status.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/ui/pull-to-refresh.js', import.meta.url), 'utf8')
  ]);
  assert.match(backup, /currentStatus = \{ key/);
  assert.match(network, /currentMessageKey = messageKey/);
  assert.match(refresh, /currentState = state/);
  for (const source of [backup, network, refresh]) {
    assert.match(source, /stopLanguageListener\(\)/);
    assert.doesNotMatch(source, /getLanguage\(\) === 'en'/);
  }
});
