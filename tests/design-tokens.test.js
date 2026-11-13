import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
// Déclarations hors des blocs de variables (:root et body.light).
const declarations = property => [...withoutComments.matchAll(new RegExp(`(?<![\\w-])${property}\\s*:\\s*([^;}]+)`, 'g'))]
    .map(match => match[1].replace(/\s*!important/, '').trim());

function luminance(hex) {
    const value = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16) / 255)
        .map(channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
    const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (lighter + 0.05) / (darker + 0.05);
}
function block(selector) {
    const start = css.indexOf(`${selector} {`);
    return css.slice(start, css.indexOf('}', start));
}
function variable(source, name) {
    return source.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
}

test('les tailles de police passent par l’échelle --fs-*', () => {
    const allowed = /^(var\(--fs-(xs|sm|base|md|lg|xl|2xl|3xl|4xl)\)|16px|0|inherit|\.8em|clamp\(.+\))$/;
    const strays = declarations('font-size').filter(value => !allowed.test(value));
    assert.deepEqual([...new Set(strays)], []);
    assert.match(block(':root'), /--fs-xs:\s*0\.75rem/, 'la plus petite taille reste à 12 px');
});

test('les rayons passent par l’échelle --radius-*', () => {
    const strays = declarations('border-radius')
        .flatMap(value => value.split(/\s+/))
        .filter(part => !/^(var\(--[a-z-]*radius[a-z-]*\)|50%|0|inherit)$/.test(part));
    assert.deepEqual([...new Set(strays)], []);
});

test('les plans d’empilement au-dessus du contenu sont nommés', () => {
    const strays = declarations('z-index').filter(value => /^\d+$/.test(value) && Number(value) >= 100);
    assert.deepEqual(strays, []);
    const names = ['sticky', 'map-marker', 'map-ui', 'status', 'pull', 'page', 'toast', 'notice', 'menu', 'nav', 'sheet', 'modal', 'landing'];
    const values = names.map(name => Number(block(':root').match(new RegExp(`--z-${name}:\\s*(\\d+)`))?.[1]));
    assert.deepEqual(values, [...values].sort((a, b) => a - b), 'les plans restent déclarés du plus bas au plus haut');
    assert.equal(new Set(values).size, names.length);
});

test('les couleurs de texte tiennent le contraste AA sur fond clair et sombre', () => {
    const dark = block(':root');
    const light = block('body.light');
    for (const name of ['accent-text', 'success-text', 'warning-text', 'discount-text', 'text-muted', 'text-faint']) {
        const color = variable(light, name);
        assert.ok(color, `--${name} doit être redéfinie pour le thème clair`);
        assert.ok(contrast(color, '#ffffff') >= 4.5, `--${name} ${color} sur blanc`);
        assert.ok(contrast(color, '#f1f5f9') >= 4.5, `--${name} ${color} sur le fond des pages`);
    }
    for (const name of ['success-text', 'warning-text', 'discount-text']) {
        assert.ok(contrast(variable(dark, name), variable(dark, 'bg-card')) >= 4.5, `--${name} sur carte sombre`);
    }
    assert.ok(contrast(variable(dark, 'on-accent'), '#00C2FF') >= 4.5, 'texte posé sur un aplat d’accent');
    assert.doesNotMatch(withoutComments, /(?<![\w-])color\s*:\s*(var\(--accent\)|#00c2ff)\s*[;}]/i, 'le cyan vif ne sert pas de couleur de texte');
    assert.doesNotMatch(withoutComments, /background:\s*var\(--accent\);\s*color:\s*#fff/i);
});
