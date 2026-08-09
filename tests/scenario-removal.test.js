import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';

async function javascriptSources(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const sources = [];
    for (const entry of entries) {
        const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
        if (entry.isDirectory()) sources.push(...await javascriptSources(url));
        else if (entry.name.endsWith('.js')) sources.push(await readFile(url, 'utf8'));
    }
    return sources;
}

test('aucun module actif n’importe le simulateur de scénario supprimé', async () => {
    const moduleUrl = new URL('../src/ui/scenario-simulator.js', import.meta.url);
    await assert.rejects(access(moduleUrl));

    const sources = await javascriptSources(new URL('../src/', import.meta.url));
    assert.doesNotMatch(sources.join('\n'), /scenario-simulator/);
});

test('aucun élément ou sélecteur du simulateur ne subsiste dans l’interface', async () => {
    const [html, css] = await Promise.all([
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../styles.css', import.meta.url), 'utf8')
    ]);

    assert.doesNotMatch(html, /scenario-simulator|class="[^"]*scenario-/);
    assert.doesNotMatch(css, /\.scenario-/);
});
