import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { syncHelpFaqState, toggleHelpFaq } from '../src/ui/help-faq.js';

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('la FAQ est fermée par défaut et relie chaque question à sa réponse', () => {
    const details = [...indexHtml.matchAll(/<details class="help-faq-item"([^>]*)>([\s\S]*?)<\/details>/g)];
    assert.equal(details.length, 12);

    for (const [, attributes, content] of details) {
        assert.doesNotMatch(attributes, /\bopen\b/);
        const controls = content.match(/aria-controls="([^"]+)"/)?.[1];
        assert.ok(controls);
        assert.match(content, /aria-expanded="false"/);
        assert.match(content, new RegExp(`id="${controls}"`));
    }
});

test('syncHelpFaqState reflète l’état natif du détail dans aria-expanded', () => {
    const attributes = new Map();
    const summary = {
        setAttribute(name, value) {
            attributes.set(name, value);
        }
    };
    const details = {
        open: false,
        querySelector(selector) {
            return selector === 'summary' ? summary : null;
        }
    };

    syncHelpFaqState(details);
    assert.equal(attributes.get('aria-expanded'), 'false');

    details.open = true;
    syncHelpFaqState(details);
    assert.equal(attributes.get('aria-expanded'), 'true');
});

test('toggleHelpFaq bascule immédiatement sans animation si les mouvements sont réduits', async () => {
    const attributes = new Map();
    const summary = {
        setAttribute(name, value) {
            attributes.set(name, value);
        }
    };
    const answer = {};
    const details = {
        open: false,
        dataset: {},
        querySelector(selector) {
            if (selector === 'summary') return summary;
            if (selector === '.help-faq-answer') return answer;
            return null;
        }
    };

    await toggleHelpFaq(details, true);
    assert.equal(details.open, true);
    assert.equal(attributes.get('aria-expanded'), 'true');

    await toggleHelpFaq(details, true);
    assert.equal(details.open, false);
    assert.equal(attributes.get('aria-expanded'), 'false');
});
