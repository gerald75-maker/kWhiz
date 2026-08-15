import test from 'node:test';
import assert from 'node:assert/strict';
import { preservePublishedStationIds } from '../scripts/irve-station-identity.mjs';
import { readFile } from 'node:fs/promises';

function candidate(id, { points, lat = 43.48195, lon = -1.44596, operator = 'electra', name = "Saint-Pierre-d'Irube - CC Ametzondo Shopping" }) {
  return {
    stationId: id, operator, lat, lon, pointIds: new Set(points),
    sourceStationIds: new Set(['FRELCPSPIAM']), names: new Set([name]),
    addresses: new Set(["3 avenue du Portou 64990 Saint-Pierre-d'Irube"]),
    cities: new Set(["Saint-Pierre-d'Irube"])
  };
}

const previousStations = {
  stations: [{
    id: 'electra:43.4817:-1.4457', operator: 'electra', lat: 43.481727, lon: -1.445726,
    name: "Electra Saint-Pierre-d'Irube - CC Ametzondo Shopping",
    address: "3 avenue du Portou, 64990 Saint-Pierre-d'Irube", city: ''
  }]
};

test('conserve le canonique publié d’Ametzondo quand les huit points prouvent le même site', () => {
  const points = Array.from({ length: 8 }, (_, index) => `FRELC-P${index + 1}`);
  const previousStatus = { pointToStation: Object.fromEntries(points.map(point => [point, 'electra:43.4817:-1.4457'])) };
  const result = preservePublishedStationIds([
    candidate('electra:43.4819:-1.4460', { points })
  ], previousStations, previousStatus);

  assert.equal(result.stations.length, 1);
  assert.equal(result.stations[0].stationId, 'electra:43.4817:-1.4457');
  assert.equal(result.stations[0].pointIds.size, 8);
  assert.deepEqual(result.renames, { 'electra:43.4819:-1.4460': 'electra:43.4817:-1.4457' });
});

test('refuse un ancien identifiant ambigu, distant ou revendiqué par deux stations', () => {
  const previousStatus = { pointToStation: { A: 'electra:43.4817:-1.4457', B: 'electra:43.4817:-1.4457' } };
  const distant = candidate('electra:48.0000:2.0000', { points: ['A'], lat: 48, lon: 2 });
  const split = [
    candidate('electra:43.4819:-1.4460', { points: ['A'] }),
    candidate('electra:43.4820:-1.4461', { points: ['B'] })
  ];

  assert.deepEqual(preservePublishedStationIds([distant], previousStations, previousStatus).renames, {});
  assert.deepEqual(preservePublishedStationIds(split, previousStations, previousStatus).renames, {});
});

test('le générateur préfère un nom de station descriptif au nom générique de l’opérateur', async () => {
  const source = await readFile(new URL('../scripts/build-irve-stations.mjs', import.meta.url), 'utf8');
  assert.match(source, /stableStationName\(station\.names, station\.operatorNames, station\.operator\)/);
  assert.match(source, /descriptiveNames = \[\.\.\.names\]\.filter\(name => !genericNames\.has\(normalize\(name\)\)\)/);
  assert.match(source, /operator === 'engie-vianeo'[\s\S]*brandedNames/);
});
