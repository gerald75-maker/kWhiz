import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const operatorsSource = await readFile(new URL('../src/ui/views/operators-view.js', import.meta.url), 'utf8');

test('ne contient plus la fenêtre ChargeBack Atlante', () => {
    assert.doesNotMatch(indexHtml, /id="cb-overlay"/);
    assert.doesNotMatch(indexHtml, /id="cb-modal-steps"/);
});

test('ne génère plus de bouton ouvrant la fenêtre ChargeBack', () => {
    assert.doesNotMatch(operatorsSource, /data-modal="cb"/);
});
