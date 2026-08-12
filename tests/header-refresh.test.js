import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initPullToRefresh } from '../src/ui/pull-to-refresh.js';

const preserveGlobals = () => Object.fromEntries(['document', 'window', 'navigator'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));

function restoreGlobals(saved) {
    for (const [name, descriptor] of Object.entries(saved)) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
    }
}

function fixture() {
    const classes = new Set();
    const label = { textContent: '' };
    const icon = { setAttribute() {} };
    const style = { setProperty() {} };
    const indicator = {
        dataset: {}, style,
        classList: { add: (...values) => values.forEach(value => classes.add(value)), remove: (...values) => values.forEach(value => classes.delete(value)) },
        querySelector: selector => selector.includes('label') ? label : icon
    };
    const listeners = new Map();
    const trigger = {
        disabled: false,
        attributes: new Map(),
        addEventListener: (type, listener) => listeners.set(type, listener),
        removeEventListener: (type, listener) => { if (listeners.get(type) === listener) listeners.delete(type); },
        setAttribute(name, value) { this.attributes.set(name, value); },
        removeAttribute(name) { this.attributes.delete(name); },
        click() { listeners.get('click')?.({ target: this }); }
    };
    const documentListeners = new Map();
    const windowRef = { scrollY: 0, setTimeout: () => 1, clearTimeout() {}, ontouchstart: null };
    const documentRef = {
        getElementById: id => id === 'pull-to-refresh' ? indicator : id === 'app-refresh-button' ? trigger : null,
        addEventListener: (type, listener) => documentListeners.set(type, listener),
        removeEventListener: (type, listener) => { if (documentListeners.get(type) === listener) documentListeners.delete(type); },
        dispatchEvent: () => true
    };
    return { indicator, label, classes, trigger, listeners, documentListeners, windowRef, documentRef };
}

test('l’en-tête utilise le logo officiel existant dans un bouton accessible FR/EN', async () => {
    const [html, css, i18n, icon, buildScript] = await Promise.all([
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../styles.css', import.meta.url), 'utf8'),
        readFile(new URL('../src/i18n/i18n.js', import.meta.url), 'utf8'),
        readFile(new URL('../public/icon.svg', import.meta.url), 'utf8'),
        readFile(new URL('../scripts/inject-build-vars.mjs', import.meta.url), 'utf8')
    ]);
    const header = html.slice(html.indexOf('<h1 class="app-title"'), html.indexOf('</h1>', html.indexOf('<h1 class="app-title"')));
    assert.match(header, /<button[^>]*data-i18n-aria-label="refresh\.buttonLabel"[^>]*data-i18n-title="refresh\.buttonLabel"[^>]*id="app-refresh-button"/);
    assert.match(header, /<button[^>]*type="button"/, 'le bouton natif conserve l’activation clavier Entrée et Espace');
    assert.match(header, /<img[^>]*src="\.\/icon\.svg"/);
    assert.doesNotMatch(header, /<svg|lineargradient|M288 64L128/);
    assert.match(icon, /Monogramme kW/);
    assert.match(buildScript, /'\.\/icon\.svg'/);
    assert.match(i18n, /'refresh\.buttonLabel': 'Actualiser kWhiz'/);
    assert.match(i18n, /'refresh\.buttonLabel': 'Refresh kWhiz'/);
    assert.match(css, /\.app-refresh-button\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px/);
    assert.match(css, /\.app-refresh-button:focus-visible[\s\S]*?outline:/);
    assert.match(css, /\.app-refresh-button \.app-title__icon[\s\S]*?width:\s*36px/);
});

test('le bouton et le geste partagent un seul déclenchement, les états et le verrou', async () => {
    const saved = preserveGlobals();
    const ui = fixture();
    Object.defineProperty(globalThis, 'document', { configurable: true, value: ui.documentRef });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: ui.windowRef });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { maxTouchPoints: 1, vibrate() {} } });
    let resolveRefresh;
    let calls = 0;
    const states = [];
    try {
        const controller = initPullToRefresh({
            trigger: ui.trigger,
            onRefresh: ({ setStatus }) => {
                calls += 1;
                setStatus('checking');
                return new Promise(resolve => { resolveRefresh = resolve; });
            }
        });
        ui.trigger.click();
        ui.trigger.click();
        assert.equal(calls, 1);
        assert.equal(ui.trigger.disabled, false);
        assert.equal(ui.trigger.attributes.get('aria-busy'), 'true');
        assert.equal(ui.trigger.attributes.get('aria-disabled'), 'true');
        assert.equal(ui.indicator.dataset.state, 'checking');
        states.push(ui.indicator.dataset.state);
        resolveRefresh({ ok: true, state: 'success' });
        await Promise.resolve();
        await Promise.resolve();
        assert.equal(ui.indicator.dataset.state, 'success');
        assert.equal(ui.trigger.attributes.has('aria-busy'), false);
        assert.equal(ui.trigger.attributes.has('aria-disabled'), false);
        assert.equal(typeof controller.refresh, 'function');
        assert.ok(ui.documentListeners.has('touchstart') && ui.documentListeners.has('touchend'));
        controller.destroy();
        assert.equal(ui.listeners.size, 0);
        assert.equal(ui.documentListeners.size, 0);
        assert.deepEqual(states, ['checking']);
    } finally {
        restoreGlobals(saved);
    }
});

test('succès, échec et hors ligne utilisent le même retour sans rechargement concurrent', async () => {
    const source = await readFile(new URL('../src/ui/pull-to-refresh.js', import.meta.url), 'utf8');
    const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
    assert.match(source, /const runRefresh = async/);
    assert.match(source, /await runRefresh\(\)/);
    assert.match(source, /handleTrigger = \(\) => \{ void runRefresh\(\); \}/);
    assert.match(source, /result\?\.state \|\| \(succeeded \? 'success' : 'error'\)/);
    assert.match(source, /if \(refreshing\) return \{ ok: false, busy: true \}/);
    assert.doesNotMatch(source, /location\.reload/);
    assert.match(app, /initPullToRefresh\(\{ onRefresh: refreshApplicationAndTariffs \}\)/);
    assert.match(app, /state: tariffResult\.ok \? 'success' : 'error'/);
    assert.match(app, /source: 'offline'/);
});
