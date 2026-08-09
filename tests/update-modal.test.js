import test from 'node:test';
import assert from 'node:assert/strict';
import { setLanguage } from '../src/i18n/i18n.js';

class FakeClassList {
    constructor() { this.values = new Set(); }
    add(...values) { values.forEach(value => this.values.add(value)); }
    remove(...values) { values.forEach(value => this.values.delete(value)); }
    contains(value) { return this.values.has(value); }
}

class FakeElement extends EventTarget {
    constructor(ownerDocument, tagName = 'div') {
        super();
        this.ownerDocument = ownerDocument;
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.classList = new FakeClassList();
        this.attributes = new Map();
        this.hidden = false;
        this.inert = false;
        this.isConnected = false;
        this.updateButton = null;
    }

    set className(value) {
        this.classList = new FakeClassList();
        String(value).split(/\s+/).filter(Boolean).forEach(name => this.classList.add(name));
    }

    set innerHTML(value) {
        if (!value.includes('update-popup__btn')) return;
        const content = (className) => value.match(new RegExp(`class="[^"]*${className}[^"]*"[^>]*>([^<]*)<`))?.[1];
        const dialog = new FakeElement(this.ownerDocument, 'div');
        dialog.className = 'update-popup';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'kwhiz-update-title');
        dialog.setAttribute('aria-describedby', 'kwhiz-update-description');
        const title = new FakeElement(this.ownerDocument, 'p');
        title.id = 'kwhiz-update-title';
        title.className = 'update-popup__title';
        title.textContent = content('update-popup__title');
        const description = new FakeElement(this.ownerDocument, 'p');
        description.id = 'kwhiz-update-description';
        description.className = 'update-popup__body';
        description.textContent = content('update-popup__body');
        this.updateButton = new FakeElement(this.ownerDocument, 'button');
        this.updateButton.className = 'update-popup__btn';
        this.updateButton.textContent = content('update-popup__btn');
        dialog.appendChild(title);
        dialog.appendChild(description);
        dialog.appendChild(this.updateButton);
        this.appendChild(dialog);
    }

    appendChild(element) {
        this.children.push(element);
        element.parentElement = this;
        element.setConnected(this.isConnected);
        return element;
    }

    setConnected(value) {
        this.isConnected = value;
        this.children.forEach(child => child.setConnected(value));
    }

    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    removeAttribute(name) { this.attributes.delete(name); }
    querySelector(selector) {
        if (selector === '.update-popup__btn') return this.updateButton;
        const className = selector.startsWith('.') ? selector.slice(1) : null;
        const visit = element => {
            if (className && element.classList.contains(className)) return element;
            for (const child of element.children) {
                const match = visit(child);
                if (match) return match;
            }
            return null;
        };
        return visit(this);
    }
    querySelectorAll() { return this.updateButton ? [this.updateButton] : []; }

    focus() { this.ownerDocument.activeElement = this; }

    remove() {
        if (!this.parentElement) return;
        this.parentElement.children = this.parentElement.children.filter(child => child !== this);
        this.parentElement = null;
        this.setConnected(false);
    }
}

class FakeDocument extends EventTarget {
    constructor() {
        super();
        this.body = new FakeElement(this, 'body');
        this.body.setConnected(true);
        this.activeElement = this.body;
    }

    createElement(tagName) { return new FakeElement(this, tagName); }

    getElementById(id) {
        const visit = element => {
            if (element.id === id) return element;
            for (const child of element.children) {
                const match = visit(child);
                if (match) return match;
            }
            return null;
        };
        return visit(this.body);
    }
}

test('la fenêtre de mise à jour respecte le cycle modal et conserve son action', async () => {
    const document = new FakeDocument();
    globalThis.document = document;
    globalThis.HTMLElement = FakeElement;
    globalThis.window = { requestAnimationFrame: callback => callback() };
    globalThis.requestAnimationFrame = callback => callback();
    setLanguage('fr', { persist: false, translate: false });

    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { showUpdateBanner } = await import('../src/pwa/pwa-manager.js');
    let updateCalls = 0;
    showUpdateBanner({ onUpdate: () => { updateCalls += 1; } });

    const overlay = document.getElementById('kwhiz-update-popup');
    const updateButton = overlay.querySelector('.update-popup__btn');
    assert.equal(overlay.querySelector('.update-popup__title').textContent, 'Mise à jour disponible');
    assert.equal(overlay.querySelector('.update-popup__body').textContent, 'Une nouvelle version est disponible. Voulez-vous mettre à jour maintenant ?');
    assert.equal(updateButton.textContent, 'Actualiser');
    const dialog = overlay.querySelector('.update-popup');
    assert.equal(dialog.attributes.get('aria-labelledby'), 'kwhiz-update-title');
    assert.equal(dialog.attributes.get('aria-describedby'), 'kwhiz-update-description');
    assert.ok(document.getElementById('kwhiz-update-title'));
    assert.ok(document.getElementById('kwhiz-update-description'));
    assert.equal(document.activeElement, updateButton, 'le focus entre dans la fenêtre');
    assert.equal(trigger.inert, true, 'l’arrière-plan devient inaccessible');

    const tab = new Event('keydown', { cancelable: true });
    Object.defineProperty(tab, 'key', { value: 'Tab' });
    document.dispatchEvent(tab);
    assert.equal(tab.defaultPrevented, true);
    assert.equal(document.activeElement, updateButton, 'Tab reste contenu dans la fenêtre');

    const escape = new Event('keydown', { cancelable: true });
    Object.defineProperty(escape, 'key', { value: 'Escape' });
    document.dispatchEvent(escape);
    assert.equal(document.getElementById('kwhiz-update-popup'), null);
    assert.equal(document.activeElement, trigger, 'le focus revient au déclencheur');
    assert.equal(trigger.inert, false, 'l’arrière-plan redevient accessible');
    assert.equal(updateCalls, 0, 'Échap ne lance pas la mise à jour');

    showUpdateBanner({ onUpdate: () => { updateCalls += 1; } });
    document.getElementById('kwhiz-update-popup')
        .querySelector('.update-popup__btn')
        .dispatchEvent(new Event('click'));
    assert.equal(updateCalls, 1, 'le bouton Actualiser conserve son action');
    assert.equal(document.getElementById('kwhiz-update-popup'), null);
    assert.equal(document.activeElement, trigger);
});

test('la fenêtre de mise à jour suit instantanément la langue courante', async () => {
    const document = new FakeDocument();
    globalThis.document = document;
    globalThis.HTMLElement = FakeElement;
    globalThis.window = { requestAnimationFrame: callback => callback() };
    globalThis.requestAnimationFrame = callback => callback();

    const { showUpdateBanner } = await import('../src/pwa/pwa-manager.js');
    setLanguage('en', { persist: false, translate: false });
    showUpdateBanner();

    const overlay = document.getElementById('kwhiz-update-popup');
    assert.equal(overlay.querySelector('.update-popup__title').textContent, 'Update available');
    assert.equal(overlay.querySelector('.update-popup__body').textContent, 'A new version is available. Update now?');
    assert.equal(overlay.querySelector('.update-popup__btn').textContent, 'Update');
    assert.doesNotMatch([
        overlay.querySelector('.update-popup__title').textContent,
        overlay.querySelector('.update-popup__body').textContent,
        overlay.querySelector('.update-popup__btn').textContent
    ].join(' '), /Mise à jour|nouvelle version|Actualiser/);

    setLanguage('fr', { persist: false, translate: false });
    assert.equal(overlay.querySelector('.update-popup__title').textContent, 'Mise à jour disponible');
    assert.equal(overlay.querySelector('.update-popup__body').textContent, 'Une nouvelle version est disponible. Voulez-vous mettre à jour maintenant ?');
    assert.equal(overlay.querySelector('.update-popup__btn').textContent, 'Actualiser');

    setLanguage('en', { persist: false, translate: false });
    assert.equal(overlay.querySelector('.update-popup__title').textContent, 'Update available');
    assert.equal(overlay.querySelector('.update-popup__body').textContent, 'A new version is available. Update now?');
    assert.equal(overlay.querySelector('.update-popup__btn').textContent, 'Update');
});
