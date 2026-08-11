import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

function rule(selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
    assert.ok(match, `règle ${selector} introuvable`);
    return match[1];
}

function luminance(hex) {
    const channels = hex.match(/[\da-f]{2}/gi).map(value => parseInt(value, 16) / 255);
    const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground, background) {
    const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
}

test('les composants d’installation utilisent les couleurs sémantiques', () => {
    assert.match(rule('.landing-install'), /background:\s*var\(--bg-element\)/);
    assert.match(rule('.landing-install'), /border-color:\s*var\(--border-color\)/);
    assert.match(rule('.landing-install-title'), /color:\s*var\(--text-secondary\)/);
    assert.match(rule('.install-tip'), /color:\s*var\(--text-secondary\)/);
    assert.match(rule('.install-tip'), /font-size:\s*0\.88rem/);
    assert.match(rule('.install-steps'), /color:\s*var\(--text-secondary\)/);
    assert.match(rule('.install-steps'), /font-size:\s*0\.88rem/);
    assert.match(rule('.text-strong'), /color:\s*var\(--text-primary\)/);
    assert.match(rule('.install-steps strong'), /color:\s*var\(--text-primary\)/);
    assert.match(rule('.install-steps strong'), /font-weight:\s*700/);
});

test('le texte secondaire respecte WCAG AA dans les deux thèmes', () => {
    // Fonds effectifs conservateurs après composition de --bg-element sur les cartes.
    assert.ok(contrast('94a3b8', '273244') >= 4.5, 'contraste sombre insuffisant');
    assert.ok(contrast('334155', 'f7f7f7') >= 4.5, 'contraste clair insuffisant');
});

test('les icônes de système basculent toujours avec le thème', () => {
    assert.match(css, /\.os-logo--light\s*\{\s*display:\s*none/);
    assert.match(css, /\.os-logo--dark\s*\{\s*display:\s*inline/);
    assert.match(css, /body\.light \.os-logo--light\s*\{\s*display:\s*inline/);
    assert.match(css, /body\.light \.os-logo--dark\s*\{\s*display:\s*none/);
});
