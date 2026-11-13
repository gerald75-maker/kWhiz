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
        this.inert = false;
        this.textContent = '';
    }
    set className(value) {
        this.classList = new FakeClassList();
        String(value).split(/\s+/).filter(Boolean).forEach(name => this.classList.add(name));
    }
    appendChild(element) { this.children.push(element); element.parentElement = this; return element; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    querySelector(selector) {
        const className = selector.slice(1);
        const visit = element => {
            if (element.classList.contains(className)) return element;
            for (const child of element.children) {
                const match = visit(child);
                if (match) return match;
            }
            return null;
        };
        return visit(this);
    }
    focus() { this.ownerDocument.activeElement = this; }
    remove() {
        if (!this.parentElement) return;
        this.parentElement.children = this.parentElement.children.filter(child => child !== this);
        this.parentElement = null;
    }
}

class FakeDocument extends EventTarget {
    constructor() {
        super();
        this.body = new FakeElement(this, 'body');
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

function installFakeDom() {
    const document = new FakeDocument();
    globalThis.document = document;
    globalThis.HTMLElement = FakeElement;
    globalThis.window = { requestAnimationFrame: callback => callback() };
    globalThis.requestAnimationFrame = callback => callback();
    return document;
}

test('le bandeau de mise à jour ne bloque pas l’écran et garde ses deux actions', async () => {
    const document = installFakeDom();
    setLanguage('fr', { persist: false, translate: false });
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { showUpdateBanner } = await import('../src/pwa/pwa-manager.js');
    let updateCalls = 0;
    showUpdateBanner({ onUpdate: () => { updateCalls += 1; } });

    const bar = document.getElementById('kwhiz-update-popup');
    assert.ok(bar.classList.contains('update-bar'));
    assert.ok(bar.classList.contains('is-visible'));
    assert.equal(bar.attributes.get('role'), 'region');
    assert.equal(bar.attributes.get('aria-labelledby'), 'kwhiz-update-title');
    assert.equal(bar.querySelector('.update-bar__text').attributes.get('role'), 'status', 'le texte est annoncé sans prendre le focus');
    assert.equal(bar.querySelector('.update-popup__title').textContent, 'Mise à jour disponible');
    assert.equal(bar.querySelector('.update-popup__body').textContent, 'Une nouvelle version de kWhiz est prête.');
    assert.equal(bar.querySelector('.update-popup__btn').textContent, 'Actualiser');
    assert.equal(bar.querySelector('.update-bar__later').textContent, 'Plus tard');
    assert.equal(document.activeElement, trigger, 'le focus reste où il était');
    assert.equal(trigger.inert, false, 'le reste de l’écran reste utilisable');

    showUpdateBanner({ onUpdate: () => { updateCalls += 1; } });
    assert.equal(document.body.children.filter(child => child.id === 'kwhiz-update-popup').length, 1, 'un seul bandeau à la fois');

    bar.querySelector('.update-bar__later').dispatchEvent(new Event('click'));
    assert.equal(document.getElementById('kwhiz-update-popup'), null, '« Plus tard » referme le bandeau');
    assert.equal(updateCalls, 0, '« Plus tard » ne lance pas la mise à jour');

    showUpdateBanner({ onUpdate: () => { updateCalls += 1; } });
    document.getElementById('kwhiz-update-popup').querySelector('.update-popup__btn').dispatchEvent(new Event('click'));
    assert.equal(updateCalls, 1, '« Actualiser » lance la mise à jour');
    assert.equal(document.getElementById('kwhiz-update-popup'), null);
});

test('le bandeau de mise à jour suit la langue courante', async () => {
    const document = installFakeDom();
    const { showUpdateBanner } = await import('../src/pwa/pwa-manager.js');
    setLanguage('en', { persist: false, translate: false });
    showUpdateBanner();

    const bar = document.getElementById('kwhiz-update-popup');
    const texts = () => ['.update-popup__title', '.update-popup__body', '.update-popup__btn', '.update-bar__later']
        .map(selector => bar.querySelector(selector).textContent);
    assert.deepEqual(texts(), ['Update available', 'A new version of kWhiz is ready.', 'Update', 'Later']);

    setLanguage('fr', { persist: false, translate: false });
    assert.deepEqual(texts(), ['Mise à jour disponible', 'Une nouvelle version de kWhiz est prête.', 'Actualiser', 'Plus tard']);
});
