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

// Cas réel du 18/11/2026 (Limoux) : Lidl est déclaré dans le jeu « Lidl » et dans le jeu
// « QualiCharge ». QualiCharge a déplacé la station de 2 km, l'autre jeu n'a pas bougé.
test('fusionne une station Lidl déclarée deux fois sans déplacer la station publiée', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'irve-lidl-test-'));
  try {
    const fixture = await readFile(new URL('./fixtures/irve-pan-2026-10-15.csv', import.meta.url), 'utf8');
    const columns = fixture.split(/\r?\n/)[0].split(',');
    const csvLine = row => columns.map(column => {
      const value = String(row[column] ?? '');
      return value.includes(',') ? `"${value}"` : value;
    }).join(',');
    const base = {
      nom_operateur: 'Lidl', nom_enseigne: 'Lidl', id_station_itinerance: 'FRLDLPLFR4120EVCP',
      puissance_nominale: '120', prise_type_combo_ccs: 'true', prise_type_chademo: 'false',
      condition_acces: 'Accès libre', horaires: '24/7'
    };
    const lidlDataset = { ...base, nom_station: 'ALET', adresse_station: 'ALET', consolidated_latitude: '43.0441', consolidated_longitude: '2.2320', date_maj: '2025-12-11' };
    const qualiCharge = { ...base, nom_station: 'LFR4120EVCP03', adresse_station: "Route d'Alet, 11300, Limoux", consolidated_latitude: '43.0297', consolidated_longitude: '2.2505', date_maj: '2026-11-16' };
    const pointIds = ['FRLDLE00000793', 'FRLDLE00000794'];
    const rows = [lidlDataset, qualiCharge].flatMap(declaration =>
      pointIds.map(id => ({ ...declaration, id_pdc_itinerance: id })));
    const publishedId = 'lidl:43.0439:2.2323';
    const source = join(directory, 'irve-pan-lidl.csv');
    const atlante = join(directory, 'atlante.json');
    const previousStations = join(directory, 'previous-stations.json');
    const previousStatus = join(directory, 'previous-status.json');
    const output = join(directory, 'irve-fast.json');
    const build = (...options) => {
      execFileSync(process.execPath, [
        new URL('../scripts/build-irve-stations.mjs', import.meta.url).pathname,
        source, output, '2026-11-18', `--atlante-source=${atlante}`, ...options
      ]);
      return Promise.all([output, join(directory, 'irve-status-index.json')]
        .map(async path => JSON.parse(await readFile(path, 'utf8'))));
    };
    await writeFile(source, [columns.join(','), ...rows.map(csvLine)].join('\n') + '\n');
    await writeFile(atlante, '[]');
    // Publication du 11/11 : QualiCharge plaçait alors la station à 25 m de l'autre jeu.
    await writeFile(previousStations, JSON.stringify({ stations: [{
      id: publishedId, operator: 'lidl', lat: 43.04388, lon: 2.23229,
      name: 'LFR4120EVCP03', address: "Route d'Alet, 11300, Limoux", city: ''
    }] }));
    await writeFile(previousStatus, JSON.stringify({
      pointToStation: Object.fromEntries(pointIds.map(id => [id, publishedId]))
    }));

    const [fast, status] = await build(`--previous-stations=${previousStations}`, `--previous-status=${previousStatus}`);
    assert.equal(fast.stations.length, 1);
    const [lidl] = fast.stations;
    assert.equal(lidl.id, publishedId);
    assert.equal(lidl.connectors, 2);
    assert.deepEqual([lidl.lat, lidl.lon], [43.0441, 2.232]);
    assert.ok(!('coordinateCandidates' in lidl));
    assert.deepEqual(status.stationAliases, { 'lidl:43.0441:2.2320': publishedId });
    assert.deepEqual(status.pointToStation, Object.fromEntries(pointIds.map(id => [id, publishedId])));
    assert.equal(status.metrics.conflictingPointIds, 0);

    // Sans publication antérieure : même fusion, position du canonique.
    const [first] = await build();
    assert.equal(first.stations.length, 1);
    assert.equal(first.stations[0].id, 'lidl:43.0297:2.2505');
    assert.deepEqual([first.stations[0].lat, first.stations[0].lon], [43.0297, 2.2505]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
