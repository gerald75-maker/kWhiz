import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

class FakeCustomEvent extends Event {
    constructor(type, options = {}) {
        super(type);
        this.detail = options.detail;
    }
}

test('pwa-manager possède seul le cycle complet du prompt natif', async () => {
    const button = new EventTarget();
    button.hidden = true;
    let standalone = false;
    const listenerCounts = new Map();
    const fakeWindow = new EventTarget();
    const nativeAddEventListener = fakeWindow.addEventListener.bind(fakeWindow);
    fakeWindow.addEventListener = (type, listener, options) => {
        listenerCounts.set(type, (listenerCounts.get(type) || 0) + 1);
        nativeAddEventListener(type, listener, options);
    };
    fakeWindow.matchMedia = () => ({ matches: standalone });
    fakeWindow.navigator = {};

    globalThis.window = fakeWindow;
    globalThis.document = {
        getElementById: id => id === 'install-native-btn' ? button : null
    };
    globalThis.CustomEvent = FakeCustomEvent;

    const tracking = [];
    fakeWindow.addEventListener('kwhiz:pwa-tracking', event => tracking.push(event.detail));

    const { initInstallPrompt, triggerNativeInstall } = await import('../src/pwa/pwa-manager.js');
    initInstallPrompt();
    initInstallPrompt();
    assert.equal(listenerCounts.get('beforeinstallprompt'), 1);
    assert.equal(listenerCounts.get('appinstalled'), 1);

    let promptCalls = 0;
    const acceptedPrompt = new Event('beforeinstallprompt', { cancelable: true });
    acceptedPrompt.prompt = () => { promptCalls += 1; };
    acceptedPrompt.userChoice = Promise.resolve({ outcome: 'accepted' });
    fakeWindow.dispatchEvent(acceptedPrompt);
    assert.equal(acceptedPrompt.defaultPrevented, true);
    assert.equal(button.hidden, false);
    assert.deepEqual(tracking.at(-1), { name: 'pwa-install-available', data: undefined });

    button.addEventListener('click', triggerNativeInstall);
    button.dispatchEvent(new Event('click'));
    button.dispatchEvent(new Event('click'));
    await acceptedPrompt.userChoice;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(promptCalls, 1, 'le bouton réel ne peut consommer le prompt qu’une fois');
    assert.equal(button.hidden, true);
    assert.deepEqual(tracking.at(-1), { name: 'pwa-install', data: { source: 'button' } });
    assert.equal(await triggerNativeInstall(), false, 'le prompt différé est effacé');

    const refusedPrompt = new Event('beforeinstallprompt', { cancelable: true });
    refusedPrompt.prompt = () => { promptCalls += 1; };
    refusedPrompt.userChoice = Promise.resolve({ outcome: 'dismissed' });
    fakeWindow.dispatchEvent(refusedPrompt);
    assert.equal(await triggerNativeInstall(), false);
    assert.equal(button.hidden, true);
    assert.deepEqual(tracking.at(-1), { name: 'pwa-install-dismissed', data: undefined });

    fakeWindow.dispatchEvent(new Event('appinstalled'));
    assert.equal(button.hidden, true);
    assert.deepEqual(tracking.at(-1), { name: 'pwa-install', data: { source: 'browser' } });

    standalone = true;
    button.hidden = false;
    const standalonePrompt = new Event('beforeinstallprompt', { cancelable: true });
    standalonePrompt.prompt = () => { promptCalls += 1; };
    standalonePrompt.userChoice = Promise.resolve({ outcome: 'accepted' });
    fakeWindow.dispatchEvent(standalonePrompt);
    assert.equal(standalonePrompt.defaultPrevented, true);
    assert.equal(button.hidden, true, 'le mode standalone masque l’installation');
    assert.equal(await triggerNativeInstall(), false);
});

test('le suivi conserve les événements Umami sans gérer le prompt', async () => {
    const source = await readFile(new URL('../public/pwa-tracking.js', import.meta.url), 'utf8');
    const tracked = [];
    const fakeWindow = new EventTarget();
    fakeWindow.matchMedia = () => ({ matches: false });
    fakeWindow.navigator = {};
    fakeWindow.umami = { track: (name, data) => tracked.push({ name, data }) };
    const context = vm.createContext({ window: fakeWindow });
    vm.runInContext(source, context);

    for (const detail of [
        { name: 'pwa-install-available' },
        { name: 'pwa-install', data: { source: 'button' } },
        { name: 'pwa-install-dismissed' },
        { name: 'pwa-install', data: { source: 'browser' } }
    ]) {
        const event = new Event('kwhiz:pwa-tracking');
        event.detail = detail;
        fakeWindow.dispatchEvent(event);
    }

    assert.deepEqual(tracked.map(({ name }) => name), [
        'pwa-install-available',
        'pwa-install',
        'pwa-install-dismissed',
        'pwa-install'
    ]);
    assert.doesNotMatch(source, /beforeinstallprompt|appinstalled|pwa-install-btn|triggerPWAInstall/);

    delete fakeWindow.umami;
    const event = new Event('kwhiz:pwa-tracking');
    event.detail = { name: 'pwa-install-available' };
    assert.doesNotThrow(() => fakeWindow.dispatchEvent(event));
});

test('le parcours iOS conserve les instructions manuelles', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const iosBlock = html.match(/<div id="install-ios">([\s\S]*?)<\/div>/)?.[1] || '';
    assert.match(iosBlock, /Safari/);
    assert.match(iosBlock, /Sur l’écran d’accueil/);
});
