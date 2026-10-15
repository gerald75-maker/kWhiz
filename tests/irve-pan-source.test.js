import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// Four real >=100 kW rows from the official PAN export collected on 2026-10-15.
// QualiCharge supplies the three networks omitted by the legacy consolidation.
test('importe les réseaux perdus depuis le schéma PAN sans commune consolidée', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'irve-pan-test-'));
  try {
    const atlante = join(directory, 'atlante.json');
    const output = join(directory, 'irve-fast.json');
    await writeFile(atlante, '[]');
    execFileSync(process.execPath, [
      new URL('../scripts/build-irve-stations.mjs', import.meta.url).pathname,
      new URL('./fixtures/irve-pan-2026-10-15.csv', import.meta.url).pathname,
      output, '2026-10-15', `--atlante-source=${atlante}`
    ]);
    const { stations } = JSON.parse(await readFile(output, 'utf8'));
    assert.deepEqual(stations.map(station => station.operator).sort(), ['fastned', 'iecharge', 'ionity', 'pluginn']);
    assert.ok(stations.every(station => station.power >= 100 && station.connectors === 1));
    const status = JSON.parse(await readFile(join(directory, 'irve-status-index.json'), 'utf8'));
    assert.deepEqual(Object.keys(status.pointToStation).sort(), [
      'FRFASE3300401', 'FRIENE0001011', 'FRIONE1012', 'FRMFCEALBERTVILLE1'
    ].sort());
    assert.equal(status.metrics.overwrittenAssociations, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
