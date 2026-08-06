import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
);
const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('toutes les versions visibles utilisent la variable de build', () => {
    assert.match(indexHtml, /id="version-tap">__VERSION__/);
    assert.match(indexHtml, /id="about-app-version">__VERSION__/);
    assert.match(indexHtml, /menu-drawer-version"><span>kWhiz __VERSION__<\/span>/);
    assert.doesNotMatch(indexHtml, /kWhiz 2\.\d+\.\d+/);
});

test('la version du package est celle de la livraison', () => {
    assert.equal(packageJson.version, '2.19.1');
});
