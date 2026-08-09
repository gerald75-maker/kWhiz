import test from 'node:test';
import assert from 'node:assert/strict';

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
        this.updateButton = new FakeElement(this.ownerDocument, 'button');
        this.updateButton.className = 'update-popup__btn';
        this.appendChild(this.updateButton);
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
    querySelector(selector) { return selector === '.update-popup__btn' ? this.updateButton : null; }
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

    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { showUpdateBanner } = await import('../src/pwa/pwa-manager.js');
    let updateCalls = 0;
    showUpdateBanner({ onUpdate: () => { updateCalls += 1; } });

    const overlay = document.getElementById('kwhiz-update-popup');
    const updateButton = overlay.querySelector('.update-popup__btn');
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
