import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const tariffs = JSON.parse(await readFile(new URL('../public/tarifs.json', import.meta.url), 'utf8'));
const configSource = await readFile(new URL('../src/config/app-config.js', import.meta.url), 'utf8');
const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('référence Zunder et son icône', async () => {
    await access(new URL('../public/logos/zunder.png', import.meta.url));
    assert.match(configSource, /zunder: '\.\/logos\/zunder\.png'/);
    assert.match(configSource, /'zunder'/);
});

test('contient les trois forfaits officiels Zunder', () => {
    const zunder = tariffs.zunder;
    assert.equal(zunder.name, 'Zunder');
    assert.deepEqual(
        zunder.formulas.map(({ name, cost, rate }) => ({ name, cost, rate })),
        [
            { name: 'Sans forfait', cost: 0, rate: 0.59 },
            { name: 'Easy', cost: 1.99, rate: 0.51 },
            { name: 'Pro', cost: 11.99, rate: 0.39 }
        ]
    );
});

test('affiche la date de vérification du 6 août 2026', () => {
    assert.equal(tariffs._updated, '2026-08-06');
    assert.match(indexHtml, /Tarifs vérifiés le 6 août 2026/);
});
