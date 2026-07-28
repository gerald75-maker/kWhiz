import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl } from '../src/shared/dom.js';

describe('sécurisation des URL rendues dans le DOM', () => {
    it('accepte et échappe une URL HTTPS valide', () => {
        assert.equal(
            safeUrl('https://example.com/path?q=a&b=c'),
            'https://example.com/path?q=a&amp;b=c'
        );
    });

    it('refuse les protocoles actifs et les URL injectées', () => {
        assert.equal(safeUrl('javascript:alert(1)'), '');
        assert.equal(safeUrl('data:text/html,<script>alert(1)</script>'), '');
        assert.equal(safeUrl('https://example.com" onclick="alert(1)'), '');
    });
});
