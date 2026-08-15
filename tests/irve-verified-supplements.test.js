import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadVerifiedSupplements, mergeVerifiedSupplements, formatVerifiedSupplementsReport } from '../scripts/irve-verified-supplements.mjs';

const supplementPath = new URL('../public/irve-verified-supplements.json', import.meta.url);

test('décrit la station Atlante vérifiée avec 34 EVSE uniques et 300 kW', async () => {
  const document = JSON.parse(await readFile(supplementPath, 'utf8'));
  const [station] = document.supplements;
  assert.equal(station.id, 'verified:atlante:fratlfr00716');
  assert.equal(station.operator, 'atlante');
  assert.equal(station.lat, 43.48227);
  assert.equal(station.lon, -1.44582);
  assert.match(station.address, /avenue du Portou/);
  assert.equal(station.power, 300);
  assert.equal(station.connectors, 34);
  assert.equal(new Set(station.pointIds).size, 34);
  assert.equal(station.provenance, 'operator_verified');
  assert.equal(station.temporary, true);
});

test('ajoute le complément sans fusionner la station Electra Ametzondo voisine', () => {
  const [supplement] = loadVerifiedSupplements(supplementPath);
  const electra = { stationId: 'electra:43.4817:-1.4457', operator: 'electra', lat: 43.48195, lon: -1.44596, pointIds: new Set(['FRELC1']), display: { name: 'Ametzondo', address: '3 avenue du Portou' } };
  const result = mergeVerifiedSupplements([electra], [supplement]);
  assert.equal(result.stations.length, 2);
  assert.equal(result.audit[0].state, 'rapproché d’une station IRVE');
  assert.deepEqual(result.audit[0].stationIds, ['electra:43.4817:-1.4457']);
});

test('réconcilie automatiquement une future station IRVE portant les mêmes points', () => {
  const [supplement] = loadVerifiedSupplements(supplementPath);
  const official = { stationId: 'atlante:43.4823:-1.4458', operator: 'atlante', lat: 43.48227, lon: -1.44582, pointIds: new Set([supplement.pointIds[0]]), display: { name: supplement.name, address: supplement.address } };
  const result = mergeVerifiedSupplements([official], [supplement]);
  assert.equal(result.stations.length, 1);
  assert.equal(result.audit[0].state, 'complément devenu supprimable');
  assert.match(formatVerifiedSupplementsReport(result.audit), /complément devenu supprimable/);
});

test('reste déterministe quel que soit l’ordre des compléments', () => {
  const [supplement] = loadVerifiedSupplements(supplementPath);
  const other = { ...supplement, id: 'verified:atlante:other', officialSiteId: 'OTHER', lat: 44, lon: 2, pointIds: ['OTHER1'], connectors: 1 };
  const left = mergeVerifiedSupplements([], [supplement, other]);
  const right = mergeVerifiedSupplements([], [other, supplement]);
  assert.deepEqual(left, right);
});
